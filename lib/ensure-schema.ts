import "server-only";
import { garantirEstrutura } from "@/lib/ddl";

// Garante que as colunas extras do Funcionário existam antes de ler/gravar.
// Mesmo padrão do ensureRelatorioTable do sync-elleven: o build não roda
// `prisma migrate deploy` e a migração não é aplicada à mão, então criamos as
// colunas sob demanda (idempotente, ADD COLUMN IF NOT EXISTS). Roda uma vez por
// processo.
//
// ⚠️ REGRA: todo ponto de entrada que lê Funcionario SEM usuário logado precisa
// chamar isto primeiro. Páginas autenticadas já ganham de graça pelo
// requireUser; as rotas de cron NÃO — e o Prisma seleciona todas as colunas do
// modelo em qualquer findMany, então uma coluna ausente derruba a query inteira,
// não só o campo novo. Foi assim que a inclusão de `recebeAlertaTecnico` quebrou
// a importação do funil em produção (06/08/2026): a coluna existia no schema,
// não no banco, e o cron nunca passava por aqui.
let funcionarioContatoEnsured = false;
export async function ensureFuncionarioContato(): Promise<void> {
  if (funcionarioContatoEnsured) return;
  // Schema-qualificado desde o cutover de 24/07/2026 (Funcionario vive em
  // "bonificacao"): SQL cru não passa pelo mapeamento @@schema do Prisma, e sem
  // qualificar o Postgres resolveria pelo search_path (public) — criando/alterando
  // a tabela errada em silêncio.
  await garantirEstrutura([`ALTER TABLE "bonificacao"."Funcionario" ADD COLUMN IF NOT EXISTS "email" TEXT;`]);
  await garantirEstrutura([`ALTER TABLE "bonificacao"."Funcionario" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;`]);
  // Quem recebe aviso quando uma automação falha. Mesmo padrão das colunas
  // acima: sem DEFAULT o Prisma leria NULL num campo Boolean não-anulável.
  await garantirEstrutura([`ALTER TABLE "bonificacao"."Funcionario" ADD COLUMN IF NOT EXISTS "recebeAlertaTecnico" BOOLEAN NOT NULL DEFAULT false;`]);
  funcionarioContatoEnsured = true;
}
