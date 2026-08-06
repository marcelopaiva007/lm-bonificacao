import "server-only";
import { prisma } from "@/lib/prisma";
import {
  acharFuncionario,
  agregarNegociacoesFunil,
  type LinhaFunil,
} from "@/lib/elleven-core";
import { normalizarTexto } from "@/lib/text";

// Conferência entre as fontes: a fonte diz X, o sistema lançou Y, a bonificação
// calculou sobre Z.
//
// Hoje esses três números vivem em lugares separados e conferi-los é trabalho de
// planilha. Quando divergem, ninguém percebe — foi assim que o "bônus fantasma"
// (linha de bonificação sem venda que a sustentasse) sobreviveu até hoje.
//
// As três colunas vêm de origens diferentes de propósito:
//   fonte     → elleven_relatorio_linha / venda_chip_movel, dado cru capturado
//   lançado   → LancamentoVenda, o que a importação gravou
//   bonificado→ BonificacaoCalculada, a base do pagamento
// Se a importação perder alguém no caminho, a diferença aparece aqui.

export type LinhaConferencia = {
  nome: string;
  /** Vendas na fonte original (relatório do Elleven / API do chip). */
  fonte: number;
  /** Vendas gravadas em LancamentoVenda. */
  lancado: number;
  /** Valor de bonificação calculado para a pessoa. */
  bonificado: number;
  /** Diferença entre fonte e lançado — o que precisa de explicação. */
  diferenca: number;
  situacao: "OK" | "NAO_LANCADO" | "SEM_FONTE" | "DIVERGENTE" | "SEM_BONUS";
};

export type ResumoConferencia = {
  periodo: string;
  linhas: LinhaConferencia[];
  totalFonte: number;
  totalLancado: number;
  semVendedorNaFonte: number;
  /** Nomes da fonte que não casaram com nenhum funcionário do cadastro. */
  naoIdentificados: string[];
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Monta a conferência do período, comparando fonte × lançado × bonificado.
 *
 * O casamento entre as três é por NOME normalizado — é o único identificador
 * comum: o relatório do Elleven traz o nome do vendedor, não o id do cadastro.
 * Nome que não casa vira "não identificado" e é reportado à parte, em vez de
 * sumir da conta.
 */
export async function montarConferencia(periodo: string): Promise<ResumoConferencia> {
  const [linhasFunil, vendasChip, lancamentos, bonificacoes, funcionariosAtivos] =
    await Promise.all([
    prisma.elevenRelatorioLinha.findMany({
      where: { relatorio: "funil-de-vendas", periodo },
      select: { dados: true },
    }),
    prisma.vendaChipMovel.findMany({
      where: { periodo },
      select: { sellerNome: true, cancelledAt: true },
    }),
    prisma.lancamentoVenda.findMany({
      where: { periodo },
      include: { funcionario: { select: { nome: true } } },
    }),
    prisma.bonificacaoCalculada.findMany({
      where: { fechamento: { periodo } },
      include: { funcionario: { select: { id: true, nome: true } } },
    }),
    prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
    }),
  ]);

  // A chave de comparação é o FUNCIONÁRIO, não o texto do nome. O Elleven grava
  // variações do mesmo nome — "(SERASA) VANILSON DOS SANTOS DELFINO",
  // "DANIEL LIMA DE MELO" contra "DANIEL LIMA MELO" — e comparar texto fazia a
  // mesma pessoa aparecer duas vezes: uma como "vendeu e não entrou", outra como
  // "lançado sem fonte". A importação já resolvia isso corretamente; era a
  // conferência que acusava divergência onde não havia.
  const porNomeExato = new Map(funcionariosAtivos.map((f) => [normalizarTexto(f.nome), f]));
  const resolver = (nomeNaFonte: string): { chave: string; nome: string } => {
    const { funcionario } = acharFuncionario(nomeNaFonte, funcionariosAtivos, porNomeExato);
    // Sem correspondência no cadastro, o próprio nome vira a chave — a pessoa
    // continua aparecendo, como "vendeu e não entrou".
    return funcionario
      ? { chave: `id:${funcionario.id}`, nome: funcionario.nome }
      : { chave: `nome:${normalizar(nomeNaFonte)}`, nome: nomeNaFonte };
  };

  // --- Fonte: Elleven (mesma regra da importação, função compartilhada) ---
  const { porVendedor, negociacoesSemVendedor } = agregarNegociacoesFunil(
    linhasFunil.map((l) => l.dados as LinhaFunil),
  );

  const fonte = new Map<string, { nome: string; vendas: number }>();
  for (const [nomeNaFonte, ag] of porVendedor) {
    const { chave, nome } = resolver(nomeNaFonte);
    const atual = fonte.get(chave) ?? { nome, vendas: 0 };
    atual.vendas += ag.quantidade;
    fonte.set(chave, atual);
  }

  // --- Fonte: chip (venda cancelada não conta, como na importação) ---
  for (const v of vendasChip) {
    if (v.cancelledAt) continue;
    const nomeNaFonte = (v.sellerNome ?? "").trim();
    if (!nomeNaFonte) continue;
    const { chave, nome } = resolver(nomeNaFonte);
    const atual = fonte.get(chave) ?? { nome, vendas: 0 };
    atual.vendas += 1;
    fonte.set(chave, atual);
  }

  // --- Lançado e bonificado ---
  const lancado = new Map<string, { nome: string; vendas: number }>();
  for (const l of lancamentos) {
    const chave = `id:${l.funcionarioId}`;
    const atual = lancado.get(chave) ?? { nome: l.funcionario.nome, vendas: 0 };
    atual.vendas += l.quantidade;
    lancado.set(chave, atual);
  }

  const bonificado = new Map<string, { nome: string; valor: number }>();
  for (const b of bonificacoes) {
    const chave = `id:${b.funcionarioId}`;
    const atual = bonificado.get(chave) ?? { nome: b.funcionario.nome, valor: 0 };
    atual.valor += b.valorTotal;
    bonificado.set(chave, atual);
  }

  const chaves = new Set([...fonte.keys(), ...lancado.keys(), ...bonificado.keys()]);
  const linhas: LinhaConferencia[] = [];

  for (const chave of chaves) {
    const f = fonte.get(chave);
    const l = lancado.get(chave);
    const b = bonificado.get(chave);

    const vendasFonte = f?.vendas ?? 0;
    const vendasLancadas = l?.vendas ?? 0;
    const valorBonus = b?.valor ?? 0;
    const diferenca = vendasLancadas - vendasFonte;

    let situacao: LinhaConferencia["situacao"];
    if (vendasFonte > 0 && vendasLancadas === 0) {
      // Vendeu e o sistema não registrou: a pessoa não recebe pelo que fez.
      situacao = "NAO_LANCADO";
    } else if (vendasFonte === 0 && vendasLancadas > 0) {
      // Lançamento sem venda que o sustente — inclui o lançamento manual, que é
      // legítimo, mas precisa ser visto e não descoberto no fim do mês.
      situacao = "SEM_FONTE";
    } else if (diferenca !== 0) {
      situacao = "DIVERGENTE";
    } else if (vendasLancadas > 0 && valorBonus === 0) {
      // Vendeu, foi lançado, e não gerou bônus. Pode ser meta não atingida —
      // mas também pode ser regra faltando para o cargo.
      situacao = "SEM_BONUS";
    } else {
      situacao = "OK";
    }

    linhas.push({
      nome: f?.nome ?? l?.nome ?? b?.nome ?? "—",
      fonte: vendasFonte,
      lancado: vendasLancadas,
      bonificado: valorBonus,
      diferenca,
      situacao,
    });
  }

  // Problema primeiro; dentro do problema, a maior diferença no topo.
  const peso: Record<LinhaConferencia["situacao"], number> = {
    NAO_LANCADO: 0,
    SEM_FONTE: 1,
    DIVERGENTE: 2,
    SEM_BONUS: 3,
    OK: 4,
  };
  linhas.sort((a, b) => {
    if (peso[a.situacao] !== peso[b.situacao]) return peso[a.situacao] - peso[b.situacao];
    return Math.abs(b.diferenca) - Math.abs(a.diferenca);
  });

  const naoIdentificados = linhas
    .filter((l) => l.situacao === "NAO_LANCADO")
    .map((l) => l.nome);

  return {
    periodo,
    linhas,
    totalFonte: [...fonte.values()].reduce((acc, f) => acc + f.vendas, 0),
    totalLancado: [...lancado.values()].reduce((acc, l) => acc + l.vendas, 0),
    semVendedorNaFonte: negociacoesSemVendedor,
    naoIdentificados,
  };
}
