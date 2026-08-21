import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/text";
import { acharFuncionario } from "@/lib/elleven-core";
import { agregarNegociacoesFunil, type LinhaFunil } from "@/lib/conferencia-funil";

// Pendências do batimento: o que a importação resolveu sozinha e ninguém
// confirmou, mais o que ela não conseguiu resolver e descartou em silêncio.
//
// Dois casos, ambos hoje invisíveis fora do log técnico:
//
// 1. Casamento APROXIMADO. Quando o nome do Elleven não bate exatamente com o
//    cadastro, o sistema adivinha pela ordem dos nomes. Em agosto, 2 dos 42
//    vendedores entraram assim — e ninguém confirmou se acertou. Se errou, a
//    venda de uma pessoa foi para outra.
//
// 2. Venda SEM VENDEDOR. Negociação sem o campo preenchido é contada e jogada
//    fora. Ela existiu, alguém a fez, e não entra no bônus de ninguém.
//
// Nenhum dos dois é erro do sistema — são decisões que precisam de gente. O que
// faltava era um lugar onde aparecessem.

export type CasamentoAproximado = {
  nomeNaFonte: string;
  nomeNoCadastro: string;
  funcionarioId: string;
  vendas: number;
  valor: number;
};

export type PendenciasPeriodo = {
  periodo: string;
  aproximados: CasamentoAproximado[];
  /** Negociações Ganhas sem vendedor preenchido na fonte. */
  vendasSemVendedor: number;
  /** Nomes da fonte que não casaram com ninguém — viram funcionário novo. */
  semCadastro: string[];
};

export async function levantarPendencias(periodo: string): Promise<PendenciasPeriodo> {
  const [linhasFunil, funcionarios] = await Promise.all([
    prisma.elevenRelatorioLinha.findMany({
      where: { relatorio: "funil-de-vendas", periodo },
      select: { dados: true },
    }),
    prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    }),
  ]);

  const { porVendedor, negociacoesSemVendedor } = agregarNegociacoesFunil(
    linhasFunil.map((l) => l.dados as LinhaFunil),
  );

  const porNomeExato = new Map(funcionarios.map((f) => [normalizarTexto(f.nome), f]));
  const aproximados: CasamentoAproximado[] = [];
  const semCadastro: string[] = [];

  // Repete a mesma resolução da importação — de propósito, com a função
  // compartilhada. Assim a tela mostra exatamente as decisões que foram
  // tomadas, e não uma segunda opinião sobre elas.
  for (const [nomeNaFonte, ag] of porVendedor) {
    const { funcionario, modo } = acharFuncionario(nomeNaFonte, funcionarios, porNomeExato);
    if (!funcionario) {
      semCadastro.push(nomeNaFonte);
      continue;
    }
    if (modo === "FUZZY") {
      aproximados.push({
        nomeNaFonte,
        nomeNoCadastro: funcionario.nome,
        funcionarioId: funcionario.id,
        vendas: ag.quantidade,
        valor: ag.valorInstalado,
      });
    }
  }

  // Mais vendas primeiro: um casamento errado com 20 vendas custa mais caro que
  // um com 1.
  aproximados.sort((a, b) => b.vendas - a.vendas);

  return {
    periodo,
    aproximados,
    vendasSemVendedor: negociacoesSemVendedor,
    semCadastro,
  };
}
