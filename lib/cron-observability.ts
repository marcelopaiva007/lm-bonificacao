import "server-only";
import { prisma } from "@/lib/prisma";

// Observabilidade dos crons: grava o resultado de cada execução em "cron_run" e
// expõe um resumo de saúde por job. Segue o mesmo padrão do ensureRelatorioTable
// do sync-elleven — a tabela é criada sob demanda (CREATE TABLE IF NOT EXISTS),
// porque o build não roda `prisma migrate deploy` e as migrações não são
// aplicadas à mão neste projeto. Assim, nada aqui depende de mexer no
// schema.prisma nem no fluxo de migrations.

// Jobs esperados (espelham vercel.json). `maxIdadeHoras` = quanto tempo sem
// rodar até considerarmos o job "atrasado" (todos são diários → 24h + folga).
export const CRON_JOBS = [
  { job: "sync-elleven:ativacao-contratos", label: "Elleven — Ativação Contratos", maxIdadeHoras: 26 },
  { job: "sync-elleven:vendedores-comercial", label: "Elleven — Vendedores Comercial", maxIdadeHoras: 26 },
  { job: "sync-elleven:funil-de-vendas", label: "Elleven — Funil de Vendas", maxIdadeHoras: 26 },
  { job: "sync-elleven:pedidos-de-venda", label: "Elleven — Pedidos de Venda", maxIdadeHoras: 26 },
  { job: "sync-chip", label: "Vendas de Chip (L&M Móvel)", maxIdadeHoras: 26 },
  { job: "cobranca-metas", label: "Cobrança de Metas", maxIdadeHoras: 26 },
] as const;

let cronRunTableEnsured = false;
export async function ensureCronRunTable(): Promise<void> {
  if (cronRunTableEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "cron_run" (
      "id" SERIAL NOT NULL,
      "job" TEXT NOT NULL,
      "ok" BOOLEAN NOT NULL,
      "durationMs" INTEGER,
      "detalhes" JSONB,
      "erro" TEXT,
      "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "cron_run_pkey" PRIMARY KEY ("id")
    );`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "cron_run_job_finishedAt_idx" ON "cron_run"("job", "finishedAt" DESC);`,
  );
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
      INSERT INTO "cron_run" ("job", "ok", "durationMs", "detalhes", "erro")
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
     FROM "cron_run"
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
