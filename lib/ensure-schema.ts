import "server-only";
import { prisma } from "@/lib/prisma";

// Garante que colunas e tabelas essenciais para usuários, empresas, escopos
// e recuperação de senhas existam sob demanda (idempotente).
let schemaEnsured = false;

export async function ensureAuthAndUserSchema(): Promise<void> {
  if (schemaEnsured) return;
  try {
    // 1. Colunas do Funcionário
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Funcionario" ADD COLUMN IF NOT EXISTS "email" TEXT;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Funcionario" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;`
    );

    // 2. Colunas do Usuário
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cpf" TEXT;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN DEFAULT true;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN DEFAULT false;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);`
    );

    // 3. Colunas da Empresa
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "razaoSocial" TEXT;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "marca" TEXT;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Empresa" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;`
    );

    // 4. Tabela UserEmpresaScope
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserEmpresaScope" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "empresaId" TEXT NOT NULL,
        "nivelAcesso" TEXT NOT NULL DEFAULT 'OPERADOR',
        "modulosPermitidos" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserEmpresaScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "UserEmpresaScope_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UserEmpresaScope_userId_empresaId_key" ON "UserEmpresaScope"("userId", "empresaId");
    `);

    // 5. Tabela PasswordResetToken
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "usedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
    `);

    schemaEnsured = true;
  } catch (err) {
    console.error("Erro ao garantir schema de autenticação e usuários:", err);
    schemaEnsured = true;
  }
}

export async function ensureFuncionarioContato(): Promise<void> {
  return ensureAuthAndUserSchema();
}
