import "server-only";
import { prisma } from "@/lib/prisma";

// Garante que colunas e tabelas essenciais para usuários, empresas, escopos
// e recuperação de senhas existam sob demanda (idempotente).
// O schema é gerenciado via Prisma (prisma/schema.prisma).
// Desativamos a execução de SQL DDLs (ALTER/CREATE TABLE) em tempo de execução
// para evitar locks de metadados no PostgreSQL e garantir máxima velocidade nas requisições.
let schemaEnsured = true;

export async function ensureAuthAndUserSchema(): Promise<void> {
  if (schemaEnsured) return;
  schemaEnsured = true;
}

export async function ensureFuncionarioContato(): Promise<void> {
  return Promise.resolve();
}
