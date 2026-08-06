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
import { registrarRetrato } from "@/lib/retrato-vendas";
import {
  acharFuncionario,
  agregarNegociacoesFunil,
  type AgregadoFunil,
  type LinhaFunil,
} from "@/lib/elleven-core";
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

// Importa as negociações Ganhas do `periodo` (formato "AAAA-MM") do relatório
// Funil de Vendas - Gerencial em lançamentos e recalcula o fechamento
// (mantido ABERTO). Seguro para rodar várias vezes.
export async function importarLancamentosEllevenFunil(
  periodo: string,
): Promise<ResultadoImportacaoFunil> {
  const linhasBrutas = await prisma.elevenRelatorioLinha.findMany({
    where: { relatorio: "funil-de-vendas", periodo },
  });

  // Toda a decisão de "o que conta como venda e de quem é" mora numa função
  // pura, testável sem banco (ver agregarNegociacoesFunil).
  const { porVendedor, negociacoesFiltradas, negociacoesSemVendedor } =
    agregarNegociacoesFunil(linhasBrutas.map((l) => l.dados as LinhaFunil));

  const funcionarios = await prisma.funcionario.findMany({ where: { ativo: true } });
  const porNomeExato = new Map(funcionarios.map((f) => [normalizarTexto(f.nome), f]));

  const resultado: ResultadoImportacaoFunil = {
    periodo,
    negociacoesNoPeriodo: linhasBrutas.length,
    negociacoesFiltradas,
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
  const linhas: ({ funcionarioId: string } & AgregadoFunil)[] = [];
  for (const [nomeElleven, ag] of porVendedor) {
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

  // Fotografa o estado depois da regravação: é o que permite dizer,
  // amanhã, o que mudou de hoje para lá.
  await registrarRetrato(periodo);

  return resultado;
}
