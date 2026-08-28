import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";
import { Skeleton } from "@/components/ui/skeleton";

type Tone = "accent" | "success" | "destructive" | "primary" | "warn";

export function KpiCard({
  label,
  value,
  delta,
  deltaSuffix = "%",
  icon: Icon,
  hint,
  spark,
  tone = "primary",
  invert = false,
  loading = false,
}: {
  label: string;
  value: string;
  /** Variação vs. período anterior. `null` = sem base de comparação. */
  delta?: number | null;
  /** Sufixo do delta ("%" padrão; " p.p." para taxas). */
  deltaSuffix?: string;
  icon: LucideIcon;
  hint?: string;
  spark?: number[];
  tone?: Tone;
  /** Para métricas onde cair é bom (ex.: taxa de cancelamento, ajustes). */
  invert?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="surface rounded-xl p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-32" />
        <Skeleton className="mt-4 h-8 w-full" />
      </div>
    );
  }

  // `undefined` = KPI sem comparação (não mostra nada); `null` = há comparação
  // mas sem base (período anterior zerado → "Sem base de comparação").
  const temDelta = delta !== undefined;
  const semBase = delta === null;
  const neutro = !temDelta || semBase || Math.abs(delta as number) <= 0.05;
  const bom = neutro ? false : invert ? (delta as number) < 0 : (delta as number) > 0;
  const DeltaIcon = neutro ? Minus : (delta as number) > 0 ? ArrowUpRight : ArrowDownRight;
  const sinal = temDelta && !semBase && (delta as number) > 0 ? "+" : "";
  const deltaTexto =
    temDelta && !semBase
      ? `${sinal}${(delta as number).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${deltaSuffix}`
      : null;

  return (
    <div className="surface group relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/35">
      <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-linear-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-elevated/60"
          style={{ color: `var(--${tone})` }}
        >
          <Icon className="size-4" />
        </span>
      </div>

      <p className="mt-3 font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </p>

      <div className="mt-3 flex min-h-[22px] items-center gap-2">
        {deltaTexto ? (
          <span
            className={[
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
              neutro
                ? "bg-muted text-muted-foreground"
                : bom
                  ? "bg-success/12 text-success"
                  : "bg-destructive/12 text-destructive",
            ].join(" ")}
          >
            <DeltaIcon className="size-3" />
            {deltaTexto}
          </span>
        ) : (
          semBase && (
            <span className="text-[11px] text-muted-foreground">Sem base de comparação</span>
          )
        )}
        {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
      </div>

      {spark && spark.length > 1 && (
        <div className="-mx-1 mt-3 opacity-80 transition-opacity group-hover:opacity-100">
          <Sparkline data={spark} tone={tone} />
        </div>
      )}
    </div>
  );
}
