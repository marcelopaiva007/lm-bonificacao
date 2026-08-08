import type { RegraConfig } from "@/lib/bonificacao";

// Configuração da política de bonificação vigente descrita na OS
// (OS-regras-bonificacao.md). Usada para pré-cadastrar a regra corrente no seed
// e como valores de partida na aba de Regras.

const SERVICOS_VENDEDOR: RegraConfig["servicos"] = {
  internet: {
    tipo: "faixas",
    faixas: [
      { min: 20, max: 29, valor: 10 },
      { min: 30, max: 39, valor: 15 },
      { min: 40, max: null, valor: 20 },
    ],
  },
  chip: { tipo: "meta", metaQtd: 15, valor: 5 },
  gps: { tipo: "porVenda", valor: 5 },
  tv: { tipo: "porVenda", valor: 5 },
  streaming: { tipo: "porVenda", valor: 5 },
  telefoniaFixa: { tipo: "porVenda", valor: 5 },
};

export const REGRAS_DEFAULT: Record<string, RegraConfig> = {
  VENDEDOR_EXTERNO: { servicos: { ...SERVICOS_VENDEDOR } },
  SUPERVISOR: {
    servicos: { ...SERVICOS_VENDEDOR },
    supervisor: { metaPorPessoa: 20, larguraPorPessoa: 10, valoresFaixa: [2, 3, 4] },
  },
  ATENDIMENTO_ADM: {
    servicos: {
      internet: { tipo: "porVenda", valor: 20 },
      demaisServicos: { tipo: "percentualValor", percentual: 0.5 },
    },
  },
  // Regras definidas pela diretoria em 08/08/2026.
  //
  // TÉCNICO: R$ 20 por internet vendida + 50% do valor dos demais serviços.
  // O PAGAMENTO é semanal (toda segunda-feira) — mas isso é um relatório de
  // pagamento, não um mecanismo de cálculo: o fechamento do sistema continua
  // mensal, e a segunda-feira recebe o acumulado da semana. Decisão de desenho
  // registrada na conversa com a diretoria (opção "relatório semanal").
  TECNICO: {
    servicos: {
      internet: { tipo: "porVenda", valor: 20 },
      demaisServicos: { tipo: "percentualValor", percentual: 0.5 },
    },
  },
  // VENDEDOR AGREGADO: R$ 50 por internet + 50% dos demais. Pagamento mensal.
  VENDEDOR_AGREGADO: {
    servicos: {
      internet: { tipo: "porVenda", valor: 50 },
      demaisServicos: { tipo: "percentualValor", percentual: 0.5 },
    },
  },
  // RESPONSÁVEL DE SETOR: R$ 10 por cada venda de internet dos técnicos da
  // equipe dele, desde a 1ª venda, pagamento mensal. Reusa o mecanismo de
  // equipe do supervisor com meta zero: meta = 0 × tamanho = 0 (sempre
  // atingida) e uma única faixa de R$ 10 — ou seja, R$ 10 × total de internet
  // da equipe, sem degrau. A pessoa precisa estar como responsável (campo
  // supervisor) de uma Equipe cujos membros são os técnicos.
  RESPONSAVEL_SETOR: {
    servicos: {},
    supervisor: { metaPorPessoa: 0, larguraPorPessoa: 1, valoresFaixa: [10] },
  },
  // GESTOR: regra "à definir" pela diretoria — de propósito NÃO existe entrada
  // aqui. Criar o cargo sem regra pagaria zero em silêncio; melhor o cargo nem
  // existir até a regra ser definida.
  OUTRO_SETOR: { servicos: {} },
};
