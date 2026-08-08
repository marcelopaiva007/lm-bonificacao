import "server-only";

// Migrações de schema devem ser gerenciadas via Prisma Migrations (`prisma migrate`)
// ou scripts isolados de setup, e NUNCA executadas síncronamente a cada requisição
// de usuário ou servidor, pois causam Access Exclusive Locks e extrema lentidão no banco.

export async function ensureAuthAndUserSchema(): Promise<void> {
  return;
}

export async function ensureFuncionarioContato(): Promise<void> {
  return;
}
