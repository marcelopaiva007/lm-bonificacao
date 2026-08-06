import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
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
const SQLITE_DEV = "file:./prisma/dev.db";

function createPrismaClient() {
  const url = process.env.DATABASE_URL;

  // Sem a variável, o comportamento antigo era cair no SQLite local em
  // silêncio. Em produção isso é pior que um erro: o sistema sobe, responde
  // normalmente e mostra tudo VAZIO — nenhuma venda, nenhuma bonificação — e o
  // cron grava num arquivo temporário que some a cada execução. Quem olhasse a
  // tela concluiria que os dados sumiram do banco. Melhor não subir.
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_URL não está definida. O sistema NÃO vai subir apontando para " +
          "um banco local vazio — cadastre a variável no ambiente de produção " +
          "(as variáveis LM_BONIFICACAO_* não substituem esta).",
      );
    }
    // Em desenvolvimento o banco local é o comportamento útil e esperado.
    return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: SQLITE_DEV }) });
  }

  const adapter = url.startsWith("postgres")
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url });

  return new PrismaClient({ adapter });
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
