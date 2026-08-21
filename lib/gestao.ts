import "server-only";
import { prisma } from "@/lib/prisma";
import { periodoAnterior } from "@/lib/periodo";
import {
  asRegraConfig,
  calcularBonificacaoIndividual,
  somaLancamentos,
  type RegraConfig,
} from "@/lib/bonificacao";

// A área de gestão: o que se consulta ANTES de uma decisão que custa dinheiro —
// promover, desligar, abrir vaga numa cidade, mudar a regra de comissão.
//
// Diferente do painel, que é lido todo dia, aqui o horizonte é de meses.

/** Os N períodos anteriores a `periodo`, incluindo ele, do mais antigo ao atual. */
function ultimosPeriodos(periodo: string, quantidade: number): string[] {
  const lista = [periodo];
  let atual = periodo;
  for (let i = 1; i < quantidade; i++) {
    atual = periodoAnterior(atual);
    lista.unshift(atual);
  }
  return lista;
}

export type ConsistenciaPessoa = {
  nome: string;
  /** Valor vendido em cada período, na ordem dos meses. */
  serie: number[];
  mediaMes: number;
  /** Meses em que vendeu algo, de quantos considerados. */
  mesesComVenda: number;
  totalMeses: number;
  tendencia: "subindo" | "caindo" | "estavel";
};

/**
 * Desempenho de cada pessoa ao longo de seis meses.
 *
 * O ranking do mês premia sorte; seis meses lado a lado mostram quem sustenta —
 * que é a diferença entre promover certo e promover o mês bom de alguém.
 *
 * A tendência compara a média do primeiro terço com a do último: uma queda no
 * mês corrente (ainda em andamento) não vira "caindo" sozinha.
 */
export async function consistenciaDasPessoas(
  periodo: string,
  meses = 6,
): Promise<ConsistenciaPessoa[]> {
  const periodos = ultimosPeriodos(periodo, meses);

  const lancamentos = await prisma.lancamentoVenda.findMany({
    where: { periodo: { in: periodos } },
    select: { periodo: true, valorInstalado: true, funcionario: { select: { nome: true } } },
  });

  const porPessoa = new Map<string, number[]>();
  const indice = new Map(periodos.map((p, i) => [p, i]));

  for (const l of lancamentos) {
    const serie = porPessoa.get(l.funcionario.nome) ?? new Array(periodos.length).fill(0);
    const i = indice.get(l.periodo);
    if (i !== undefined) serie[i] += l.valorInstalado;
    porPessoa.set(l.funcionario.nome, serie);
  }

  const linhas: ConsistenciaPessoa[] = [];
  for (const [nome, serie] of porPessoa) {
    const total = serie.reduce((a, b) => a + b, 0);
    if (total === 0) continue;

    const corte = Math.max(1, Math.floor(serie.length / 3));
    const inicio = serie.slice(0, corte).reduce((a, b) => a + b, 0) / corte;
    const fim = serie.slice(-corte).reduce((a, b) => a + b, 0) / corte;

    let tendencia: ConsistenciaPessoa["tendencia"] = "estavel";
    if (inicio > 0) {
      const variacao = (fim - inicio) / inicio;
      if (variacao > 0.15) tendencia = "subindo";
      else if (variacao < -0.15) tendencia = "caindo";
    } else if (fim > 0) {
      tendencia = "subindo";
    }

    linhas.push({
      nome,
      serie,
      mediaMes: total / serie.length,
      mesesComVenda: serie.filter((v) => v > 0).length,
      totalMeses: serie.length,
      tendencia,
    });
  }

  return linhas.sort((a, b) => b.mediaMes - a.mediaMes);
}

export type LinhaCidade = {
  cidade: string;
  vendedores: number;
  vendido: number;
  /** O número que importa: total dividido por cabeça. */
  porVendedor: number;
  custoComissao: number | null;
};

/**
 * Cidades medidas por rendimento, não por volume.
 *
 * O total sempre elege a cidade maior. Dividido por vendedor, aparece onde a
 * próxima contratação rende mais — e onde a operação está cara.
 */
export async function rendimentoPorCidade(periodo: string): Promise<LinhaCidade[]> {
  const [lancamentos, bonificacoes] = await Promise.all([
    prisma.lancamentoVenda.findMany({
      where: { periodo },
      select: {
        funcionarioId: true,
        valorInstalado: true,
        funcionario: { select: { cidade: { select: { nome: true } } } },
      },
    }),
    prisma.bonificacaoCalculada.findMany({
      where: { fechamento: { periodo } },
      select: {
        valorTotal: true,
        funcionario: { select: { cidade: { select: { nome: true } } } },
      },
    }),
  ]);

  const porCidade = new Map<string, { vendido: number; pessoas: Set<string>; bonus: number }>();

  for (const l of lancamentos) {
    const cidade = l.funcionario.cidade?.nome ?? "Sem cidade";
    const atual = porCidade.get(cidade) ?? { vendido: 0, pessoas: new Set<string>(), bonus: 0 };
    atual.vendido += l.valorInstalado;
    atual.pessoas.add(l.funcionarioId);
    porCidade.set(cidade, atual);
  }

  for (const b of bonificacoes) {
    const cidade = b.funcionario.cidade?.nome ?? "Sem cidade";
    const atual = porCidade.get(cidade) ?? { vendido: 0, pessoas: new Set<string>(), bonus: 0 };
    atual.bonus += b.valorTotal;
    porCidade.set(cidade, atual);
  }

  return [...porCidade.entries()]
    .map(([cidade, d]) => ({
      cidade,
      vendedores: d.pessoas.size,
      vendido: d.vendido,
      porVendedor: d.pessoas.size > 0 ? d.vendido / d.pessoas.size : 0,
      custoComissao: d.vendido > 0 ? (d.bonus / d.vendido) * 100 : null,
    }))
    .sort((a, b) => b.porVendedor - a.porVendedor);
}

export type LinhaDesembolso = {
  periodo: string;
  vendido: number;
  comissao: number;
  percentual: number | null;
};

/** Vendido, comissão e o percentual entre os dois, mês a mês. */
export async function desembolsoPorMes(
  periodo: string,
  meses = 6,
): Promise<LinhaDesembolso[]> {
  const periodos = ultimosPeriodos(periodo, meses);

  const [lancamentos, bonificacoes] = await Promise.all([
    prisma.lancamentoVenda.groupBy({
      by: ["periodo"],
      where: { periodo: { in: periodos } },
      _sum: { valorInstalado: true },
    }),
    prisma.bonificacaoCalculada.findMany({
      where: { fechamento: { periodo: { in: periodos } } },
      select: { valorTotal: true, fechamento: { select: { periodo: true } } },
    }),
  ]);

  const vendidoPorPeriodo = new Map(
    lancamentos.map((l) => [l.periodo, l._sum.valorInstalado ?? 0]),
  );
  const comissaoPorPeriodo = new Map<string, number>();
  for (const b of bonificacoes) {
    const p = b.fechamento.periodo;
    comissaoPorPeriodo.set(p, (comissaoPorPeriodo.get(p) ?? 0) + b.valorTotal);
  }

  return periodos.map((p) => {
    const vendido = vendidoPorPeriodo.get(p) ?? 0;
    const comissao = comissaoPorPeriodo.get(p) ?? 0;
    return {
      periodo: p,
      vendido,
      comissao,
      percentual: vendido > 0 ? (comissao / vendido) * 100 : null,
    };
  });
}

export type ResultadoSimulacao = {
  comissaoAtual: number;
  comissaoSimulada: number;
  diferenca: number;
  custoAtual: number | null;
  custoSimulado: number | null;
  pessoasQueGanhamMais: number;
  pessoasQueGanhamMenos: number;
};

/**
 * Aplica uma regra hipotética sobre um mês já fechado e diz o que teria custado.
 *
 * É a peça que faltava: como a comissão muda quase todo mês, cada mudança era
 * feita no escuro e o efeito só aparecia depois de pago. Nada é gravado — a
 * função só calcula.
 */
export async function simularRegra(
  periodo: string,
  cargo: string,
  configSimulada: RegraConfig,
): Promise<ResultadoSimulacao> {
  const [funcionarios, lancamentos, regraAtual] = await Promise.all([
    prisma.funcionario.findMany({ where: { cargo }, select: { id: true } }),
    prisma.lancamentoVenda.findMany({ where: { periodo } }),
    prisma.regraBonificacao.findFirst({
      where: { cargo },
      orderBy: { vigenciaInicio: "desc" },
    }),
  ]);

  const configAtual = asRegraConfig(regraAtual?.config);
  const idsDoCargo = new Set(funcionarios.map((f) => f.id));

  const porFuncionario = new Map<string, typeof lancamentos>();
  for (const l of lancamentos) {
    if (!idsDoCargo.has(l.funcionarioId)) continue;
    const lista = porFuncionario.get(l.funcionarioId) ?? [];
    lista.push(l);
    porFuncionario.set(l.funcionarioId, lista);
  }

  let comissaoAtual = 0;
  let comissaoSimulada = 0;
  let ganhamMais = 0;
  let ganhamMenos = 0;
  let vendidoDoCargo = 0;

  for (const lista of porFuncionario.values()) {
    const agregado = somaLancamentos(lista);
    vendidoDoCargo += agregado.valorInstalado;

    const atual = calcularBonificacaoIndividual(agregado, configAtual);
    const simulada = calcularBonificacaoIndividual(agregado, configSimulada);

    const totalAtual = atual.valorInternet + atual.valorChip + atual.valorDemais;
    const totalSimulado = simulada.valorInternet + simulada.valorChip + simulada.valorDemais;

    comissaoAtual += totalAtual;
    comissaoSimulada += totalSimulado;
    if (totalSimulado > totalAtual) ganhamMais++;
    else if (totalSimulado < totalAtual) ganhamMenos++;
  }

  const pct = (v: number) => (vendidoDoCargo > 0 ? (v / vendidoDoCargo) * 100 : null);

  return {
    comissaoAtual,
    comissaoSimulada,
    diferenca: comissaoSimulada - comissaoAtual,
    custoAtual: pct(comissaoAtual),
    custoSimulado: pct(comissaoSimulada),
    pessoasQueGanhamMais: ganhamMais,
    pessoasQueGanhamMenos: ganhamMenos,
  };
}
