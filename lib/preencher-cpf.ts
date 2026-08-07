import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/text";
import { somenteDigitos } from "@/lib/vendedor-match";

// Preenche o CPF de quem está sem, usando o dado que o L&M Móvel já traz.
//
// A auditoria de 06/08/2026 encontrou 156 de 163 funcionários ativos SEM CPF —
// e 5 cadastros duplicados. As duas coisas são o mesmo problema: sem CPF, o
// casamento depende do nome vir escrito igual, e o Elleven escreve com prefixo
// ("(SERASA) FULANO"), com partícula a mais ("DE MELO" contra "MELO") e em
// caixas diferentes. Cada variação nova vira uma ficha nova, e as vendas da
// pessoa se dividem entre elas — cada metade longe da faixa de 20, quando
// juntas cruzariam.
//
// O L&M Móvel registra o documento do vendedor. Aproveitar isso resolve na
// origem, sem digitação.
//
// TRAVA DELIBERADA: só preenche quando o nome bate EXATAMENTE (normalizado) com
// o cadastro. O casamento aproximado é bom o suficiente para atribuir uma venda,
// que dá para corrigir depois; não é bom o suficiente para gravar um documento
// de identidade na ficha de alguém, que passa a valer para todo o resto.

export type ResultadoPreenchimento = {
  preenchidos: { nome: string; cpf: string }[];
  conflitos: { nome: string; cpfNoCadastro: string; cpfNaFonte: string }[];
  ignoradosPorNomeAproximado: number;
};

export async function preencherCpfsDoChip(periodo: string): Promise<ResultadoPreenchimento> {
  const resultado: ResultadoPreenchimento = {
    preenchidos: [],
    conflitos: [],
    ignoradosPorNomeAproximado: 0,
  };

  const [vendas, funcionarios] = await Promise.all([
    prisma.vendaChipMovel.findMany({
      where: { periodo },
      select: { sellerNome: true, sellerCpf: true },
    }),
    prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, cpf: true },
    }),
  ]);

  // Um CPF por nome que aparece na fonte.
  const cpfPorNome = new Map<string, string>();
  for (const v of vendas) {
    const nome = (v.sellerNome ?? "").trim();
    const cpf = somenteDigitos(v.sellerCpf);
    if (!nome || cpf.length !== 11) continue;
    if (!cpfPorNome.has(normalizarTexto(nome))) {
      cpfPorNome.set(normalizarTexto(nome), cpf);
    }
  }
  if (cpfPorNome.size === 0) return resultado;

  const cpfsJaUsados = new Set(
    funcionarios.map((f) => somenteDigitos(f.cpf)).filter((c) => c.length === 11),
  );

  for (const f of funcionarios) {
    const cpfNaFonte = cpfPorNome.get(normalizarTexto(f.nome));
    if (!cpfNaFonte) continue;

    const cpfAtual = somenteDigitos(f.cpf);
    if (cpfAtual.length === 11) {
      // Já tem CPF e é outro: não sobrescrevemos. Um dos dois está errado, e
      // decidir qual não é trabalho de automação.
      if (cpfAtual !== cpfNaFonte) {
        resultado.conflitos.push({
          nome: f.nome,
          cpfNoCadastro: cpfAtual,
          cpfNaFonte,
        });
      }
      continue;
    }

    // Esse CPF já está em OUTRA ficha: é justamente o sinal de cadastro
    // duplicado. Gravar aqui violaria a unicidade e, pior, esconderia a
    // duplicata em vez de expô-la.
    if (cpfsJaUsados.has(cpfNaFonte)) {
      resultado.conflitos.push({
        nome: f.nome,
        cpfNoCadastro: "(vazio)",
        cpfNaFonte: `${cpfNaFonte} — já usado por outro cadastro`,
      });
      continue;
    }

    try {
      await prisma.funcionario.update({ where: { id: f.id }, data: { cpf: cpfNaFonte } });
      cpfsJaUsados.add(cpfNaFonte);
      resultado.preenchidos.push({ nome: f.nome, cpf: cpfNaFonte });
    } catch (e) {
      // Corrida com outra execução, ou unicidade violada por caminho não
      // previsto: registra e segue, sem derrubar a importação.
      console.error(`[cpf] não consegui gravar o CPF de ${f.nome}:`, e);
    }
  }

  // Nomes da fonte que não casaram exatamente com nenhum cadastro — são os que
  // ficam de fora da trava acima, e valem como medida de quanto ainda depende
  // de conferência humana.
  const nomesDoCadastro = new Set(funcionarios.map((f) => normalizarTexto(f.nome)));
  for (const nomeNormalizado of cpfPorNome.keys()) {
    if (!nomesDoCadastro.has(nomeNormalizado)) resultado.ignoradosPorNomeAproximado++;
  }

  return resultado;
}
