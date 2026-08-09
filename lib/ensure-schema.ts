import "server-only";

// As colunas de contato do Funcionário (email, telegramChatId) já estão no schema do Prisma
// e foram aplicadas via migration no PostgreSQL. Esta função é mantida por compatibilidade de API.
export async function ensureFuncionarioContato(): Promise<void> {
  return;
}
