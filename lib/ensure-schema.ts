import "server-only";

// O schema é gerenciado exclusivamente via Prisma (prisma/schema.prisma),
// aplicado manualmente com `npm run db:push` ou `prisma migrate deploy`.
// NUNCA reative DDLs (ALTER/CREATE TABLE) em tempo de execução: cada cold start
// executava os ALTERs em tabelas quentes (User, Empresa, Funcionario), pegando
// locks ACCESS EXCLUSIVE no PostgreSQL que enfileiravam todas as queries e
// derrubavam o site inteiro sob tráfego simultâneo.
export async function ensureAuthAndUserSchema(): Promise<void> {
  return Promise.resolve();
}

export async function ensureFuncionarioContato(): Promise<void> {
  return Promise.resolve();
}
