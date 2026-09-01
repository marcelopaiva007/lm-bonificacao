import "server-only";
import { prisma } from "@/lib/prisma";
import { recalcularFechamento } from "@/lib/bonificacao";
import { matchFuncionario } from "@/lib/vendedor-match";
import {
  fetchRankingVendedores,
  periodoParaMesAno,
  type DashboardRankingVendedor,
} from "@/lib/movel-dashboard-api";

// Importação das vendas de chip do L&M Móvel via API EXTERNA agregada
// (https://movel.assinelm.com/api/v1/vendas/dashboard). Substituiu, em ago/2026,
// o antigo sync por login+JWT que puxava as vendas linha a linha
// (/vendas/sales) — a API externa é autenticada por um token estático
// (MOVEL_DASHBOARD_TOKEN), estável, e não quebra quando a senha da plataforma
// muda. O cliente HTTP tipado está em lib/movel-dashboard-api.ts.
//
// TRADE-OFFS desta fonte agregada (assumidos na decisão de troca):
//  - O ranking identifica o vendedor só pelo NOME (sem CPF): o casamento com o
//    cadastro de Funcionários é por nome (matchFuncionario cai direto no nome).
//  - Não há separação aprovado × cancelado por vendedor: usamos `linhas` como
//    a quantidade que gera bônus. ⚠️ ISSO ASSUME QUE `linhas` JÁ EXCLUI as
//    vendas canceladas no mês. Se o L&M Móvel contar canceladas em `linhas`, o
//    bônus paga a mais — CONFIRMAR a semântica com o time do Móvel.
//  - Sem detalhe por venda (ICCID, cliente, plano por vendedor).
//
// Fluxo (syncChipMovel): fetch ranking-vendedores -> snapshot agregado em
// chip_movel_ranking -> casamento com o cadastro -> regrava os LancamentoVenda
// de origem CHIP_MOVEL do período (quantidade = linhas) -> recalcularFechamento.
// O cálculo do bônus continua 100% pelas regras LOCAIS. Rodar mais de uma vez
// no mesmo mês não duplica nada (snapshot regravado + lançamentos regravados).
//
// Variáveis de ambiente:
//   MOVEL_DASHBOARD_TOKEN — token Bearer da API externa
//   MOVEL_API_BASE — opcional (default https://movel.assinelm.com/api)

// Valor de `origem` dos lançamentos gerados por esta importação. Os lançamentos
// desse período+origem são regravados a cada sync — nunca misturar com origem
// MANUAL/IMPORTADO, que são preservados.
export const ORIGEM_CHIP_MOVEL = "CHIP_MOVEL";

// Snapshot agregado por vendedor (uma linha por vendedor/período). Substitui o
// antigo venda_chip_movel (linha a linha), que deixou de ser alimentado. Mesmo
// padrão de ensure-table sob demanda dos demais (o build não roda migrate).
let chipRankingTableEnsured = false;
export async function ensureChipRankingTable(): Promise<void> {
  if (chipRankingTableEnsured) return;
  // Schema-qualificado desde o cutover de 24/07/2026: sem o prefixo, o
  // IF NOT EXISTS checaria só o search_path (public) e criaria uma tabela
  // duplicada vazia lá, ignorando a real em "bonificacao".
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "bonificacao"."chip_movel_ranking" (
      "id" SERIAL NOT NULL,
      "periodo" TEXT NOT NULL,
      "sellerNome" TEXT NOT NULL,
      "posicao" INTEGER,
      "linhas" INTEGER NOT NULL DEFAULT 0,
      "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "chip_movel_ranking_pkey" PRIMARY KEY ("id")
    );`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "chip_movel_ranking_periodo_seller_key" ON "bonificacao"."chip_movel_ranking"("periodo", "sellerNome");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "chip_movel_ranking_periodo_idx" ON "bonificacao"."chip_movel_ranking"("periodo");`,
  );
  chipRankingTableEnsured = true;
}

export type ChipRankingRow = {
  sellerNome: string;
  posicao: number | null;
  linhas: number;
  valor: number;
  syncedAt: Date;
};

// Lê o snapshot agregado do período. Usado pelo preview e pela conferência
// (batimento) em lib/conferencia.ts, que passou a somar `linhas` por vendedor
// em vez de contar vendas linha a linha.
export async function lerRankingChip(
  periodo: string,
): Promise<ChipRankingRow[]> {
  await ensureChipRankingTable();
  return prisma.$queryRawUnsafe<ChipRankingRow[]>(
    `SELECT "sellerNome", "posicao", "linhas", "valor", "syncedAt"
       FROM "bonificacao"."chip_movel_ranking"
      WHERE "periodo" = $1
      ORDER BY "linhas" DESC`,
    periodo,
  );
}

export type LinhaChipMovel = {
  sellerNome: string;
  sellerCpf: string | null; // sempre null nesta fonte (API externa não traz CPF)
  funcionarioId: string | null;
  funcionarioNome: string | null;
  quantidade: number;
  aprovado: number;
  cancelado: number;
};

export type ResumoAplicacaoChip = {
  aplicado: boolean;
  motivo?: string;
  linhas: LinhaChipMovel[];
  lancamentosGravados: number;
  naoMapeados: string[];
};

// Casa o ranking salvo do período com o cadastro de Funcionários (por nome).
async function agregarPorVendedor(periodo: string): Promise<LinhaChipMovel[]> {
  const [ranking, funcionarios] = await Promise.all([
    lerRankingChip(periodo),
    prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, cpf: true },
    }),
  ]);

  const linhas: LinhaChipMovel[] = ranking.map((r) => {
    const match = matchFuncionario(funcionarios, {
      nome: r.sellerNome,
      cpf: null,
    });
    // `linhas` é assumido como as vendas que geram bônus (aprovadas); a fonte
    // agregada não separa canceladas por vendedor, então cancelado = 0.
    return {
      sellerNome: r.sellerNome,
      sellerCpf: null,
      funcionarioId: match?.id ?? null,
      funcionarioNome: match?.nome ?? null,
      quantidade: r.linhas,
      aprovado: r.linhas,
      cancelado: 0,
    };
  });
  linhas.sort((a, b) => b.quantidade - a.quantidade);
  return linhas;
}

// Preview para a tela de conferência (não grava nada).
export async function previewChipMovel(periodo: string) {
  const linhas = await agregarPorVendedor(periodo);
  const agg = await prisma.$queryRawUnsafe<
    { total: bigint | number | null; ultima: Date | null }[]
  >(
    `SELECT COALESCE(SUM("linhas"), 0) AS total, MAX("syncedAt") AS ultima
       FROM "bonificacao"."chip_movel_ranking"
      WHERE "periodo" = $1`,
    periodo,
  );
  return {
    linhas,
    totalVendas: Number(agg[0]?.total ?? 0),
    ultimaSync: agg[0]?.ultima ?? null,
  };
}

// Regrava os lançamentos CHIP_MOVEL do período a partir do snapshot e recalcula
// o fechamento. Mês FECHADO não é alterado.
export async function aplicarLancamentosChip(
  periodo: string,
): Promise<ResumoAplicacaoChip> {
  const linhas = await agregarPorVendedor(periodo);
  const naoMapeados = linhas
    .filter((l) => !l.funcionarioId)
    .map((l) => l.sellerNome);

  const fechamento = await prisma.fechamentoMensal.findUnique({
    where: { periodo },
  });
  if (fechamento?.status === "FECHADO") {
    return {
      aplicado: false,
      motivo: `Mês ${periodo} já está FECHADO — lançamentos não alterados.`,
      linhas,
      lancamentosGravados: 0,
      naoMapeados,
    };
  }

  const mapeadas = linhas.filter(
    (l): l is LinhaChipMovel & { funcionarioId: string } =>
      Boolean(l.funcionarioId),
  );

  await prisma.$transaction(async (tx) => {
    await tx.lancamentoVenda.deleteMany({
      where: { periodo, origem: ORIGEM_CHIP_MOVEL },
    });
    if (mapeadas.length > 0) {
      // Só a quantidade de chips gera bônus (meta 15 -> R$5/venda); valores
      // monetários ficam zerados de propósito — o preço do plano é receita
      // recorrente, não "valor instalado", e não pode vazar para a regra de
      // 50% de demais serviços do Atendimento/ADM.
      await tx.lancamentoVenda.createMany({
        data: mapeadas.map((l) => ({
          funcionarioId: l.funcionarioId,
          periodo,
          quantidade: l.quantidade,
          aprovado: l.aprovado,
          cancelado: l.cancelado,
          qtdChip: l.aprovado,
          origem: ORIGEM_CHIP_MOVEL,
        })),
      });
    }
  });

  await recalcularFechamento(periodo);

  return {
    aplicado: true,
    linhas,
    lancamentosGravados: mapeadas.length,
    naoMapeados,
  };
}

export type ResultadoSyncChip = {
  ok: boolean;
  periodo: string;
  vendasSalvas: number;
  aplicacao: ResumoAplicacaoChip | null;
  log: string[];
};

// Regrava o snapshot agregado do período a partir do ranking da API externa.
async function salvarRanking(
  periodo: string,
  ranking: DashboardRankingVendedor[],
): Promise<number> {
  await ensureChipRankingTable();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM "bonificacao"."chip_movel_ranking" WHERE "periodo" = $1`,
      periodo,
    );
    for (const r of ranking) {
      const nome = (r.vendedor || "").trim();
      if (!nome) continue;
      await tx.$executeRawUnsafe(
        `INSERT INTO "bonificacao"."chip_movel_ranking"
           ("periodo", "sellerNome", "posicao", "linhas", "valor")
         VALUES ($1, $2, $3, $4, $5)`,
        periodo,
        nome,
        r.posicao ?? null,
        r.linhas ?? 0,
        r.valor ?? 0,
      );
    }
  });
  return ranking.length;
}

// Sincroniza um mês: busca o ranking na API externa, regrava o snapshot do
// período e aplica os lançamentos. Usado pelo cron diário e pelo botão
// "Sincronizar agora" da tela de conferência.
export async function syncChipMovel(
  year: number,
  month: number,
): Promise<ResultadoSyncChip> {
  const periodo = `${year}-${String(month).padStart(2, "0")}`;
  const log: string[] = [];
  const step = (s: string) => {
    const line = `[${new Date().toISOString()}] ${s}`;
    log.push(line);
    console.log(line);
  };

  const { mes, ano } = periodoParaMesAno(periodo);

  step(`Buscando ranking de ${periodo} na API externa do L&M Móvel...`);
  const ranking = await fetchRankingVendedores(mes, ano);
  step(`${ranking.length} vendedor(es) no ranking.`);

  const salvos = await salvarRanking(periodo, ranking);
  step(`Ranking de ${periodo} salvo no snapshot.`);

  step("Aplicando lançamentos de chip...");
  const aplicacao = await aplicarLancamentosChip(periodo);
  if (aplicacao.aplicado) {
    step(
      `${aplicacao.lancamentosGravados} lançamento(s) gravados; ${aplicacao.naoMapeados.length} vendedor(es) não mapeado(s).`,
    );
  } else {
    step(aplicacao.motivo || "Aplicação não realizada.");
  }
  if (aplicacao.naoMapeados.length > 0) {
    step(`Não mapeados: ${aplicacao.naoMapeados.join(", ")}`);
  }

  return {
    ok: true,
    periodo,
    vendasSalvas: salvos,
    aplicacao,
    log,
  };
}
