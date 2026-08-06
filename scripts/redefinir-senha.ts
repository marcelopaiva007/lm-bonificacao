// Recuperação de acesso: lista os usuários do sistema e redefine a senha de um
// deles. Existe porque o sistema não tem "esqueci minha senha" — se o único
// admin perde o acesso, ninguém entra para consertar pela tela.
//
// A senha é digitada no terminal de quem roda o script e nunca aparece na tela,
// em log ou em argumento de linha de comando (argumento fica no histórico do
// shell e na lista de processos). Só o hash bcrypt vai para o banco.
//
// Uso:
//   npx tsx scripts/redefinir-senha.ts --listar
//   npx tsx scripts/redefinir-senha.ts <username>
//
// Precisa de DATABASE_URL apontando para o banco desejado. Para produção:
//   vercel env pull .env.local
//
// ⚠️ Isto altera a senha de uma pessoa real em produção. Confirme o username na
// listagem antes — o script só atualiza o passwordHash, não cria nem apaga nada.

import "dotenv/config";
import bcrypt from "bcryptjs";
import * as readline from "node:readline";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

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

// Lê uma linha sem ecoar o que é digitado. O terminal continua mostrando o
// prompt, mas os caracteres da senha não aparecem nem ficam no scrollback.
function perguntarOculto(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const saida = process.stdout as NodeJS.WriteStream & { muted?: boolean };
    const write = saida.write.bind(saida);
    saida.muted = false;
    // @ts-expect-error — readline usa _writeToOutput internamente para ecoar.
    rl._writeToOutput = (s: string) => {
      if (saida.muted) return;
      write(s);
    };
    rl.question(prompt, (resposta) => {
      saida.muted = false;
      write("\n");
      rl.close();
      resolve(resposta);
    });
    saida.muted = true;
  });
}

async function listar() {
  const usuarios = await prisma.user.findMany({
    select: { username: true, nome: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (usuarios.length === 0) {
    console.log("Nenhum usuário cadastrado no banco apontado por DATABASE_URL.");
    return;
  }

  console.log(`\n${usuarios.length} usuário(s):\n`);
  for (const u of usuarios) {
    const criado = u.createdAt.toISOString().slice(0, 10);
    console.log(`  ${u.username.padEnd(20)} ${u.role.padEnd(12)} ${u.nome}  (desde ${criado})`);
  }
  console.log("\nPara redefinir:  npx tsx scripts/redefinir-senha.ts <username>\n");
}

async function redefinir(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    console.error(
      `Não existe usuário "${username}".\n` +
        "Rode com --listar para ver os usernames exatos (maiúsculas e minúsculas contam).",
    );
    process.exit(1);
  }

  console.log(`\nRedefinindo a senha de: ${user.nome} (${user.username}, ${user.role})`);

  const senha = await perguntarOculto("Nova senha: ");
  if (senha.length < 8) {
    console.error("A senha precisa ter pelo menos 8 caracteres. Nada foi alterado.");
    process.exit(1);
  }

  const confirmacao = await perguntarOculto("Repita a senha: ");
  if (senha !== confirmacao) {
    console.error("As senhas não conferem. Nada foi alterado.");
    process.exit(1);
  }

  // 10 rounds: o mesmo custo usado em lib/actions/usuarios.ts e no seed. Mudar
  // aqui geraria hash que o login continua aceitando, mas fora do padrão do
  // resto do sistema.
  const passwordHash = await bcrypt.hash(senha, 10);
  await prisma.user.update({ where: { username }, data: { passwordHash } });

  console.log(`\nSenha de "${username}" redefinida. Já vale no próximo login.\n`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg || arg === "--listar" || arg === "-l") {
    await listar();
    return;
  }
  await redefinir(arg);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
