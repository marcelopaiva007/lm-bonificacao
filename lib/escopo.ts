import "server-only";
import { prisma } from "@/lib/prisma";
import { escopoDoPapel } from "@/lib/permissoes";

// Quem cada pessoa logada pode enxergar.
//
// O login (User) e quem vende (Funcionario) são tabelas separadas e, até aqui,
// sem nenhuma ligação — não havia como responder "qual é a equipe DESTE
// supervisor". O vínculo mora numa tabela própria, criada sob demanda.
//
// Por que tabela separada em vez de uma coluna em User: o Prisma seleciona todas
// as colunas do modelo em qualquer consulta, e User é lido no `authorize()` do
// login. Uma coluna que existisse no schema e ainda não no banco derrubaria o
// login de TODO MUNDO até o próximo deploy — o mesmo erro que quebrou a
// importação do funil em 06/08/2026, só que num lugar sem volta. Com tabela
// separada e SQL cru, o login segue intocado.

let tabelaGarantida = false;
export async function ensureVinculoTable(): Promise<void> {
  if (tabelaGarantida) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "bonificacao"."usuario_funcionario" (
      "usuarioId" TEXT NOT NULL,
      "funcionarioId" TEXT NOT NULL,
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "usuario_funcionario_pkey" PRIMARY KEY ("usuarioId")
    );`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "usuario_funcionario_funcionarioId_idx" ON "bonificacao"."usuario_funcionario"("funcionarioId");`,
  );
  tabelaGarantida = true;
}

export async function vincularUsuarioAFuncionario(
  usuarioId: string,
  funcionarioId: string | null,
): Promise<void> {
  await ensureVinculoTable();
  if (!funcionarioId) {
    await prisma.$executeRaw`
      DELETE FROM "bonificacao"."usuario_funcionario" WHERE "usuarioId" = ${usuarioId}
    `;
    return;
  }
  await prisma.$executeRaw`
    INSERT INTO "bonificacao"."usuario_funcionario" ("usuarioId", "funcionarioId")
    VALUES (${usuarioId}, ${funcionarioId})
    ON CONFLICT ("usuarioId") DO UPDATE SET "funcionarioId" = ${funcionarioId}
  `;
}

export async function funcionarioDoUsuario(usuarioId: string): Promise<string | null> {
  await ensureVinculoTable();
  const linhas = await prisma.$queryRaw<{ funcionarioId: string }[]>`
    SELECT "funcionarioId" FROM "bonificacao"."usuario_funcionario"
    WHERE "usuarioId" = ${usuarioId}
    LIMIT 1
  `;
  return linhas[0]?.funcionarioId ?? null;
}

export async function listarVinculos(): Promise<Map<string, string>> {
  await ensureVinculoTable();
  const linhas = await prisma.$queryRaw<{ usuarioId: string; funcionarioId: string }[]>`
    SELECT "usuarioId", "funcionarioId" FROM "bonificacao"."usuario_funcionario"
  `;
  return new Map(linhas.map((l) => [l.usuarioId, l.funcionarioId]));
}

export type UsuarioLogado = { id: string; role: string };

// Ids de funcionários que a pessoa pode ver.
//
// `null` significa "todos" — e é diferente de lista vazia, que significa
// "nenhum". Confundir os dois é o tipo de engano que abre o sistema inteiro por
// acidente, então quem consome precisa tratar os dois casos explicitamente.
export async function idsVisiveisPara(user: UsuarioLogado): Promise<string[] | null> {
  const escopo = escopoDoPapel(user.role);
  if (escopo === "TUDO") return null;

  const meuFuncionarioId = await funcionarioDoUsuario(user.id);
  // Sem vínculo, a pessoa não é ninguém no cadastro de vendas: não vê nada. É
  // deliberadamente restritivo — um acesso mal configurado que mostrasse tudo
  // seria pior do que um que não mostra nada, porque passaria despercebido.
  if (!meuFuncionarioId) return [];

  if (escopo === "PROPRIO") return [meuFuncionarioId];

  // EQUIPE: membros ativos das equipes que a pessoa supervisiona, mais ela.
  const equipes = await prisma.equipe.findMany({
    where: { supervisorId: meuFuncionarioId },
    include: { membros: { where: { ativo: true }, select: { id: true } } },
  });

  const ids = new Set<string>([meuFuncionarioId]);
  for (const equipe of equipes) {
    for (const membro of equipe.membros) ids.add(membro.id);
  }
  return [...ids];
}

// Açúcar para montar filtros do Prisma: devolve `{}` quando vê tudo e
// `{ funcionarioId: { in: [...] } }` caso contrário.
export function filtroPorEscopo(ids: string[] | null): { funcionarioId?: { in: string[] } } {
  if (ids === null) return {};
  return { funcionarioId: { in: ids } };
}
