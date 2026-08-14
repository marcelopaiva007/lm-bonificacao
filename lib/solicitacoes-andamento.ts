// Base "vendas em andamento" (item 3 das bases de vendas, definição da
// diretoria): vendas já fechadas que ainda aguardam instalação. Fonte é o
// relatório "Solicitações - Em andamento" do elleven (Exportador de Dados >
// Solicitações em Andamento > exportar) — não as negociações "Andamento" do
// Funil de Vendas, que a diretoria descartou por não representar o que está
// em campo esperando instalação (ver comentário em sync-elleven/route.ts).
//
// Roda a partir do cron (sync-elleven), sem usuário logado — por isso vive
// num módulo plano (sem "use server"), no mesmo padrão de
// importar-elleven-funil.ts.

import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/text";

// Os 8 tipos de solicitação que compõem a base, na grafia exata do elleven
// (inclusive as inconsistências de espaço/traço — "Suporte-" sem espaço,
// "Suporte de Rastreamento-" sem espaço, mas "Suporte -" com espaço em outros
// — e o " |" sobrando no fim de alguns). Comparação é sempre por texto
// normalizado (lib/text.ts), então a grafia aqui não precisa bater
// byte-a-byte com o CSV, só semanticamente.
export const TIPOS_SOLICITACAO_ANDAMENTO = [
  "Comercial - Pré-contrato | LM Telecom",
  "Suporte - Ativação de Contrato | Internet |",
  "Suporte - Reativação de Contrato",
  "Suporte de Rastreamento- Ativação de Serviço",
  "Suporte- Ativação de Telefonia Fixa",
  "Comercial - Ativação de Serviço de Rastreamento Veicular",
  "Comercial - Ativação de Telefonia Fixa",
  "Comercial - Ativação de Contrato | TV |",
] as const;

const TIPOS_NORMALIZADOS = new Set(
  TIPOS_SOLICITACAO_ANDAMENTO.map(normalizarTexto),
);

export function tipoSolicitacaoEstaNaBase(tipo: unknown): boolean {
  return TIPOS_NORMALIZADOS.has(normalizarTexto(String(tipo ?? "")));
}

// O nome exato da coluna varia entre exports do elleven — outros relatórios já
// vieram sem acento (ex.: "Status Negociacao" no Funil de Vendas, ver
// importar-elleven-funil.ts) — por isso a coluna é achada pelo nome
// normalizado ("tipo" + "solicita") em vez de uma chave fixa tipo
// dados["Tipo de Solicitação"], que quebraria silenciosamente se o cabeçalho
// vier diferente.
function acharColunaTipoSolicitacao(
  dados: Record<string, unknown>,
): string | null {
  for (const chave of Object.keys(dados)) {
    const norm = normalizarTexto(chave);
    if (norm.includes("tipo") && norm.includes("solicita")) return chave;
  }
  return null;
}

export function filtrarLinhasAndamento<T extends Record<string, unknown>>(
  linhas: T[],
): T[] {
  return linhas.filter((linha) => {
    const coluna = acharColunaTipoSolicitacao(linha);
    return coluna != null && tipoSolicitacaoEstaNaBase(linha[coluna]);
  });
}

export type ResultadoSolicitacoesAndamento = {
  periodo: string;
  totalLinhas: number;
  totalNaBase: number;
  linhas: Record<string, unknown>[];
};

// Lê as linhas cruas já coletadas pelo sync-elleven (relatorio =
// "solicitacoes-andamento") e aplica o filtro dos 8 tipos. Não escreve em
// lugar nenhum ainda — não há, por enquanto, uma tabela/UI destino definida
// para "os números" (perguntar antes de inventar uma).
export async function contarSolicitacoesAndamento(
  periodo: string,
): Promise<ResultadoSolicitacoesAndamento> {
  const linhasBrutas = await prisma.elevenRelatorioLinha.findMany({
    where: { relatorio: "solicitacoes-andamento", periodo },
  });
  const linhas = linhasBrutas.map((l) => l.dados as Record<string, unknown>);
  const filtradas = filtrarLinhasAndamento(linhas);

  return {
    periodo,
    totalLinhas: linhas.length,
    totalNaBase: filtradas.length,
    linhas: filtradas,
  };
}
