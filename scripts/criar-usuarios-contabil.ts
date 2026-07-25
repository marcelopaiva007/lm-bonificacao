// Cria os acessos do módulo contábil com senha provisória aleatória.
//
//   npx tsx scripts/criar-usuarios-contabil.ts
//
// A senha é gerada aqui e impressa uma única vez — anote e repasse pelo canal
// combinado. Quem recebe deve trocar em /conta no primeiro acesso.
// Idempotente no cadastro (não duplica usuário), mas SEMPRE gera senha nova:
// rodar de novo é a forma de resetar o acesso de quem esqueceu.
import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const USUARIOS = [
  { username: "mateus", nome: "Mateus", role: "CONTABIL" },
  // Marcelo é dono do sistema: ADMIN já enxerga Contabilidade + todo o resto.
  { username: "marcelo", nome: "Marcelo Paiva", role: "ADMIN" },
];

function senhaAleatoria(): string {
  return crypto.randomBytes(9).toString("base64url");
}

async function main() {
  for (const u of USUARIOS) {
    const senha = senhaAleatoria();
    const passwordHash = await bcrypt.hash(senha, 10);

    const existente = await prisma.user.findUnique({ where: { username: u.username } });
    await prisma.user.upsert({
      where: { username: u.username },
      create: { username: u.username, nome: u.nome, role: u.role, passwordHash },
      update: { nome: u.nome, role: u.role, passwordHash },
    });

    console.log(
      `${existente ? "ATUALIZADO" : "CRIADO"}  usuário: ${u.username}  senha: ${senha}  papel: ${u.role}`,
    );
  }

  console.log("\nTrocar a senha em /conta no primeiro acesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
