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

function getPrisma(): PrismaClient {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }
  return globalThis.prismaGlobal;
}

/**
 * O cliente só é criado na PRIMEIRA consulta, não ao carregar o módulo.
 *
 * Sem isso, `next build` quebra em qualquer máquina sem DATABASE_URL: ele
 * carrega as rotas para coletar dados das páginas, o módulo instancia o Prisma
 * na importação e o erro estoura antes de qualquer código rodar. Na Vercel
 * passava despercebido — lá a variável existe no build.
 *
 * Adiando a criação, o build funciona em qualquer lugar e a falta da variável
 * aparece onde importa: na primeira consulta, com a mensagem que diz o que fazer.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, prop, receptor) {
    return Reflect.get(getPrisma(), prop, receptor);
  },
  has(_alvo, prop) {
    return Reflect.has(getPrisma(), prop);
  },
});
