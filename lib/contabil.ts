// Domínio do módulo contábil: períodos do ano, trimestres e os cálculos de
// resultado. Tudo aqui é puro (sem Prisma) para poder ser usado tanto no server
// quanto no client sem duplicar regra.

import { periodoLabel } from "@/lib/periodo";

export const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export const MESES_NOMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const REGIMES = [
  { value: "SIMPLES", label: "Simples Nacional" },
  { value: "PRESUMIDO", label: "Lucro Presumido" },
  { value: "REAL", label: "Lucro Real" },
] as const;

export type StatusCompetencia = "ABERTA" | "FECHADA";
export type StatusImposto = "PENDENTE" | "PAGO";

// Papéis com acesso ao módulo. Ficam aqui (e não no guard) porque o guard
// importa `auth` — servidor puro — e a sidebar/nav precisa da mesma regra no
// client para esconder o que o usuário não pode usar.
export const ROLES_CONTABIL_LEITURA = ["ADMIN", "CONTABIL", "DIRETORIA"];
/** A Diretoria acompanha, mas não mexe nos números. */
export const ROLES_CONTABIL_EDICAO = ["ADMIN", "CONTABIL"];

export function podeEditarContabil(role: string): boolean {
  return ROLES_CONTABIL_EDICAO.includes(role);
}

/** Os 12 períodos ("AAAA-MM") de um ano, de janeiro a dezembro. */
export function periodosDoAno(ano: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

export function anoDoPeriodo(periodo: string): number {
  return Number(periodo.slice(0, 4));
}

/** 1..12 */
export function mesDoPeriodo(periodo: string): number {
  return Number(periodo.slice(5, 7));
}

/** 1..4 */
export function trimestreDoPeriodo(periodo: string): number {
  return Math.ceil(mesDoPeriodo(periodo) / 3);
}

export { periodoLabel };

export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatData(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "—";
  // Datas contábeis são gravadas em UTC "puro" (meia-noite), então formatamos
  // em UTC — usar o fuso local jogaria o dia 1 para o dia anterior.
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
}

/**
 * Converte "1.234,56", "1234.56" ou "R$ 1.234,56" em número.
 * Aceita o formato que o analista digita direto da planilha.
 */
export function parseValorBR(entrada: unknown): number {
  if (typeof entrada === "number") return entrada;
  const texto = String(entrada ?? "").trim();
  if (!texto) return 0;

  let limpo = texto.replace(/[R$\s]/g, "").replace(/ /g, "");
  const negativo = /^\(.*\)$/.test(limpo) || limpo.startsWith("-");
  limpo = limpo.replace(/[()\-]/g, "");

  // Se tem vírgula, ela é o separador decimal (padrão BR) e o ponto é milhar.
  if (limpo.includes(",")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  }

  const valor = Number(limpo);
  if (Number.isNaN(valor)) return 0;
  return negativo ? -valor : valor;
}

/** Data "AAAA-MM-DD" (input date) → Date em UTC, sem escorregar de dia. */
export function dataDeInput(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "AAAA-MM-DD" para preencher <input type="date">. */
export function inputDeData(data: Date | string | null | undefined): string {
  if (!data) return "";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Cálculo de resultado
// ---------------------------------------------------------------------------

export type LinhaMes = {
  periodo: string;
  mes: number;
  faturamento: number;
  despesas: number;
  /** faturamento - despesas (mesma conta da planilha) */
  lucro: number;
  impostos: number;
  impostosPagos: number;
  impostosPendentes: number;
  /** lucro - impostos: só faz sentido se os impostos NÃO estiverem em despesas */
  lucroAposImpostos: number;
  status: StatusCompetencia;
};

export type ResumoBloco = {
  faturamento: number;
  despesas: number;
  lucro: number;
  impostos: number;
  impostosPagos: number;
  impostosPendentes: number;
  lucroAposImpostos: number;
};

export function somaLinhas(linhas: LinhaMes[]): ResumoBloco {
  return linhas.reduce<ResumoBloco>(
    (acc, l) => ({
      faturamento: acc.faturamento + l.faturamento,
      despesas: acc.despesas + l.despesas,
      lucro: acc.lucro + l.lucro,
      impostos: acc.impostos + l.impostos,
      impostosPagos: acc.impostosPagos + l.impostosPagos,
      impostosPendentes: acc.impostosPendentes + l.impostosPendentes,
      lucroAposImpostos: acc.lucroAposImpostos + l.lucroAposImpostos,
    }),
    {
      faturamento: 0,
      despesas: 0,
      lucro: 0,
      impostos: 0,
      impostosPagos: 0,
      impostosPendentes: 0,
      lucroAposImpostos: 0,
    },
  );
}

/** Agrupa as 12 linhas nos 4 trimestres (o corte da planilha do analista). */
export function porTrimestre(linhas: LinhaMes[]): { trimestre: number; linhas: LinhaMes[]; total: ResumoBloco }[] {
  return [1, 2, 3, 4].map((t) => {
    const doTrimestre = linhas.filter((l) => Math.ceil(l.mes / 3) === t);
    return { trimestre: t, linhas: doTrimestre, total: somaLinhas(doTrimestre) };
  });
}

/** Margem de lucro (%) sobre o faturamento. Retorna null quando não fatura. */
export function margem(faturamento: number, lucro: number): number | null {
  if (!faturamento) return null;
  return (lucro / faturamento) * 100;
}

/** Só considera "com movimento" o mês que teve faturamento ou despesa. */
export function temMovimento(linha: LinhaMes): boolean {
  return linha.faturamento !== 0 || linha.despesas !== 0 || linha.impostos !== 0;
}

/** Monta o CSV (separador ";" — o que o Excel pt-BR abre direto). */
export function montarCSV(cabecalho: string[], linhas: (string | number)[][]): string {
  const escapa = (v: string | number) => {
    const texto = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return [cabecalho, ...linhas].map((l) => l.map(escapa).join(";")).join("\r\n");
}
