import type { ReactNode } from "react";

/**
 * Cabeçalho de página padronizado: eyebrow (rótulo de seção em ciano), título,
 * descrição e uma área de ações à direita.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-6 sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold tracking-[0.18em] text-accent/80 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground sm:text-[13px]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
