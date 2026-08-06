import "server-only";
import { prisma } from "@/lib/prisma";
import { FUSO_BR, periodoAnterior } from "@/lib/periodo";
import { getRegraVigente, asRegraConfig, somaLancamentos } from "@/lib/bonificacao";
import { metasDosServicos } from "@/lib/acompanhamento";

// Os números que respondem "como estamos e o que exige ação hoje".
//
// O painel atual descreve o passado com precisão e não responde nenhuma
// pergunta de decisão. Aqui ficam os quatro que mudam decisão: onde o mês vai
// fechar, quanto a comissão está custando, quem precisa de atenção e como as
// equipes estão contra a meta.

/** Dia de hoje e total de dias do mês, no fuso de Brasília. */
function diasDoPeriodo(periodo: string): { diaAtual: number; diasNoMes: number } {
  const [ano, mes] = periodo.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [anoHoje, mesHoje, diaHoje] = hoje.split("-").map(Number);

  // Período passado conta como mês inteiro corrido; período futuro, como dia 1.
  if (anoHoje > ano || (anoHoje === ano && mesHoje > mes)) {
    return { diaAtual: diasNoMes, diasNoMes };
  }
  if (anoHoje < ano || (anoHoje === ano && mesHoje < mes)) {
    return { diaAtual: 1, diasNoMes };
  }
  return { diaAtual: diaHoje, diasNoMes };
}

export type ResumoGestao = {
  vendido: number;
  bonificacao: number;
  /** Projeção do fechamento, pelo ritmo dos dias já corridos. */
  projecaoVendido: number;
  projecaoBonificacao: number;
  /** Bonificação ÷ vendido, em %. É o alarme de regra saindo do lugar. */
  custoComissao: number | null;
  custoComissaoAnterior: number | null;
  vendidoAnterior: number;
  diaAtual: number;
  diasNoMes: number;
  /** Projeção do começo do mês é grosseira e a tela precisa dizer isso. */
  projecaoConfiavel: boolean;
};

export const LIMITE_CUSTO_VERMELHO = 25;
export const LIMITE_CUSTO_AMARELO = 23;

export async function resumoGestao(periodo: string): Promise<ResumoGestao> {
  const anterior = periodoAnterior(periodo);
  const { diaAtual, diasNoMes } = diasDoPeriodo(periodo);

  const [lancAtual, lancAnterior, bonifAtual, bonifAnterior] = await Promise.all([
    prisma.lancamentoVenda.aggregate({ where: { periodo }, _sum: { valorInstalado: true } }),
    prisma.lancamentoVenda.aggregate({
      where: { periodo: anterior },
      _sum: { valorInstalado: true },
    }),
    prisma.bonificacaoCalculada.aggregate({
      where: { fechamento: { periodo } },
      _sum: { valorTotal: true },
    }),
    prisma.bonificacaoCalculada.aggregate({
      where: { fechamento: { periodo: anterior } },
      _sum: { valorTotal: true },
    }),
  ]);

  const vendido = lancAtual._sum.valorInstalado ?? 0;
  const bonificacao = bonifAtual._sum.valorTotal ?? 0;
  const vendidoAnterior = lancAnterior._sum.valorInstalado ?? 0;
  const bonificacaoAnterior = bonifAnterior._sum.valorTotal ?? 0;

  const fator = diaAtual > 0 ? diasNoMes / diaAtual : 1;
  const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : null);

  return {
    vendido,
    bonificacao,
    projecaoVendido: vendido * fator,
    projecaoBonificacao: bonificacao * fator,
    custoComissao: pct(bonificacao, vendido),
    custoComissaoAnterior: pct(bonificacaoAnterior, vendidoAnterior),
    vendidoAnterior,
    diaAtual,
    diasNoMes,
    // Antes do dia 10 o ritmo oscila demais para a projeção significar algo.
    projecaoConfiavel: diaAtual >= 10,
  };
}

export type ItemAtencao = {
  nome: string;
  motivo: string;
  acao: "ligar" | "entender" | "avisar";
  gravidade: "alta" | "media" | "boa";
};

/**
 * Quem precisa de atenção esta semana.
 *
 * O ranking mostra os melhores; ninguém mostra quem caiu ou quem está a uma
 * venda da próxima faixa — que é onde uma ligação muda o resultado do mês.
 * Cada linha termina em verbo: lista de nomes sem ação vira decoração.
 */
export async function quemPrecisaDeAtencao(periodo: string): Promise<ItemAtencao[]> {
  const anterior = periodoAnterior(periodo);

  const [lancAtual, lancAnterior, funcionarios] = await Promise.all([
    prisma.lancamentoVenda.findMany({
      where: { periodo },
      include: { funcionario: { select: { id: true, nome: true, cargo: true, ativo: true } } },
    }),
    prisma.lancamentoVenda.findMany({
      where: { periodo: anterior },
      select: { funcionarioId: true, valorInstalado: true },
    }),
    prisma.funcionario.findMany({
      where: { ativo: true, cargo: { in: ["VENDEDOR_EXTERNO", "SUPERVISOR"] } },
      select: { id: true, nome: true, cargo: true },
    }),
  ]);

  const atualPorId = new Map<string, { nome: string; cargo: string; valor: number }>();
  const lancamentosPorId = new Map<string, typeof lancAtual>();
  for (const l of lancAtual) {
    const atual = atualPorId.get(l.funcionarioId) ?? {
      nome: l.funcionario.nome,
      cargo: l.funcionario.cargo,
      valor: 0,
    };
    atual.valor += l.valorInstalado;
    atualPorId.set(l.funcionarioId, atual);

    const lista = lancamentosPorId.get(l.funcionarioId) ?? [];
    lista.push(l);
    lancamentosPorId.set(l.funcionarioId, lista);
  }

  const anteriorPorId = new Map<string, number>();
  for (const l of lancAnterior) {
    anteriorPorId.set(l.funcionarioId, (anteriorPorId.get(l.funcionarioId) ?? 0) + l.valorInstalado);
  }

  const itens: ItemAtencao[] = [];

  // 1. Quem vendia e parou.
  for (const f of funcionarios) {
    const vendeuAntes = anteriorPorId.get(f.id) ?? 0;
    const vendeAgora = atualPorId.get(f.id)?.valor ?? 0;
    if (vendeuAntes > 0 && vendeAgora === 0) {
      itens.push({
        nome: f.nome,
        motivo: "sem nenhuma venda neste mês",
        acao: "ligar",
        gravidade: "alta",
      });
    } else if (vendeuAntes > 0 && vendeAgora > 0) {
      const queda = ((vendeuAntes - vendeAgora) / vendeuAntes) * 100;
      if (queda >= 50) {
        itens.push({
          nome: f.nome,
          motivo: `caiu ${Math.round(queda)}% em relação ao mês passado`,
          acao: "entender",
          gravidade: "media",
        });
      }
    }
  }

  // 2. Quem está perto de subir de faixa — a ligação que muda o mês.
  const configPorCargo = new Map<string, ReturnType<typeof asRegraConfig>>();
  for (const cargo of ["VENDEDOR_EXTERNO", "SUPERVISOR"]) {
    const regra = await getRegraVigente(cargo, periodo);
    configPorCargo.set(cargo, asRegraConfig(regra?.config));
  }

  for (const [id, dados] of atualPorId) {
    const config = configPorCargo.get(dados.cargo);
    if (!config) continue;
    const agregado = somaLancamentos(lancamentosPorId.get(id) ?? []);
    for (const meta of metasDosServicos(config, agregado)) {
      if (meta.faltam !== null && meta.faltam > 0 && meta.faltam <= 2) {
        itens.push({
          nome: dados.nome,
          motivo: `faltam ${meta.faltam} venda(s) de ${meta.label.toLowerCase()} para a próxima faixa`,
          acao: "avisar",
          gravidade: "boa",
        });
      }
    }
  }

  const ordem = { alta: 0, media: 1, boa: 2 } as const;
  itens.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
  return itens.slice(0, 12);
}

export type LinhaEquipe = {
  nome: string;
  internet: number;
  meta: number | null;
  percentual: number | null;
  pessoas: number;
};

/**
 * Internet por equipe contra a meta cadastrada.
 *
 * O bônus do supervisor depende deste número e ele não existia em tela nenhuma.
 * Soma membros ativos mais o supervisor — mesma composição do cálculo.
 */
export async function desempenhoDasEquipes(periodo: string): Promise<LinhaEquipe[]> {
  const [equipes, lancamentos, metas] = await Promise.all([
    prisma.equipe.findMany({
      include: { membros: { where: { ativo: true }, select: { id: true } } },
      orderBy: { nome: "asc" },
    }),
    prisma.lancamentoVenda.findMany({
      where: { periodo },
      select: { funcionarioId: true, qtdInternet: true },
    }),
    prisma.$queryRaw<{ alvoId: string; metaInternet: number }[]>`
      SELECT "alvoId", "metaInternet" FROM "bonificacao"."meta_periodo"
      WHERE "periodo" = ${periodo} AND "alvo" = 'EQUIPE'
    `.catch(() => []),
  ]);

  const internetPorFuncionario = new Map<string, number>();
  for (const l of lancamentos) {
    internetPorFuncionario.set(
      l.funcionarioId,
      (internetPorFuncionario.get(l.funcionarioId) ?? 0) + l.qtdInternet,
    );
  }

  const metaPorEquipe = new Map(metas.map((m) => [m.alvoId, m.metaInternet]));

  return equipes.map((e) => {
    const ids = new Set(e.membros.map((m) => m.id));
    if (e.supervisorId) ids.add(e.supervisorId);

    let internet = 0;
    for (const id of ids) internet += internetPorFuncionario.get(id) ?? 0;

    const meta = metaPorEquipe.get(e.id) ?? null;
    return {
      nome: e.nome,
      internet,
      meta,
      percentual: meta && meta > 0 ? Math.round((internet / meta) * 100) : null,
      pessoas: ids.size,
    };
  });
}
