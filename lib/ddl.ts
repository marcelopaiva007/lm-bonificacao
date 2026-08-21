import "server-only";
import { prisma } from "@/lib/prisma";

// Execução de DDL (CREATE TABLE / CREATE INDEX) tolerante a concorrência.
//
// `IF NOT EXISTS` NÃO é atômico no Postgres. Duas requisições simultâneas veem
// "não existe", as duas tentam criar, e uma falha com violação de unicidade no
// catálogo do banco. Aconteceu em produção em 06/08/2026: a tela de metas
// devolveu 500 na primeira vez que dois acessos coincidiram.
//
// Como o objetivo é só garantir que o objeto exista, "outro processo criou
// primeiro" é sucesso, não erro.

/** Erros que significam "o objeto já existe" — vindos do catálogo do Postgres. */
const JA_EXISTE = [
  "23505", // unique_violation (corrida no pg_class)
  "42P07", // duplicate_table
  "42P16", // invalid_table_definition (índice concorrente)
  "42710", // duplicate_object
];

function ehJaExiste(erro: unknown): boolean {
  const texto = String(
    (erro as { message?: string })?.message ?? erro ?? "",
  ).toLowerCase();
  if (JA_EXISTE.some((codigo) => texto.includes(codigo))) return true;
  return (
    texto.includes("already exists") ||
    texto.includes("duplicate key") ||
    texto.includes("já existe")
  );
}

/**
 * Roda uma sequência de comandos DDL, ignorando os que falham porque o objeto
 * já existe. Qualquer outro erro sobe — falha de permissão ou SQL inválido
 * precisa aparecer, não ser engolida junto.
 */
export async function garantirEstrutura(comandos: string[]): Promise<void> {
  for (const sql of comandos) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      if (ehJaExiste(e)) continue;
      throw e;
    }
  }
}
