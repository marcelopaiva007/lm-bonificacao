// Corrige o papel de acesso de um usuário direto no banco.
//
// Existe por causa de um bloqueio circular: quem perde o papel de ADMIN perde
// também a tela de Usuários, que é o único lugar onde o papel se altera. Sem
// isto, ninguém volta a ser administrador — nem o dono do sistema.
//
// Uso:
//   npx tsx scripts/definir-papel.ts --listar
//   npx tsx scripts/definir-papel.ts <username> ADMIN
//
// Precisa de DATABASE_URL apontando para o banco desejado:
//   vercel env pull .env.local

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Repetido aqui de propósito: o script roda fora do bundle da aplicação e não
// deve depender de alias "@/". Se lib/permissoes.ts ganhar um papel novo, some
// aqui também.
const PAPEIS = ["ADMIN", "DIRETORIA", "GERENTE", "SUPERVISOR", "VENDEDOR"] as const;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL não está definida.\n" +
      "Rode `vercel env pull .env.local` na raiz do projeto e tente de novo.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: url.startsWith("postgres")
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url }),
});

async function listar() {
  const usuarios = await prisma.user.findMany({
    select: { username: true, nome: true, role: true },
    orderBy: { role: "asc" },
  });

  if (usuarios.length === 0) {
    console.log("Nenhum usuário cadastrado no banco apontado por DATABASE_URL.");
    return;
  }

  const admins = usuarios.filter((u) => u.role === "ADMIN").length;

  console.log(`\n${usuarios.length} usuário(s):\n`);
  for (const u of usuarios) {
    console.log(`  ${u.username.padEnd(20)} ${u.role.padEnd(12)} ${u.nome}`);
  }

  if (admins === 0) {
    console.log(
      "\n⚠️  NENHUM usuário com papel ADMIN. Sem isso ninguém acessa cadastros,\n" +
        "    regras, lançamentos nem a própria tela de Usuários.\n" +
        "    Corrija com:  npx tsx scripts/definir-papel.ts <username> ADMIN\n",
    );
  } else {
    console.log(`\nPapéis disponíveis: ${PAPEIS.join(", ")}`);
    console.log("Alterar:  npx tsx scripts/definir-papel.ts <username> <PAPEL>\n");
  }
}

async function definir(username: string, papel: string) {
  const alvo = papel.toUpperCase();
  if (!(PAPEIS as readonly string[]).includes(alvo)) {
    console.error(`Papel inválido: "${papel}".\nUse um destes: ${PAPEIS.join(", ")}`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(
      `Não existe usuário "${username}".\n` +
        "Rode com --listar para ver os usernames exatos.",
    );
    process.exit(1);
  }

  if (user.role === alvo) {
    console.log(`"${username}" já é ${alvo}. Nada foi alterado.`);
    return;
  }

  await prisma.user.update({ where: { username }, data: { role: alvo } });
  console.log(
    `\n${user.nome} (${username}): ${user.role} → ${alvo}\n` +
      "Saia do sistema e entre de novo para o menu ser recarregado.\n",
  );
}

async function main() {
  const [arg1, arg2] = process.argv.slice(2);
  if (!arg1 || arg1 === "--listar" || arg1 === "-l") {
    await listar();
    return;
  }
  if (!arg2) {
    console.error(
      "Faltou o papel.\n  npx tsx scripts/definir-papel.ts <username> ADMIN",
    );
    process.exit(1);
  }
  await definir(arg1, arg2);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
