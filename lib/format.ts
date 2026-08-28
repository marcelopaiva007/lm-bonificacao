/**
 * Formatadores pt-BR compartilhados pela UI (painel, tabelas, cards).
 * Números monetários e inteiros no padrão brasileiro; `pct` já inclui o sinal.
 */
export const brl = (v: number, compact = false) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v);

export const int = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

export const pct = (v: number) =>
  `${v > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}%`;
