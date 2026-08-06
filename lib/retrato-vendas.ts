import "server-only";
import { prisma } from "@/lib/prisma";
import { garantirEstrutura } from "@/lib/ddl";

// Retrato diário das vendas: o que cada vendedor tinha, por período, a cada
// sincronização.
//
// Existe porque o sync APAGA e RECRIA os lançamentos do mês inteiro a cada
// rodada. Se uma venda sai do relatório do Elleven — negociação que deixou de
// ser "Ganha", correção do vendedor, valor alterado —, ela some sem deixar
// rastro: o número de ontem era outro e não havia como saber por quê. Numa
// operação que paga comissão sobre esses números, "sumiu e ninguém sabe" é o
// pior estado possível.
//
// Guardamos um retrato por (período, dia, funcionário). Rodar o sync duas vezes
// no mesmo dia atualiza o retrato daquele dia em vez de duplicar — o que
// interessa comparar é dia contra dia.
//
// Tabela criada sob demanda e fora do modelo do Prisma, como cron_run e
// registro_alteracao: assim a ausência dela nunca derruba outra consulta.

import { FUSO_BR } from "@/lib/periodo";

let tabelaGarantida = false;
export async function ensureRetratoTable(): Promise<void> {
  if (tabelaGarantida) return;
  await garantirEstrutura([`CREATE TABLE IF NOT EXISTS "bonificacao"."retrato_vendas" (
      "id" SERIAL NOT NULL,
      "periodo" TEXT NOT NULL,
      "dia" DATE NOT NULL,
      "funcionarioId" TEXT NOT NULL,
      "funcionarioNome" TEXT NOT NULL,
      "quantidade" INTEGER NOT NULL DEFAULT 0,
      "valorInstalado" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "qtdInternet" INTEGER NOT NULL DEFAULT 0,
      "qtdChip" INTEGER NOT NULL DEFAULT 0,
      "origem" TEXT NOT NULL,
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "retrato_vendas_pkey" PRIMARY KEY ("id")
    );`]);
  await garantirEstrutura([`CREATE UNIQUE INDEX IF NOT EXISTS "retrato_vendas_chave_key"
     ON "bonificacao"."retrato_vendas"("periodo", "dia", "funcionarioId", "origem");`]);
  await garantirEstrutura([`CREATE INDEX IF NOT EXISTS "retrato_vendas_periodo_dia_idx"
     ON "bonificacao"."retrato_vendas"("periodo", "dia" DESC);`]);
  tabelaGarantida = true;
}

/** Data de hoje no fuso de Brasília, como AAAA-MM-DD. */
function hojeBr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Fotografa o estado atual dos lançamentos do período.
 *
 * Chamado no fim de cada importação, DEPOIS de os lançamentos serem regravados.
 * Best-effort: falhar aqui não pode derrubar a importação — perder um retrato é
 * ruim, perder a sincronização das vendas é pior.
 */
export async function registrarRetrato(periodo: string): Promise<void> {
  try {
    await ensureRetratoTable();
    const dia = hojeBr();

    const lancamentos = await prisma.lancamentoVenda.findMany({
      where: { periodo },
      include: { funcionario: { select: { nome: true } } },
    });
    if (lancamentos.length === 0) return;

    // Agrupa por (funcionário, origem): a mesma pessoa pode ter lançamento do
    // Elleven e do chip, e misturá-los esconderia de qual fonte veio a mudança.
    const porChave = new Map<
      string,
      {
        funcionarioId: string;
        funcionarioNome: string;
        origem: string;
        quantidade: number;
        valorInstalado: number;
        qtdInternet: number;
        qtdChip: number;
      }
    >();

    for (const l of lancamentos) {
      const chave = `${l.funcionarioId}|${l.origem}`;
      const atual = porChave.get(chave) ?? {
        funcionarioId: l.funcionarioId,
        funcionarioNome: l.funcionario.nome,
        origem: l.origem,
        quantidade: 0,
        valorInstalado: 0,
        qtdInternet: 0,
        qtdChip: 0,
      };
      atual.quantidade += l.quantidade;
      atual.valorInstalado += l.valorInstalado;
      atual.qtdInternet += l.qtdInternet;
      atual.qtdChip += l.qtdChip;
      porChave.set(chave, atual);
    }

    for (const r of porChave.values()) {
      await prisma.$executeRaw`
        INSERT INTO "bonificacao"."retrato_vendas"
          ("periodo", "dia", "funcionarioId", "funcionarioNome",
           "quantidade", "valorInstalado", "qtdInternet", "qtdChip", "origem")
        VALUES (
          ${periodo}, ${dia}::date, ${r.funcionarioId}, ${r.funcionarioNome},
          ${r.quantidade}, ${r.valorInstalado}, ${r.qtdInternet}, ${r.qtdChip}, ${r.origem}
        )
        ON CONFLICT ("periodo", "dia", "funcionarioId", "origem") DO UPDATE SET
          "funcionarioNome" = EXCLUDED."funcionarioNome",
          "quantidade" = EXCLUDED."quantidade",
          "valorInstalado" = EXCLUDED."valorInstalado",
          "qtdInternet" = EXCLUDED."qtdInternet",
          "qtdChip" = EXCLUDED."qtdChip",
          "criadoEm" = CURRENT_TIMESTAMP
      `;
    }
  } catch (e) {
    console.error(`[retrato] falha ao registrar retrato de ${periodo}:`, e);
  }
}

export type LinhaRetrato = {
  funcionarioId: string;
  funcionarioNome: string;
  origem: string;
  quantidade: number;
  valorInstalado: number;
  qtdInternet: number;
  qtdChip: number;
};

export type MudancaVendas = {
  funcionarioNome: string;
  origem: string;
  tipo: "ENTROU" | "SUMIU" | "MUDOU";
  vendasAntes: number;
  vendasDepois: number;
  valorAntes: number;
  valorDepois: number;
};

/** Os dois dias mais recentes com retrato deste período. */
async function diasComRetrato(periodo: string): Promise<string[]> {
  const linhas = await prisma.$queryRaw<{ dia: Date }[]>`
    SELECT DISTINCT "dia" FROM "bonificacao"."retrato_vendas"
    WHERE "periodo" = ${periodo}
    ORDER BY "dia" DESC
    LIMIT 2
  `;
  return linhas.map((l) => new Date(l.dia).toISOString().slice(0, 10));
}

async function retratoDoDia(periodo: string, dia: string): Promise<LinhaRetrato[]> {
  return prisma.$queryRaw<LinhaRetrato[]>`
    SELECT "funcionarioId", "funcionarioNome", "origem",
           "quantidade", "valorInstalado", "qtdInternet", "qtdChip"
    FROM "bonificacao"."retrato_vendas"
    WHERE "periodo" = ${periodo} AND "dia" = ${dia}::date
  `;
}

/**
 * O que mudou entre os dois últimos retratos do período.
 *
 * Responde a pergunta que hoje não tem resposta: "por que o número de ontem era
 * outro?". Uma venda que SUMIU é o caso mais importante — é o que ninguém
 * percebe olhando só o total.
 */
export async function mudancasDesdeOntem(periodo: string): Promise<{
  diaAtual: string | null;
  diaAnterior: string | null;
  mudancas: MudancaVendas[];
}> {
  await ensureRetratoTable();
  const dias = await diasComRetrato(periodo);
  if (dias.length < 2) {
    return { diaAtual: dias[0] ?? null, diaAnterior: null, mudancas: [] };
  }

  const [diaAtual, diaAnterior] = dias;
  const [atual, anterior] = await Promise.all([
    retratoDoDia(periodo, diaAtual),
    retratoDoDia(periodo, diaAnterior),
  ]);

  const chave = (l: LinhaRetrato) => `${l.funcionarioId}|${l.origem}`;
  const mapaAnterior = new Map(anterior.map((l) => [chave(l), l]));
  const mapaAtual = new Map(atual.map((l) => [chave(l), l]));
  const mudancas: MudancaVendas[] = [];

  for (const linha of atual) {
    const antes = mapaAnterior.get(chave(linha));
    if (!antes) {
      mudancas.push({
        funcionarioNome: linha.funcionarioNome,
        origem: linha.origem,
        tipo: "ENTROU",
        vendasAntes: 0,
        vendasDepois: linha.quantidade,
        valorAntes: 0,
        valorDepois: linha.valorInstalado,
      });
    } else if (
      antes.quantidade !== linha.quantidade ||
      Math.abs(antes.valorInstalado - linha.valorInstalado) > 0.005
    ) {
      mudancas.push({
        funcionarioNome: linha.funcionarioNome,
        origem: linha.origem,
        tipo: "MUDOU",
        vendasAntes: antes.quantidade,
        vendasDepois: linha.quantidade,
        valorAntes: antes.valorInstalado,
        valorDepois: linha.valorInstalado,
      });
    }
  }

  // Quem estava ontem e não está hoje: o caso que passa despercebido.
  for (const linha of anterior) {
    if (!mapaAtual.has(chave(linha))) {
      mudancas.push({
        funcionarioNome: linha.funcionarioNome,
        origem: linha.origem,
        tipo: "SUMIU",
        vendasAntes: linha.quantidade,
        vendasDepois: 0,
        valorAntes: linha.valorInstalado,
        valorDepois: 0,
      });
    }
  }

  // Sumiço primeiro, depois queda, depois o resto: ordem de quem precisa de
  // atenção, não ordem alfabética.
  const peso = { SUMIU: 0, MUDOU: 1, ENTROU: 2 } as const;
  mudancas.sort((a, b) => {
    if (peso[a.tipo] !== peso[b.tipo]) return peso[a.tipo] - peso[b.tipo];
    return a.vendasDepois - a.vendasAntes - (b.vendasDepois - b.vendasAntes);
  });

  return { diaAtual, diaAnterior, mudancas };
}
