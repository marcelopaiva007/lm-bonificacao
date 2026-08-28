import type { ReactNode } from "react";

/**
 * Painel de gráfico/conteúdo com cabeçalho padronizado (título + subtítulo +
 * ações à direita) sobre a superfície de vidro. Base dos blocos do painel.
 */
export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface flex flex-col rounded-xl ${className}`}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="min-w-0 flex-1 p-5">{children}</div>
    </section>
  );
}

/**
 * Tooltip customizado para os gráficos Recharts — legível no dark, com bolinha
 * de cor da série e valor formatado à direita. Passe via `content`.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; stroke?: string; fill?: string }>;
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-xl backdrop-blur-md">
      {label && (
        <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={p.name ?? i} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.color ?? p.stroke ?? p.fill }}
            />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-mono font-semibold text-foreground tabular-nums">
              {formatter && typeof p.value === "number" ? formatter(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
