/**
 * Cadastra no banco as regras dos cargos criados em 08/08/2026 — TECNICO,
 * VENDEDOR_AGREGADO e RESPONSAVEL_SETOR — com vigência a partir de 01/08/2026
 * (mês corrente, ABERTO).
 *
 * Idempotente: cargo que já tem QUALQUER regra é pulado, para nunca
 * sobrescrever uma vigência criada pela tela de Regras.
 *
 * Uso: DATABASE_URL="..." npx tsx scripts/seed-regras-novos-cargos.ts
 * (ou com .env na raiz contendo DATABASE_URL)
 */
import fs from "fs";
import { Client } from "pg";
import { REGRAS_DEFAULT } from "../lib/regras-defaults";

const CARGOS_NOVOS = ["TECNICO", "VENDEDOR_AGREGADO", "RESPONSAVEL_SETOR"] as const;
const VIGENCIA_INICIO = "2026-08-01T00:00:00.000Z";

function resolverDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  const m = env.match(/^DATABASE_URL="?([^"\n\r]+)"?/m);
  if (!m) throw new Error("DATABASE_URL não encontrada (env nem .env).");
  return m[1];
}

async function main() {
  const client = new Client({ connectionString: resolverDatabaseUrl() });
  await client.connect();

  for (const cargo of CARGOS_NOVOS) {
    const config = REGRAS_DEFAULT[cargo];
    if (!config) throw new Error(`Sem default para ${cargo} em regras-defaults.`);

    const { rows } = await client.query(
      `SELECT id FROM bonificacao."RegraBonificacao" WHERE cargo = $1 LIMIT 1`,
      [cargo],
    );
    if (rows.length > 0) {
      console.log(`${cargo}: já tem regra cadastrada — pulando.`);
      continue;
    }

    await client.query(
      `INSERT INTO bonificacao."RegraBonificacao"
         (id, cargo, "vigenciaInicio", "vigenciaFim", config, observacoes)
       VALUES (
         'regra_' || substr(md5(random()::text), 1, 20),
         $1, $2::timestamp, NULL, $3::jsonb, $4
       )`,
      [
        cargo,
        VIGENCIA_INICIO,
        JSON.stringify(config),
        "Regra inicial definida pela diretoria em 08/08/2026 (cadastrada por script).",
      ],
    );
    console.log(`${cargo}: regra criada, vigente desde 01/08/2026.`);
  }

  const { rows: confer } = await client.query(
    `SELECT cargo, "vigenciaInicio", config IS NOT NULL AS tem_config
       FROM bonificacao."RegraBonificacao"
      WHERE cargo = ANY($1) ORDER BY cargo`,
    [[...CARGOS_NOVOS]],
  );
  console.log("\nConferência no banco:");
  for (const r of confer)
    console.log(
      `  ${r.cargo} | desde ${new Date(r.vigenciaInicio).toISOString().slice(0, 10)} | config: ${r.tem_config}`,
    );

  await client.end();
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
