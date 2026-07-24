import "server-only";
import { prisma } from "@/lib/prisma";

// Garante que as colunas de contato do Funcionário (email, telegramChatId)
// existam antes de ler/gravar. Mesmo padrão do ensureRelatorioTable do
// sync-elleven: o build não roda `prisma migrate deploy` e a migração não é
// aplicada à mão, então criamos as colunas sob demanda (idempotente,
// ADD COLUMN IF NOT EXISTS). Roda uma vez por processo.
let funcionarioContatoEnsured = false;
export async function ensureFuncionarioContato(): Promise<void> {
  if (funcionarioContatoEnsured) return;
  // Schema-qualificado desde o cutover de 24/07/2026 (Funcionario vive em
  // "bonificacao"): SQL cru não passa pelo mapeamento @@schema do Prisma, e sem
  // qualificar o Postgres resolveria pelo search_path (public) — criando/alterando
  // a tabela errada em silêncio.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "bonificacao"."Funcionario" ADD COLUMN IF NOT EXISTS "email" TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "bonificacao"."Funcionario" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;`,
  );
  funcionarioContatoEnsured = true;
}
