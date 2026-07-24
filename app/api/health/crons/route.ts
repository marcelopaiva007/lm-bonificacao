// Health check dos crons: resumo da última execução de cada job + se algum está
// atrasado ou falhou. Lê a tabela cron_run (alimentada por lib/cron-observability).
//
// Protegido pelo mesmo secret dos crons, pois expõe mensagens de erro
// operacionais:
//   - Authorization: Bearer $CRON_SECRET  (o mesmo que o Vercel Cron envia), ou
//   - ?secret=$SYNC_ELLEVEN_SECRET  /  header x-sync-secret  (disparo manual).
//
// Status HTTP: 200 se tudo ok; 503 se algum job falhou ou está atrasado — assim
// um monitor de uptime externo consegue alertar sem interpretar o corpo.
import { NextRequest, NextResponse } from "next/server";
import { getCronHealth } from "@/lib/cron-observability";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`)
    return true;
  const manualSecret = process.env.SYNC_ELLEVEN_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") || req.headers.get("x-sync-secret");
  if (manualSecret && provided === manualSecret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobs = await getCronHealth();
    const comFalha = jobs.filter((j) => j.ok === false).map((j) => j.job);
    const atrasados = jobs.filter((j) => j.atrasado).map((j) => j.job);
    const saudavel = comFalha.length === 0 && atrasados.length === 0;

    return NextResponse.json(
      {
        ok: saudavel,
        geradoEm: new Date().toISOString(),
        resumo: { total: jobs.length, comFalha, atrasados },
        jobs,
      },
      { status: saudavel ? 200 : 503 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `Falha ao ler saúde dos crons: ${message}` },
      { status: 500 },
    );
  }
}
