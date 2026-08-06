// Sincronização diária das vendas de chip do L&M Movel
// (https://movel.assinelm.com). Sem scraping: a plataforma tem API REST própria
// (login por email+senha -> JWT; GET /vendas/sales?year&month paginado). Toda a
// lógica está em lib/chip-movel.ts (compartilhada com a tela /importar/chip).
//
// Sincroniza o mês corrente e, nos 3 primeiros dias do mês, também o mês
// anterior (vendas de fim de mês que entram depois do fechamento do dia).
//
// Variáveis de ambiente:
//   MOVEL_LOGIN, MOVEL_PASSWORD — conta da plataforma L&M Movel
//   SYNC_CHIP_SECRET (ou SYNC_ELLEVEN_SECRET) — disparo manual via ?secret=...
//   CRON_SECRET — enviado automaticamente pelo Vercel Cron
import { NextRequest, NextResponse } from "next/server";
import { syncChipMovel, type ResultadoSyncChip } from "@/lib/chip-movel";
import { recordCronRun } from "@/lib/cron-observability";
import { FUSO_BR, periodoAnterior, periodoAtual } from "@/lib/periodo";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`)
    return true;

  const manualSecret =
    process.env.SYNC_CHIP_SECRET || process.env.SYNC_ELLEVEN_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") || req.headers.get("x-sync-secret");
  if (manualSecret && provided === manualSecret) return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?year=&month= permitem reprocessar um mês específico (ex.: backfill de um
  // período já fechado no L&M Movel para conferência).
  const yearParam = Number(req.nextUrl.searchParams.get("year"));
  const monthParam = Number(req.nextUrl.searchParams.get("month"));
  const explicit = yearParam >= 2020 && monthParam >= 1 && monthParam <= 12;

  // Data corrente SEMPRE no fuso de Brasília, como manda lib/periodo.ts. Em
  // produção o servidor roda em UTC: a partir das ~21h de Brasília a data UTC já
  // é o dia seguinte — e na virada do mês, o mês seguinte. Com o relógio do
  // servidor, um disparo manual no fim do dia 31 sincronizava o mês errado, e a
  // janela de recuperação "dia <= 3" fechava algumas horas antes do previsto.
  // O cron agendado (07:00 UTC = 04:00 BRT) não era afetado.
  const periodoBr = periodoAtual();
  const diaBr = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR, day: "2-digit" }).format(new Date()),
  );
  const alvoDoPeriodo = (periodo: string) => {
    const [year, month] = periodo.split("-").map(Number);
    return { year, month };
  };

  const alvos: Array<{ year: number; month: number }> = [];
  if (explicit) {
    alvos.push({ year: yearParam, month: monthParam });
  } else {
    alvos.push(alvoDoPeriodo(periodoBr));
    if (diaBr <= 3) {
      alvos.push(alvoDoPeriodo(periodoAnterior(periodoBr)));
    }
  }

  const resultados: ResultadoSyncChip[] = [];
  const started = Date.now();
  try {
    for (const alvo of alvos) {
      resultados.push(await syncChipMovel(alvo.year, alvo.month));
    }
    await recordCronRun({
      job: "sync-chip",
      ok: true,
      durationMs: Date.now() - started,
      detalhes: { alvos, resultados },
    });
    return NextResponse.json({ ok: true, resultados });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun({
      job: "sync-chip",
      ok: false,
      durationMs: Date.now() - started,
      erro: message,
      detalhes: { alvos, resultados },
    });
    return NextResponse.json(
      { ok: false, error: message, resultados },
      { status: 500 },
    );
  }
}
