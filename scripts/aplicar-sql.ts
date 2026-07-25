// Aplica um arquivo .sql no banco (DATABASE_URL do .env).
//
// Existe porque este projeto NÃO usa `prisma migrate` contra produção — o DDL
// de prisma/migrations-manual/ é aplicado à mão (ver docs/MIGRACAO-BANCO.md).
//
//   npx tsx scripts/aplicar-sql.ts prisma/migrations-manual/03-contabil.sql
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error("Uso: npx tsx scripts/aplicar-sql.ts <caminho-do-arquivo.sql>");
    process.exit(1);
  }

  const sql = readFileSync(arquivo, "utf8");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // O arquivo já controla suas próprias transações (BEGIN/COMMIT).
    await client.query(sql);
    console.log(`OK — ${arquivo} aplicado.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
