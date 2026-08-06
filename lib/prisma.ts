import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// A conexão vem de DATABASE_URL — e SÓ dela.
//
// O projeto também tem 14 variáveis LM_BONIFICACAO_* (POSTGRES_URL, PGHOST,
// DATABASE_URL_UNPOOLED e companhia), criadas automaticamente pela integração
// do Neon. NENHUMA é lida aqui. Se um dia for preciso trocar de banco, é esta
// variável que muda; mexer nas prefixadas não tem efeito nenhum.
function createPrismaClient() {
  const url = process.env.DATABASE_URL;

  // Antes, faltando a variável, o código caía em "file:./prisma/dev.db". Esse
  // caminho nunca funcionou: o schema declara provider postgresql (com
  // multiSchema), e o Prisma recusa o adapter SQLite contra ele —
  // "not compatible with the provider `postgres`". Ou seja, o fallback só
  // trocava um erro claro por um erro confuso, e em produção teria feito o
  // sistema subir apontando para lugar nenhum.
  if (!url) {
    throw new Error(
      "DATABASE_URL não está definida.\n" +
        "Rode `vercel env pull .env.local` na raiz do projeto.\n" +
        "As variáveis LM_BONIFICACAO_* NÃO substituem esta — nenhuma delas é lida.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
