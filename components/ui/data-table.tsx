import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  cell: (row: T, index: number) => ReactNode;
};

/**
 * Tabela de dados genérica do padrão premium: cabeçalho fixo (sticky), zebrado
 * sutil, números alinhados à direita em fonte mono, além de estados de
 * carregamento (skeleton) e vazio embutidos.
 */
export function DataTable<T>({
  columns,
  rows,
  loading = false,
  emptyTitle = "Nenhum registro encontrado",
  emptyHint = "Ajuste os filtros ou importe novos lançamentos para ver dados aqui.",
  maxHeight,
  rowKey,
  minWidth = "640px",
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  maxHeight?: string;
  rowKey: (row: T, index: number) => string;
  minWidth?: string;
}) {
  const alignClass = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
        <div className="grid size-11 place-items-center rounded-full border border-border bg-elevated/60 text-muted-foreground">
          <Inbox className="size-5" />
        </div>
        <p className="text-sm font-semibold">{emptyTitle}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-elevated/90 backdrop-blur-md">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={`border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase ${alignClass(c.align)}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className="border-b border-border/40 transition-colors last:border-0 odd:bg-foreground/[0.015] hover:bg-accent/[0.06]"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-2.5 align-middle ${alignClass(c.align)} ${
                    c.align === "right" ? "font-mono tabular-nums" : ""
                  }`}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Selo de status com cor semântica (verde/âmbar/vermelho). */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Ativo: "bg-success/12 text-success border-success/25",
    Férias: "bg-warn/12 text-warn border-warn/25",
    Inativo: "bg-destructive/12 text-destructive border-destructive/25",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        map[status] ?? "border-border bg-muted text-muted-foreground"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
