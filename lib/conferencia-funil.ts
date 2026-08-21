import "server-only";
import {
  parseValorBr,
  categoriaProdutoFunil,
} from "@/lib/elleven-core";
import { normalizarTexto } from "@/lib/text";

/**
 * Agregação do Funil de Vendas usada pela Conferência/Batimento.
 *
 * Extraída de lib/elleven-core.ts (commit e9208d9, produção de 08/08/2026) na
 * restauração das telas removidas na "faxina" de 09/08/2026. O elleven-core foi
 * refatorado e deixou de exportar `agregarNegociacoesFunil`/`LinhaFunil`; como só
 * a conferência e as pendências consomem essa lógica, ela vive aqui, isolada, sem
 * mexer no funil de importação já refatorado (lib/importar-elleven-funil.ts).
 *
 * Função pura — dá para testar com linhas de exemplo em vez de descobrir em
 * produção, que foi como os dois defeitos de comissão de 06/08/2026 apareceram.
 */

export type LinhaFunil = Record<string, unknown>;

/** Campos numéricos de um LancamentoVenda, sem identidade nem período. */
export type AgregadoFunil = {
  quantidade: number;
  valorInstalado: number;
  valorDemaisServicos: number;
  qtdInternet: number;
  qtdChip: number;
  qtdGps: number;
  qtdTv: number;
  qtdStreaming: number;
  qtdTelefoniaFixa: number;
};

function isGanha(status: unknown): boolean {
  return normalizarTexto(String(status ?? "")) === "ganha";
}

function isUpgrade(tipoNegociacao: unknown): boolean {
  return normalizarTexto(String(tipoNegociacao ?? "")) === "upgrade";
}

/**
 * Decide o que é venda e agrupa por vendedor — SEM tocar no banco.
 *
 * Regras (OS): só negociação Ganha, só Venda (não Upgrade) e só com valor de
 * carrinho acima de zero — o que exclui o "CDNTV | Pacote Completo" a R$ 0,00,
 * brinde atrelado a outro plano.
 */
export function agregarNegociacoesFunil(linhas: LinhaFunil[]): {
  porVendedor: Map<string, AgregadoFunil>;
  negociacoesFiltradas: number;
  negociacoesSemVendedor: number;
} {
  const filtradas = linhas.filter((dados) => {
    if (!isGanha(dados["Status Negociacao"])) return false;
    if (isUpgrade(dados["Tipo Negociacao"])) return false;
    return parseValorBr(String(dados["Valor Serv. Carrinho"] ?? "")) > 0;
  });

  const porVendedor = new Map<string, AgregadoFunil>();
  let negociacoesSemVendedor = 0;

  for (const dados of filtradas) {
    const nome = String(dados["Vendedor"] ?? "").trim();
    // Negociação sem vendedor não pode ser atribuída a ninguém — não dá para
    // criar funcionário sem nome. Fica de fora e é reportada.
    if (!nome) {
      negociacoesSemVendedor++;
      continue;
    }

    const ag =
      porVendedor.get(nome) ??
      {
        quantidade: 0,
        valorInstalado: 0,
        valorDemaisServicos: 0,
        qtdInternet: 0,
        qtdChip: 0,
        qtdGps: 0,
        qtdTv: 0,
        qtdStreaming: 0,
        qtdTelefoniaFixa: 0,
      };

    ag.quantidade++;
    const valor = parseValorBr(String(dados["Valor Serv. Carrinho"] ?? ""));
    ag.valorInstalado += valor;
    const cat = categoriaProdutoFunil(String(dados["Servico Carrinho"] ?? ""));
    if (cat) ag[cat]++;
    // Base da regra de 50% do Atendimento/ADM: tudo que não é internet, mesmo
    // sem categoria reconhecida.
    if (cat !== "qtdInternet") ag.valorDemaisServicos += valor;

    porVendedor.set(nome, ag);
  }

  return {
    porVendedor,
    negociacoesFiltradas: filtradas.length,
    negociacoesSemVendedor,
  };
}
