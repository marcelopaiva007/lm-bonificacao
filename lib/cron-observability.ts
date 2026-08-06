import "server-only";
import { prisma } from "@/lib/prisma";
import { garantirEstrutura } from "@/lib/ddl";
import { enviarTelegram } from "@/lib/notificacoes";
import { ensureFuncionarioContato } from "@/lib/ensure-schema";

// Observabilidade dos crons: grava o resultado de cada execução em "cron_run" e
// expõe um resumo de saúde por job. Segue o mesmo padrão do ensureRelatorioTable
// do sync-elleven — a tabela é criada sob demanda (CREATE TABLE IF NOT EXISTS),
// porque o build não roda `prisma migrate deploy` e as migrações não são
// aplicadas à mão neste projeto. Assim, nada aqui depende de mexer no
// schema.prisma nem no fluxo de migrations.

// Jobs esperados (espelham vercel.json). `maxIdadeHoras` = quanto tempo sem
// rodar até considerarmos o job "atrasado" (todos são diários → 24h + folga).
export const CRON_JOBS = [
  { job: "sync-elleven:vendedores-comercial", label: "Elleven — Vendedores Comercial", maxIdadeHoras: 26 },
  { job: "sync-elleven:funil-de-vendas", label: "Elleven — Funil de Vendas", maxIdadeHoras: 26 },
  { job: "sync-elleven:pedidos-de-venda", label: "Elleven — Pedidos de Venda", maxIdadeHoras: 26 },
  { job: "sync-chip", label: "Vendas de Chip (L&M Móvel)", maxIdadeHoras: 26 },
  { job: "cobranca-metas", label: "Cobrança de Metas", maxIdadeHoras: 26 },
] as const;

let cronRunTableEnsured = false;
export async function ensureCronRunTable(): Promise<void> {
  if (cronRunTableEnsured) return;
  // Schema-qualificado desde o cutover de 24/07/2026: SQL cru não passa pelo
  // mapeamento do Prisma, e sem o prefixo o IF NOT EXISTS criaria uma tabela
  // duplicada no public em vez de usar a real em "bonificacao".
  await garantirEstrutura([`CREATE TABLE IF NOT EXISTS "bonificacao"."cron_run" (
      "id" SERIAL NOT NULL,
      "job" TEXT NOT NULL,
      "ok" BOOLEAN NOT NULL,
      "durationMs" INTEGER,
      "detalhes" JSONB,
      "erro" TEXT,
      "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "cron_run_pkey" PRIMARY KEY ("id")
    );`]);
  await garantirEstrutura([`CREATE INDEX IF NOT EXISTS "cron_run_job_finishedAt_idx" ON "bonificacao"."cron_run"("job", "finishedAt" DESC);`]);
  cronRunTableEnsured = true;
}

export type CronRunInput = {
  job: string;
  ok: boolean;
  durationMs?: number;
  detalhes?: unknown;
  erro?: string | null;
};

// Grava uma execução de cron. Best-effort e blindado: uma falha ao registrar
// NUNCA pode derrubar o cron em si — captura e apenas loga.
export async function recordCronRun(input: CronRunInput): Promise<void> {
  try {
    await ensureCronRunTable();
    const detalhesJson = input.detalhes != null ? JSON.stringify(input.detalhes) : null;
    await prisma.$executeRaw`
      INSERT INTO "bonificacao"."cron_run" ("job", "ok", "durationMs", "detalhes", "erro")
      VALUES (
        ${input.job},
        ${input.ok},
        ${input.durationMs ?? null},
        ${detalhesJson}::jsonb,
        ${input.erro ?? null}
      )
    `;
  } catch (e) {
    console.error(`[cron-observability] falha ao gravar cron_run (${input.job}):`, e);
  }

  // Alerta ativo: cron falhou -> avisa no Telegram do responsável. Fora do try
  // acima de propósito (mesmo se a gravação falhar, o alerta ainda sai), e com
  // blindagem própria — alerta é best-effort, nunca derruba o cron.
  if (!input.ok) {
    try {
      await alertarFalhaCron(input);
    } catch (e) {
      console.error(`[cron-observability] falha ao alertar (${input.job}):`, e);
    }
  }
}

// Quem recebe o aviso de falha. A fonte principal é o CADASTRO — os
// funcionários marcados como "recebe alerta" na tela Vincular Telegram —, e não
// uma variável de ambiente. Motivo: a versão anterior dependia só de
// CRON_ALERTA_TELEGRAM_CHAT_ID, que nunca foi cadastrada em produção; o alerta
// ficou desligado em silêncio e o Elleven passou dias falhando 3× por dia sem
// ninguém saber. Configuração que só existe fora do sistema é configuração que
// ninguém lembra de fazer.
//
// CRON_ALERTA_TELEGRAM_CHAT_ID continua valendo como reforço: soma ao cadastro,
// para o aviso ainda sair caso o banco esteja fora do ar — que é justamente uma
// das falhas que precisam ser avisadas.
async function destinatariosDeAlerta(): Promise<string[]> {
  const destinos = new Set<string>();

  const daEnv = process.env.CRON_ALERTA_TELEGRAM_CHAT_ID;
  if (daEnv) {
    for (const parte of daEnv.split(",")) {
      const limpo = parte.trim();
      if (limpo) destinos.add(limpo);
    }
  }

  try {
    // O cron não passa pelo requireUser, que é quem normalmente garante as
    // colunas sob demanda — sem isto, a primeira falha depois do deploy não
    // seria avisada, que é exatamente quando o aviso importa.
    await ensureFuncionarioContato();
    const marcados = await prisma.funcionario.findMany({
      where: { ativo: true, recebeAlertaTecnico: true, telegramChatId: { not: null } },
      select: { telegramChatId: true },
    });
    for (const f of marcados) {
      if (f.telegramChatId) destinos.add(f.telegramChatId);
    }
  } catch (e) {
    // Banco indisponível é exatamente um cenário de alerta: seguimos com o que
    // veio da env var em vez de perder o aviso inteiro.
    console.error("[cron-observability] não consegui ler os destinatários no banco:", e);
  }

  return [...destinos];
}

async function alertarFalhaCron(input: CronRunInput): Promise<void> {
  const destinos = await destinatariosDeAlerta();
  if (destinos.length === 0) return;

  const def = CRON_JOBS.find((j) => j.job === input.job);
  const duracao =
    input.durationMs != null ? ` após ${Math.round(input.durationMs / 1000)}s` : "";
  const texto =
    `⚠️ Cron FALHOU: ${def?.label ?? input.job}${duracao}\n` +
    `Erro: ${(input.erro ?? "sem mensagem").slice(0, 500)}\n` +
    `Detalhes: /api/health/crons`;

  for (const chatId of destinos) {
    const r = await enviarTelegram(chatId, texto);
    if (!r.ok) {
      console.error(
        `[cron-observability] Telegram não entregou o alerta para ${chatId}: ${r.erro}`,
      );
    }
  }
}

export type CronJobHealth = {
  job: string;
  label: string;
  ok: boolean | null; // null = nunca rodou (segundo o registro)
  nuncaRodou: boolean;
  ultimaExecucao: string | null; // ISO
  idadeMinutos: number | null;
  atrasado: boolean;
  durationMs: number | null;
  erro: string | null;
  detalhes: unknown;
};

type CronRunRow = {
  job: string;
  ok: boolean;
  durationMs: number | null;
  detalhes: unknown;
  erro: string | null;
  finishedAt: Date;
};

// Resumo de saúde: última execução de cada job esperado + se está atrasado.
// Jobs que nunca rodaram aparecem como nuncaRodou=true/atrasado=true, para o
// problema ser visível em vez de silencioso.
export async function getCronHealth(): Promise<CronJobHealth[]> {
  await ensureCronRunTable();
  const rows = await prisma.$queryRawUnsafe<CronRunRow[]>(
    `SELECT DISTINCT ON ("job") "job", "ok", "durationMs", "detalhes", "erro", "finishedAt"
     FROM "bonificacao"."cron_run"
     ORDER BY "job", "finishedAt" DESC`,
  );
  const porJob = new Map(rows.map((r) => [r.job, r]));
  const agora = Date.now();

  return CRON_JOBS.map((def) => {
    const r = porJob.get(def.job);
    if (!r) {
      return {
        job: def.job,
        label: def.label,
        ok: null,
        nuncaRodou: true,
        ultimaExecucao: null,
        idadeMinutos: null,
        atrasado: true,
        durationMs: null,
        erro: null,
        detalhes: null,
      };
    }
    const idadeMs = agora - new Date(r.finishedAt).getTime();
    return {
      job: def.job,
      label: def.label,
      ok: r.ok,
      nuncaRodou: false,
      ultimaExecucao: new Date(r.finishedAt).toISOString(),
      idadeMinutos: Math.round(idadeMs / 60000),
      atrasado: idadeMs > def.maxIdadeHoras * 3_600_000,
      durationMs: r.durationMs,
      erro: r.erro,
      detalhes: r.detalhes,
    };
  });
}
