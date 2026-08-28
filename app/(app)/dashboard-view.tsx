"use client";

import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  BadgeDollarSign,
  Banknote,
  CheckCircle2,
  XCircle,
  Coins,
  UserCheck,
  MapPin,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, ChartTooltip } from "@/components/ui/chart-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { periodoLabel } from "@/lib/periodo";
import { CARGOS } from "@/lib/constants";
import { brl, int, pct } from "@/lib/format";

export type ResumoPeriodo = {
  vendido: number;
  bonificacao: number;
  lancadas: number;
  aprovadas: number;
  canceladas: number;
};

export type RankingLinha = {
  id: string;
  nome: string;
  cidade: string;
  cargo: string;
  aprovadas: number;
  valor: number;
  bonificacao: number;
};

const CHART = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const cargoLabel = (cargo: string) =>
  CARGOS.find((c) => c.value === cargo)?.label ?? cargo;

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export function DashboardView({
  periodo,
  periodoAnterior,
  statusFechamento,
  totalFuncionarios,
  totalCidades,
  vendedoresComVenda,
  resumo,
  resumoAnterior,
  totalAjustes,
  tendencia,
  porCidade,
  mixProdutos,
  composicao,
  porCargo,
  ranking,
}: {
  periodo: string;
  periodoAnterior: string;
  statusFechamento: string | null;
  totalFuncionarios: number;
  totalCidades: number;
  vendedoresComVenda: number;
  resumo: ResumoPeriodo;
  resumoAnterior: ResumoPeriodo;
  totalAjustes: number;
  tendencia: { periodo: string; vendido: number; bonificacao: number }[];
  porCidade: { cidade: string; valor: number; aprovadas: number }[];
  mixProdutos: { produto: string; qtd: number }[];
  composicao: { componente: string; valor: number }[];
  porCargo: { cargo: string; vendido: number; bonificacao: number }[];
  ranking: RankingLinha[];
}) {
  const router = useRouter();
  const legendaAnterior = `vs ${periodoLabel(periodoAnterior)}`;

  const ticketMedio = resumo.aprovadas > 0 ? resumo.vendido / resumo.aprovadas : 0;
  const ticketMedioAnterior =
    resumoAnterior.aprovadas > 0 ? resumoAnterior.vendido / resumoAnterior.aprovadas : 0;
  const taxaCancelamento = resumo.lancadas > 0 ? (resumo.canceladas / resumo.lancadas) * 100 : 0;
  const taxaCancelamentoAnterior =
    resumoAnterior.lancadas > 0 ? (resumoAnterior.canceladas / resumoAnterior.lancadas) * 100 : 0;
  const pctBonificacao = resumo.vendido > 0 ? (resumo.bonificacao / resumo.vendido) * 100 : 0;

  const tendenciaData = tendencia.map((t) => ({ ...t, label: periodoLabel(t.periodo) }));
  const sparkVendido = tendencia.map((t) => t.vendido);
  const sparkBonificacao = tendencia.map((t) => t.bonificacao);
  const porCargoData = porCargo.map((c) => ({ ...c, label: cargoLabel(c.cargo) }));
  const composicaoVisivel = composicao.filter((c) => c.valor !== 0);
  const totalComposicao = composicaoVisivel.reduce((s, c) => s + c.valor, 0);
  const cidadeMax = porCidade.length > 0 ? Math.max(...porCidade.map((c) => c.valor)) : 0;

  const topBonificacao = [...ranking].sort((a, b) => b.bonificacao - a.bonificacao).slice(0, 10);
  const topVendas = [...ranking].sort((a, b) => b.valor - a.valor).slice(0, 10);

  const semDados = resumo.lancadas === 0 && resumo.vendido === 0;

  return (
    <div className="space-y-4">
      {/* Controles: período + situação do fechamento */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="month"
          value={periodo}
          onChange={(e) => e.target.value && router.push(`/?periodo=${e.target.value}`)}
          className="w-44"
        />
        {statusFechamento ? (
          <Badge
            variant={statusFechamento === "ABERTO" ? "outline" : "secondary"}
            className={
              statusFechamento === "ABERTO"
                ? "border-transparent bg-success/10 text-success"
                : undefined
            }
          >
            Fechamento {statusFechamento === "ABERTO" ? "aberto" : "fechado"}
          </Badge>
        ) : (
          <Badge variant="ghost">Sem fechamento neste período</Badge>
        )}
        {semDados && (
          <span className="text-sm text-muted-foreground">
            Nenhum lançamento em {periodoLabel(periodo)}.
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Valor vendido"
          value={brl(resumo.vendido)}
          delta={variacaoPct(resumo.vendido, resumoAnterior.vendido)}
          icon={BadgeDollarSign}
          tone="primary"
          spark={sparkVendido}
          hint={legendaAnterior}
        />
        <KpiCard
          label="Bonificação total"
          value={brl(resumo.bonificacao)}
          delta={variacaoPct(resumo.bonificacao, resumoAnterior.bonificacao)}
          icon={Banknote}
          tone="accent"
          spark={sparkBonificacao}
          hint={resumo.vendido > 0 ? `${pct(pctBonificacao).replace("+", "")} do vendido` : legendaAnterior}
        />
        <KpiCard
          label="Vendas aprovadas"
          value={int(resumo.aprovadas)}
          delta={variacaoPct(resumo.aprovadas, resumoAnterior.aprovadas)}
          icon={CheckCircle2}
          tone="success"
          hint={`de ${int(resumo.lancadas)} lançadas`}
        />
        <KpiCard
          label="Taxa de cancelamento"
          value={pct(taxaCancelamento).replace("+", "")}
          delta={
            resumoAnterior.lancadas > 0 ? taxaCancelamento - taxaCancelamentoAnterior : null
          }
          deltaSuffix=" p.p."
          icon={XCircle}
          tone="destructive"
          invert
          hint={`${int(resumo.canceladas)} canceladas`}
        />
        <KpiCard
          label="Ticket médio"
          value={brl(ticketMedio)}
          delta={variacaoPct(ticketMedio, ticketMedioAnterior)}
          icon={Coins}
          tone="primary"
          hint="por venda aprovada"
        />
        <KpiCard
          label="Vendedores com venda"
          value={int(vendedoresComVenda)}
          icon={UserCheck}
          tone="success"
          hint={`de ${int(totalFuncionarios)} ativos`}
        />
        <KpiCard
          label="Cidades atendidas"
          value={int(totalCidades)}
          icon={MapPin}
          tone="accent"
        />
        <KpiCard
          label="Ajustes"
          value={brl(totalAjustes)}
          icon={SlidersHorizontal}
          tone="warn"
          hint="no período"
        />
      </div>

      {/* Tendência + composição da bonificação */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Tendência — últimos 12 meses"
          subtitle="Valor vendido x bonificação paga"
          className="xl:col-span-2"
          actions={
            <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-1" /> Vendido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-accent" /> Bonificação
              </span>
            </div>
          }
        >
          {tendenciaData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico suficiente ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={264}>
              <AreaChart data={tendenciaData} margin={{ left: -12, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="gVend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} tickFormatter={(v) => brl(Number(v), true)} width={64} />
                <Tooltip
                  cursor={{ stroke: "var(--accent)", strokeOpacity: 0.35 }}
                  content={<ChartTooltip formatter={(v) => brl(v)} />}
                />
                <Area
                  type="monotone"
                  dataKey="vendido"
                  name="Vendido"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#gVend)"
                />
                <Area
                  type="monotone"
                  dataKey="bonificacao"
                  name="Bonificação"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#gBon)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Composição da bonificação"
          subtitle={totalComposicao > 0 ? `Total ${brl(totalComposicao)}` : "Sem bonificação no período"}
        >
          {composicaoVisivel.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem bonificações calculadas neste período.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={composicaoVisivel}
                    dataKey="valor"
                    nameKey="componente"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {composicaoVisivel.map((_, i) => (
                      <Cell key={i} fill={CHART[i % CHART.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v) => brl(v)} />} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-3 space-y-1.5">
                {composicaoVisivel.map((c, i) => (
                  <li key={c.componente} className="flex items-center gap-2 text-xs">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: CHART[i % CHART.length] }}
                    />
                    <span className="min-w-0 truncate text-muted-foreground">{c.componente}</span>
                    <span className="ml-auto font-mono font-medium tabular-nums">{brl(c.valor)}</span>
                    <span className="w-12 text-right font-mono text-muted-foreground tabular-nums">
                      {((c.valor / totalComposicao) * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartCard>
      </div>

      {/* Mix de produtos + desempenho por cidade */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Mix de produtos" subtitle={`Vendas aprovadas em ${periodoLabel(periodo)}`}>
          {semDados ? (
            <p className="text-sm text-muted-foreground">Sem lançamentos neste período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={268}>
              <BarChart data={mixProdutos} margin={{ left: -18, right: 6, top: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="produto" {...axis} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--accent)", fillOpacity: 0.06 }}
                  content={<ChartTooltip formatter={(v) => int(v)} />}
                />
                <Bar dataKey="qtd" name="Vendas" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {mixProdutos.map((_, i) => (
                    <Cell key={i} fill={CHART[i % CHART.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Desempenho por cidade" subtitle="Valor vendido e vendas aprovadas">
          {porCidade.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem lançamentos neste período.</p>
          ) : (
            <ul className="space-y-3.5">
              {porCidade.map((c) => (
                <li key={c.cidade}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{c.cidade}</span>
                    <span className="shrink-0 font-mono font-semibold tabular-nums">{brl(c.valor)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: cidadeMax > 0 ? `${(c.valor / cidadeMax) * 100}%` : "0%",
                        backgroundImage: "var(--gradient-brand)",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    <span className="font-mono tabular-nums">{int(c.aprovadas)}</span> aprovadas
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Desempenho por cargo + ranking */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Desempenho por cargo" subtitle="Vendido x bonificação">
          {porCargoData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados neste período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porCargoData} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v) => brl(Number(v), true)} />
                <YAxis type="category" dataKey="label" {...axis} width={104} />
                <Tooltip
                  cursor={{ fill: "var(--accent)", fillOpacity: 0.06 }}
                  content={<ChartTooltip formatter={(v) => brl(v)} />}
                />
                <Bar dataKey="vendido" name="Vendido" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={14} />
                <Bar dataKey="bonificacao" name="Bonificação" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <section className="surface flex flex-col overflow-hidden rounded-xl xl:col-span-2">
          <header className="border-b border-border/60 px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight">Ranking de vendedores</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Top 10 em {periodoLabel(periodo)}
            </p>
          </header>
          <div className="p-3">
            <Tabs defaultValue="bonificacao">
              <TabsList>
                <TabsTrigger value="bonificacao">Top bonificação</TabsTrigger>
                <TabsTrigger value="vendas">Top vendas</TabsTrigger>
              </TabsList>
              <TabsContent value="bonificacao" className="mt-3">
                <RankingTabela linhas={topBonificacao} totalBonificacao={resumo.bonificacao} />
              </TabsContent>
              <TabsContent value="vendas" className="mt-3">
                <RankingTabela linhas={topVendas} totalBonificacao={resumo.bonificacao} />
              </TabsContent>
            </Tabs>
            {totalAjustes !== 0 && (
              <p className="mt-3 px-2 text-xs text-muted-foreground">
                Ajustes manuais no período: {brl(totalAjustes)} (já considerados na composição).
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function RankingTabela({
  linhas,
  totalBonificacao,
}: {
  linhas: RankingLinha[];
  totalBonificacao: number;
}) {
  const cols: Column<RankingLinha & { pos: number }>[] = [
    {
      key: "pos",
      header: "#",
      width: "56px",
      cell: (r) => (
        <span
          className={[
            "inline-grid size-6 place-items-center rounded-md font-mono text-[11px] font-bold tabular-nums",
            r.pos === 1
              ? "bg-warn/15 text-warn"
              : r.pos === 2
                ? "bg-accent/15 text-accent"
                : r.pos === 3
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground",
          ].join(" ")}
        >
          {r.pos}
        </span>
      ),
    },
    {
      key: "nome",
      header: "Vendedor",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{r.nome}</span>
          {r.pos <= 3 && <Trophy className="size-3.5 shrink-0 text-warn/80" />}
        </div>
      ),
    },
    { key: "cidade", header: "Cidade", cell: (r) => <span className="text-muted-foreground">{r.cidade}</span> },
    { key: "cargo", header: "Cargo", cell: (r) => <span className="text-muted-foreground">{cargoLabel(r.cargo)}</span> },
    { key: "aprovadas", header: "Aprovadas", align: "right", cell: (r) => int(r.aprovadas) },
    { key: "vendido", header: "Valor vendido", align: "right", cell: (r) => brl(r.valor) },
    {
      key: "bonificacao",
      header: "Bonificação",
      align: "right",
      cell: (r) => <span className="font-semibold text-accent">{brl(r.bonificacao)}</span>,
    },
    {
      key: "pctbon",
      header: "% da bonif.",
      align: "right",
      cell: (r) =>
        totalBonificacao > 0 ? `${((r.bonificacao / totalBonificacao) * 100).toFixed(1)}%` : "—",
    },
  ];

  const rows = linhas.map((l, i) => ({ ...l, pos: i + 1 }));

  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.id}
      maxHeight="380px"
      minWidth="720px"
      emptyTitle="Sem dados neste período"
      emptyHint="Nenhum vendedor com lançamentos no período selecionado."
    />
  );
}
