import "server-only";
import { prisma } from "@/lib/prisma";
import { garantirEstrutura } from "@/lib/ddl";
import { registrarAlteracao } from "@/lib/auditoria";
import { periodoLabel } from "@/lib/periodo";

// Metas por pessoa e por equipe.
//
// Até aqui "meta" era só a próxima faixa da regra do cargo — igual para todo
// mundo. Não dava para exigir mais de um vendedor experiente, nem definir meta
// de equipe, nem mudar de mês para mês.
//
// Estas metas NÃO alteram o cálculo da bonificação. Isso é deliberado: a
// bonificação segue a Ordem de Serviço e a regra vigente; a meta é instrumento
// de gestão — serve para acompanhar, cobrar e comparar. Misturar as duas coisas
// faria uma meta digitada errado virar dinheiro pago errado.

export type AlvoMeta = "FUNCIONARIO" | "EQUIPE";

export type Meta = {
  id: number;
  periodo: string;
  alvo: AlvoMeta;
  alvoId: string;
  alvoNome: string;
  metaInternet: number;
  metaChip: number;
  observacao: string | null;
};

let tabelaGarantida = false;
export async function ensureMetaTable(): Promise<void> {
  if (tabelaGarantida) return;
  await garantirEstrutura([`CREATE TABLE IF NOT EXISTS "bonificacao"."meta_periodo" (
      "id" SERIAL NOT NULL,
      "periodo" TEXT NOT NULL,
      "alvo" TEXT NOT NULL,
      "alvoId" TEXT NOT NULL,
      "metaInternet" INTEGER NOT NULL DEFAULT 0,
      "metaChip" INTEGER NOT NULL DEFAULT 0,
      "observacao" TEXT,
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "meta_periodo_pkey" PRIMARY KEY ("id")
    );`]);
  await garantirEstrutura([`CREATE UNIQUE INDEX IF NOT EXISTS "meta_periodo_chave_key"
     ON "bonificacao"."meta_periodo"("periodo", "alvo", "alvoId");`]);
  tabelaGarantida = true;
}

type LinhaMetaBruta = {
  id: number;
  periodo: string;
  alvo: string;
  alvoId: string;
  metaInternet: number;
  metaChip: number;
  observacao: string | null;
};

/**
 * Metas do período, já com o nome de quem elas cobram.
 *
 * O nome vem por junção em memória e não por SQL: a tabela vive fora do modelo
 * do Prisma (mesmo motivo das outras — ausência dela não pode derrubar outra
 * consulta), então não há relação declarada para o Prisma resolver.
 */
export async function listarMetas(periodo: string): Promise<Meta[]> {
  await ensureMetaTable();

  const linhas = await prisma.$queryRaw<LinhaMetaBruta[]>`
    SELECT "id", "periodo", "alvo", "alvoId", "metaInternet", "metaChip", "observacao"
    FROM "bonificacao"."meta_periodo"
    WHERE "periodo" = ${periodo}
  `;
  if (linhas.length === 0) return [];

  const idsFuncionario = linhas.filter((l) => l.alvo === "FUNCIONARIO").map((l) => l.alvoId);
  const idsEquipe = linhas.filter((l) => l.alvo === "EQUIPE").map((l) => l.alvoId);

  const [funcionarios, equipes] = await Promise.all([
    idsFuncionario.length
      ? prisma.funcionario.findMany({
          where: { id: { in: idsFuncionario } },
          select: { id: true, nome: true },
        })
      : Promise.resolve([]),
    idsEquipe.length
      ? prisma.equipe.findMany({
          where: { id: { in: idsEquipe } },
          select: { id: true, nome: true },
        })
      : Promise.resolve([]),
  ]);

  const nomes = new Map<string, string>();
  for (const f of funcionarios) nomes.set(`FUNCIONARIO|${f.id}`, f.nome);
  for (const e of equipes) nomes.set(`EQUIPE|${e.id}`, e.nome);

  return linhas
    .map((l) => ({
      id: l.id,
      periodo: l.periodo,
      alvo: l.alvo as AlvoMeta,
      alvoId: l.alvoId,
      // Alvo apagado depois de a meta ser criada não some da lista: some o nome,
      // e fica visível que há uma meta órfã para limpar.
      alvoNome: nomes.get(`${l.alvo}|${l.alvoId}`) ?? "(removido do cadastro)",
      metaInternet: l.metaInternet,
      metaChip: l.metaChip,
      observacao: l.observacao,
    }))
    .sort((a, b) => a.alvoNome.localeCompare(b.alvoNome, "pt-BR"));
}

export async function definirMeta(input: {
  periodo: string;
  alvo: AlvoMeta;
  alvoId: string;
  alvoNome: string;
  metaInternet: number;
  metaChip: number;
  observacao?: string | null;
  usuarioId: string;
  usuarioNome: string;
}): Promise<void> {
  await ensureMetaTable();

  await prisma.$executeRaw`
    INSERT INTO "bonificacao"."meta_periodo"
      ("periodo", "alvo", "alvoId", "metaInternet", "metaChip", "observacao")
    VALUES (
      ${input.periodo}, ${input.alvo}, ${input.alvoId},
      ${input.metaInternet}, ${input.metaChip}, ${input.observacao ?? null}
    )
    ON CONFLICT ("periodo", "alvo", "alvoId") DO UPDATE SET
      "metaInternet" = EXCLUDED."metaInternet",
      "metaChip" = EXCLUDED."metaChip",
      "observacao" = EXCLUDED."observacao"
  `;

  await registrarAlteracao({
    acao: "META_DEFINIDA",
    usuarioId: input.usuarioId,
    usuarioNome: input.usuarioNome,
    alvo: input.alvoNome,
    periodo: input.periodo,
    resumo:
      `Definiu meta de ${input.alvoNome} em ${periodoLabel(input.periodo)}: ` +
      `${input.metaInternet} internet, ${input.metaChip} chip.`,
    depois: { metaInternet: input.metaInternet, metaChip: input.metaChip },
  });
}

export async function removerMeta(id: number): Promise<void> {
  await ensureMetaTable();
  await prisma.$executeRaw`DELETE FROM "bonificacao"."meta_periodo" WHERE "id" = ${id}`;
}

export type ProgressoMeta = {
  alvoNome: string;
  alvo: AlvoMeta;
  metaInternet: number;
  metaChip: number;
  internet: number;
  chip: number;
  /** Percentual da meta de internet, 0–999. Sem meta definida, null. */
  percentualInternet: number | null;
  percentualChip: number | null;
};

/**
 * Progresso de cada meta do período contra as vendas já sincronizadas.
 *
 * Equipe soma os membros ativos mais o supervisor — mesma composição que o
 * cálculo do bônus de supervisor usa, para os dois números não se contradizerem
 * na tela.
 */
export async function progressoDasMetas(periodo: string): Promise<ProgressoMeta[]> {
  const metas = await listarMetas(periodo);
  if (metas.length === 0) return [];

  const [lancamentos, equipes] = await Promise.all([
    prisma.lancamentoVenda.findMany({
      where: { periodo },
      select: { funcionarioId: true, qtdInternet: true, qtdChip: true },
    }),
    prisma.equipe.findMany({
      include: { membros: { where: { ativo: true }, select: { id: true } } },
    }),
  ]);

  const porFuncionario = new Map<string, { internet: number; chip: number }>();
  for (const l of lancamentos) {
    const atual = porFuncionario.get(l.funcionarioId) ?? { internet: 0, chip: 0 };
    atual.internet += l.qtdInternet;
    atual.chip += l.qtdChip;
    porFuncionario.set(l.funcionarioId, atual);
  }

  const membrosDaEquipe = new Map<string, string[]>();
  for (const e of equipes) {
    const ids = new Set(e.membros.map((m) => m.id));
    if (e.supervisorId) ids.add(e.supervisorId);
    membrosDaEquipe.set(e.id, [...ids]);
  }

  const pct = (feito: number, meta: number) =>
    meta > 0 ? Math.min(Math.round((feito / meta) * 100), 999) : null;

  return metas.map((m) => {
    let internet = 0;
    let chip = 0;

    if (m.alvo === "FUNCIONARIO") {
      const v = porFuncionario.get(m.alvoId);
      internet = v?.internet ?? 0;
      chip = v?.chip ?? 0;
    } else {
      for (const id of membrosDaEquipe.get(m.alvoId) ?? []) {
        const v = porFuncionario.get(id);
        internet += v?.internet ?? 0;
        chip += v?.chip ?? 0;
      }
    }

    return {
      alvoNome: m.alvoNome,
      alvo: m.alvo,
      metaInternet: m.metaInternet,
      metaChip: m.metaChip,
      internet,
      chip,
      percentualInternet: pct(internet, m.metaInternet),
      percentualChip: pct(chip, m.metaChip),
    };
  });
}
