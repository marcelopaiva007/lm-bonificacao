// Importação AUTOMÁTICA do relatório "Funil de Vendas - Gerencial" em
// LancamentoVenda. Fonte oficial de vendas a partir da OS de troca de fonte de
// dados (Ativação Contratos não refletia os números reais da empresa).
//
// Roda a partir do cron (sync-elleven), sem usuário logado — por isso vive num
// módulo plano (sem "use server"). É idempotente: a cada rodada substitui
// apenas os lançamentos do período com origem ELLEVEN_AUTO (mesma origem que
// Ativação Contratos usava, reaproveitada por decisão do cliente — nenhuma
// tela precisa mudar). Vendedor sem cadastro é criado automaticamente como
// VENDEDOR_EXTERNO, mesma decisão já tomada para Ativação Contratos.
//
// Diferente de Ativação Contratos (que vem de uma tabela por contrato sem
// período), aqui a fonte é ElevenRelatorioLinha (relatorio="funil-de-vendas"),
// já filtrada por período no momento do sync do wizard — não precisa
// re-parsear datas linha a linha.

import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/text";
import { recalcularFechamento } from "@/lib/bonificacao";
import { acharFuncionario, categoriaProdutoFunil, parseValorBr } from "@/lib/elleven-core";
import { ORIGEM_ELLEVEN_AUTO } from "@/lib/importar-elleven-auto";

export type ResultadoImportacaoFunil = {
  periodo: string;
  negociacoesNoPeriodo: number;
  negociacoesFiltradas: number;
  negociacoesSemVendedor: number;
  vendedores: number;
  lancamentosGerados: number;
  matchExato: number;
  matchFuzzy: number;
  funcionariosCriados: number;
};

// "Ganha" e "Perdida" tanto quanto "Andamento" existem no relatório; só uma
// negociação Ganha vira venda. Case-insensitive/trim porque o Elleven não
// garante capitalização consistente entre exports.
function isGanha(status: unknown): boolean {
  return normalizarTexto(String(status ?? "")) === "ganha";
}

function isUpgrade(tipoNegociacao: unknown): boolean {
  return normalizarTexto(String(tipoNegociacao ?? "")) === "upgrade";
}

// Importa as negociações Ganhas do `periodo` (formato "AAAA-MM") do relatório
// Funil de Vendas - Gerencial em lançamentos e recalcula o fechamento
// (mantido ABERTO). Seguro para rodar várias vezes.
export async function importarLancamentosEllevenFunil(
  periodo: string,
): Promise<ResultadoImportacaoFunil> {
  const linhasBrutas = await prisma.elevenRelatorioLinha.findMany({
    where: { relatorio: "funil-de-vendas", periodo },
  });

  // Filtro de negócio (OS): só negociação Ganha, só Venda (não Upgrade) e só
  // com valor de carrinho > 0 — exclui "CDNTV | Pacote Completo" a R$0,00
  // (brinde atrelado a outro plano, decisão do cliente: fica fora do cálculo).
  const filtradas = linhasBrutas.filter((l) => {
    const dados = l.dados as Record<string, unknown>;
    if (!isGanha(dados["Status Negociacao"])) return false;
    if (isUpgrade(dados["Tipo Negociacao"])) return false;
    const valor = parseValorBr(String(dados["Valor Serv. Carrinho"] ?? ""));
    return valor > 0;
  });

  // Agrupa por vendedor. Negociação sem vendedor não pode ser atribuída a
  // ninguém (não dá para criar um funcionário sem nome) — fica de fora e é
  // reportada.
  type LinhaDados = Record<string, unknown>;
  const porVendedor = new Map<string, LinhaDados[]>();
  let negociacoesSemVendedor = 0;
  for (const l of filtradas) {
    const dados = l.dados as LinhaDados;
    const nome = String(dados["Vendedor"] ?? "").trim();
    if (!nome) {
      negociacoesSemVendedor++;
      continue;
    }
    const lista = porVendedor.get(nome) ?? [];
    lista.push(dados);
    porVendedor.set(nome, lista);
  }

  const funcionarios = await prisma.funcionario.findMany({ where: { ativo: true } });
  const porNomeExato = new Map(funcionarios.map((f) => [normalizarTexto(f.nome), f]));

  const resultado: ResultadoImportacaoFunil = {
    periodo,
    negociacoesNoPeriodo: linhasBrutas.length,
    negociacoesFiltradas: filtradas.length,
    negociacoesSemVendedor,
    vendedores: porVendedor.size,
    lancamentosGerados: 0,
    matchExato: 0,
    matchFuzzy: 0,
    funcionariosCriados: 0,
  };

  // Resolve o funcionário de cada vendedor: exato -> fuzzy -> criar novo,
  // depois agrega os campos numéricos do LancamentoVenda direto (sem tabela
  // de cidade — o Funil de Vendas não tem coluna própria de cidade do
  // vendedor equivalente à de Ativação Contratos).
  const linhas: {
    funcionarioId: string;
    quantidade: number;
    valorInstalado: number;
    valorDemaisServicos: number;
    qtdInternet: number;
    qtdChip: number;
    qtdGps: number;
    qtdTv: number;
    qtdStreaming: number;
    qtdTelefoniaFixa: number;
  }[] = [];
  for (const [nomeElleven, negociacoes] of porVendedor) {
    const { funcionario, modo } = acharFuncionario(nomeElleven, funcionarios, porNomeExato);
    let funcionarioId: string;
    if (funcionario) {
      funcionarioId = funcionario.id;
      if (modo === "EXATO") resultado.matchExato++;
      else resultado.matchFuzzy++;
    } else {
      const novo = await prisma.funcionario.create({
        data: { nome: nomeElleven, cargo: "VENDEDOR_EXTERNO", ativo: true },
      });
      funcionarioId = novo.id;
      resultado.funcionariosCriados++;
      funcionarios.push(novo);
      porNomeExato.set(normalizarTexto(novo.nome), novo);
    }

    const ag = {
      quantidade: negociacoes.length,
      valorInstalado: 0,
      valorDemaisServicos: 0,
      qtdInternet: 0,
      qtdChip: 0,
      qtdGps: 0,
      qtdTv: 0,
      qtdStreaming: 0,
      qtdTelefoniaFixa: 0,
    };
    for (const dados of negociacoes) {
      const valor = parseValorBr(String(dados["Valor Serv. Carrinho"] ?? ""));
      ag.valorInstalado += valor;
      const cat = categoriaProdutoFunil(String(dados["Servico Carrinho"] ?? ""));
      if (cat) ag[cat]++;
      if (cat !== "qtdInternet") ag.valorDemaisServicos += valor;
    }
    linhas.push({ funcionarioId, ...ag });
  }

  // Substitui, atomicamente, os lançamentos automáticos deste período.
  await prisma.$transaction(async (tx) => {
    await tx.lancamentoVenda.deleteMany({
      where: { periodo, origem: ORIGEM_ELLEVEN_AUTO },
    });
    if (linhas.length > 0) {
      await tx.lancamentoVenda.createMany({
        data: linhas.map((l) => ({
          funcionarioId: l.funcionarioId,
          periodo,
          quantidade: l.quantidade,
          // Não existe conceito de "cancelado" nesta fonte: negociações
          // Perdida/Andamento já foram descartadas no filtro acima, então
          // tudo que sobra é aprovado (ver OS).
          aprovado: l.quantidade,
          cancelado: 0,
          valorInstalado: l.valorInstalado,
          valorDemaisServicos: l.valorDemaisServicos,
          qtdInternet: l.qtdInternet,
          qtdChip: l.qtdChip,
          qtdGps: l.qtdGps,
          qtdTv: l.qtdTv,
          qtdStreaming: l.qtdStreaming,
          qtdTelefoniaFixa: l.qtdTelefoniaFixa,
          origem: ORIGEM_ELLEVEN_AUTO,
        })),
      });
    }
  });
  resultado.lancamentosGerados = linhas.length;

  // Recalcula a bonificação do mês, mantendo o fechamento ABERTO até o
  // fechamento manual pela diretoria.
  await recalcularFechamento(periodo);

  return resultado;
}
