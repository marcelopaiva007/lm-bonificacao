/**
 * Minigráfico de linha (sparkline) em SVG puro — sem dependências. Usado nos
 * cards de KPI para dar o contexto de tendência recente sem ocupar espaço.
 */
export function Sparkline({
  data,
  tone = "accent",
  className = "",
}: {
  data: number[];
  tone?: "accent" | "success" | "destructive" | "primary" | "warn";
  className?: string;
}) {
  const w = 120;
  const h = 32;

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((v - min) / span) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const id = `sp-${tone}-${data.length}-${Math.round(max)}`;
  const stroke = `var(--${tone})`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      className={`h-8 w-full ${className}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
