// Cobrança diária de metas por Telegram (e, opcionalmente, e-mail).
//
// TRAVA DE SEGURANÇA: só envia de verdade quando COBRANCA_ATIVA="true". Enquanto
// não estiver, roda em modo "dry-run" (calcula e retorna o que SERIA enviado, sem
// mandar nada) — assim dá para configurar tudo e testar sem cobrar ninguém por
// engano.
//
// CANAIS: começamos apenas pelo Telegram. O e-mail fica desligado por padrão
// (o Resend só entrega para o dono da conta até um domínio ser verificado) e só
// é usado quando COBRANCA_EMAIL_ATIVA="true" — aí é só ligar o flag, sem mexer
// no código.
//
// RATE LIMIT: o Resend aceita 2 req/s, então os e-mails saem espaçados em
// RESEND_INTERVALO_MS (500ms) e um 429 é reenviado com backoff exponencial
// dentro de enviarEmail(). Falhas de entrega não derrubam o cron, mas são
// contadas em detalhes.falhasEmail / falhasTelegram no cron_run.
//
// Variáveis de ambiente:
//   COBRANCA_ATIVA         — "true" liga o envio real (default: dry-run)
//   COBRANCA_EMAIL_ATIVA   — "true" também manda por e-mail (default: só Telegram)
//   CRON_SECRET            — auth do Vercel Cron (Bearer), como no sync-elleven
//   COBRANCA_SECRET        — (opcional) para disparo manual via ?secret=
//   TELEGRAM_BOT_TOKEN, RESEND_API_KEY, COBRANCA_EMAIL_FROM — ver lib/notificacoes.ts
import { NextRequest, NextResponse } from "next/server";
import { periodoAtual, periodoLabel } from "@/lib/periodo";
import { carregarAcompanhamento } from "@/lib/acompanhamento-data";
import {
  enviarTelegram,
  enviarEmail,
  telegramConfigurado,
  emailConfigurado,
  sleep,
  RESEND_INTERVALO_MS,
  type EnvioResultado,
} from "@/lib/notificacoes";
import { recordCronRun } from "@/lib/cron-observability";

export const runtime = "nodejs";
export const maxDuration = 120;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`)
    return true;
  const manual = process.env.COBRANCA_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") || req.headers.get("x-cobranca-secret");
  if (manual && provided === manual) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
  const ativa = process.env.COBRANCA_ATIVA === "true";
  // E-mail começa desligado; só entra quando o domínio do Resend estiver
  // verificado e este flag for ligado.
  const emailAtivo = process.env.COBRANCA_EMAIL_ATIVA === "true";
  const periodo = periodoAtual();
  const acompanhamentos = await carregarAcompanhamento(periodo);
  const assunto = `Sua meta de ${periodoLabel(periodo)} — LM`;

  const resultados: Array<
    { nome: string } & (EnvioResultado | { dryRun: true; canais: string[]; previa: string })
  > = [];
  let enviados = 0;
  let semContato = 0;
  let falhasTelegram = 0;
  let falhasEmail = 0;
  // Amostra dos erros para o cron_run — o suficiente para diagnosticar sem
  // inchar o JSONB com uma linha por pessoa.
  const errosEmail: string[] = [];
  const errosTelegram: string[] = [];
  // Marca do último POST ao Resend, para espaçar os envios em RESEND_INTERVALO_MS
  // (2 req/s). Guardamos o instante em vez de dormir fixo a cada volta: se o
  // envio do Telegram já consumiu o intervalo, não há motivo para esperar mais.
  let ultimoEnvioEmail = 0;

  for (const a of acompanhamentos) {
    const usaEmail = !!a.email && emailAtivo;
    const canais: string[] = [];
    if (a.telegramChatId) canais.push("telegram");
    if (usaEmail) canais.push("email");
    if (canais.length === 0) {
      semContato++;
      continue;
    }

    if (!ativa) {
      resultados.push({
        nome: a.nome,
        dryRun: true,
        canais,
        previa: a.mensagem.slice(0, 160),
      });
      continue;
    }

    if (a.telegramChatId) {
      const r = await enviarTelegram(a.telegramChatId, a.mensagem);
      resultados.push({ nome: a.nome, ...r });
      if (r.ok) {
        enviados++;
      } else {
        falhasTelegram++;
        if (errosTelegram.length < 10) errosTelegram.push(`${a.nome}: ${r.erro}`);
      }
    }
    if (usaEmail && a.email) {
      const desdeUltimo = Date.now() - ultimoEnvioEmail;
      if (ultimoEnvioEmail > 0 && desdeUltimo < RESEND_INTERVALO_MS) {
        await sleep(RESEND_INTERVALO_MS - desdeUltimo);
      }
      const r = await enviarEmail(a.email, assunto, a.mensagem);
      ultimoEnvioEmail = Date.now();
      resultados.push({ nome: a.nome, ...r });
      if (r.ok) {
        enviados++;
      } else {
        falhasEmail++;
        if (errosEmail.length < 10) errosEmail.push(`${a.nome}: ${r.erro}`);
      }
    }
  }

  await recordCronRun({
    job: "cobranca-metas",
    ok: true,
    durationMs: Date.now() - started,
    detalhes: {
      periodo,
      ativa,
      dryRun: !ativa,
      emailAtivo,
      totalPessoas: acompanhamentos.length,
      semContato,
      enviados,
      // Falhas de entrega não derrubam o cron (ok=true acima), mas ficam
      // registradas aqui — sem isto, um 429 ou um endereço inválido sumia.
      falhasEmail,
      falhasTelegram,
      ...(errosEmail.length ? { errosEmail } : {}),
      ...(errosTelegram.length ? { errosTelegram } : {}),
    },
  });
  return NextResponse.json({
    ok: true,
    periodo,
    ativa,
    dryRun: !ativa,
    emailAtivo,
    canaisConfigurados: {
      telegram: telegramConfigurado(),
      email: emailAtivo && emailConfigurado(),
    },
    totalPessoas: acompanhamentos.length,
    comContato: acompanhamentos.filter(
      (a) => a.telegramChatId || (a.email && emailAtivo),
    ).length,
    semContato,
    enviados,
    falhasEmail,
    falhasTelegram,
    resultados: resultados.slice(0, 200),
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun({
      job: "cobranca-metas",
      ok: false,
      durationMs: Date.now() - started,
      erro: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
