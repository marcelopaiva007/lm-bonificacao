"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Trophy,
  CheckCircle2,
  Percent,
  Receipt,
  Users,
  Calendar,
  Sparkles,
  BarChart3,
  MapPin,
  Briefcase,
  Search,
  ArrowUpRight,
  Plus,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { periodoLabel } from "@/lib/periodo";
import { CARGOS } from "@/lib/constants";

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

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const cargoLabel = (cargo: string) =>
  CARGOS.find((c) => c.value === cargo)?.label ?? cargo;

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

function DeltaLinha({
  variacao,
  sufixo = "%",
  legenda,
  inverter = false,
}: {
  variacao: number | null;
  sufixo?: string;
  legenda: string;
  inverter?: boolean;
}) {
  if (variacao === null) {
    return <p className="text-[11px] text-slate-500 font-medium">Sem base de comparação</p>;
  }
  const subiu = variacao > 0.05;
  const caiu = variacao < -0.05;
  const Icone = subiu ? TrendingUp : caiu ? TrendingDown : Minus;
  const positivo = inverter ? caiu : subiu;
  const negativo = inverter ? subiu : caiu;

  const bgCor = positivo
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    : negativo
    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
    : "bg-slate-800 text-slate-400 border-slate-700";

  const sinal = variacao > 0 ? "+" : "";
  return (
    <div className="flex items-center gap-1.5 pt-1">
      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${bgCor}`}>
        <Icone className="size-3" />
        {sinal}
        {variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
        {sufixo}
      </span>
      <span className="text-[11px] text-slate-400 truncate">{legenda}</span>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  sub,
  delta,
  icone: Icon,
  accentColor = "cyan",
}: {
  titulo: string;
  valor: string;
  sub?: string;
  delta?: React.ReactNode;
  icone: React.ElementType;
  accentColor?: "cyan" | "blue" | "emerald" | "amber" | "rose" | "purple";
}) {
  const colorStyles = {
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-cyan-500/10",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/10",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-500/10",
  };

  return (
    <Card className="glass-card relative overflow-hidden border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30 hover:shadow-cyan-500/10">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{titulo}</p>
          <p className="text-2xl font-extrabold tracking-tight text-slate-100">{valor}</p>
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-sm ${colorStyles[accentColor]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      {(sub || delta) && (
        <div className="mt-3 space-y-1 border-t border-slate-800/60 pt-2.5">
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
          {delta}
        </div>
      )}
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-cyan-500/30 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-md text-xs space-y-1.5 min-w-40">
        <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span style={{ color: entry.color }} className="font-medium flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-slate-100">
              {typeof entry.value === "number" && entry.value > 1000
                ? fmtMoeda(entry.value)
                : fmtNum(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

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
  const [buscaRanking, setBuscaRanking] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState<string>("TODOS");

  const legendaAnterior = `vs ${periodoLabel(periodoAnterior)}`;

  const ticketMedio = resumo.aprovadas > 0 ? resumo.vendido / resumo.aprovadas : 0;
  const ticketMedioAnterior =
    resumoAnterior.aprovadas > 0 ? resumoAnterior.vendido / resumoAnterior.aprovadas : 0;
  const taxaCancelamento = resumo.lancadas > 0 ? (resumo.canceladas / resumo.lancadas) * 100 : 0;
  const taxaCancelamentoAnterior =
    resumoAnterior.lancadas > 0 ? (resumoAnterior.canceladas / resumoAnterior.lancadas) * 100 : 0;
  const pctBonificacao = resumo.vendido > 0 ? (resumo.bonificacao / resumo.vendido) * 100 : 0;

  const tendenciaData = tendencia.map((t) => ({ ...t, label: periodoLabel(t.periodo) }));
  const porCargoData = porCargo.map((c) => ({ ...c, label: cargoLabel(c.cargo) }));
  const aproveitamento = [
    { etapa: "Lançadas", qtd: resumo.lancadas, cor: "#0ea5e9" },
    { etapa: "Aprovadas", qtd: resumo.aprovadas, cor: "#10b981" },
    { etapa: "Canceladas", qtd: resumo.canceladas, cor: "#ef4444" },
  ];
  const composicaoVisivel = composicao.filter((c) => c.valor !== 0);

  const rankingFiltrado = useMemo(() => {
    return ranking.filter((r) => {
      const matchBusca =
        !buscaRanking ||
        r.nome.toLowerCase().includes(buscaRanking.toLowerCase()) ||
        r.cidade.toLowerCase().includes(buscaRanking.toLowerCase());
      const matchCargo = cargoFiltro === "TODOS" || r.cargo === cargoFiltro;
      return matchBusca && matchCargo;
    });
  }, [ranking, buscaRanking, cargoFiltro]);

  const topBonificacao = useMemo(
    () => [...rankingFiltrado].sort((a, b) => b.bonificacao - a.bonificacao),
    [rankingFiltrado]
  );
  const topVendas = useMemo(
    () => [...rankingFiltrado].sort((a, b) => b.valor - a.valor),
    [rankingFiltrado]
  );

  const semDados = resumo.lancadas === 0 && resumo.vendido === 0;

  return (
    <div className="space-y-6">
      {/* Control Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-slate-900/80 p-4 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 shadow-inner">
            <Calendar className="size-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-300">Período:</span>
            <Input
              type="month"
              value={periodo}
              onChange={(e) => e.target.value && router.push(`/?periodo=${e.target.value}`)}
              className="h-7 w-36 border-none bg-transparent p-0 text-xs font-bold text-cyan-400 focus:ring-0 cursor-pointer"
            />
          </div>

          {statusFechamento ? (
            <Badge
              variant={statusFechamento === "ABERTO" ? "outline" : "secondary"}
              className={
                statusFechamento === "ABERTO"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-semibold px-3 py-1 text-xs"
                  : "bg-slate-800 text-slate-300 px-3 py-1 text-xs"
              }
            >
              <span className={`mr-1.5 inline-block size-2 rounded-full ${statusFechamento === "ABERTO" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
              Fechamento {statusFechamento === "ABERTO" ? "aberto" : "congelado"}
            </Badge>
          ) : (
            <Badge variant="ghost" className="text-slate-400 text-xs">
              Sem fechamento neste período
            </Badge>
          )}

          {semDados && (
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
              ⚠️ Sem lançamentos registrados em {periodoLabel(periodo)}.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/lancamentos">
            <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs font-semibold">
              <Plus className="size-3.5 mr-1" /> Novo Lançamento
            </Button>
          </Link>
          <Link href="/relatorios">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-cyan-500 text-slate-950 font-semibold text-xs shadow-md">
              <FileText className="size-3.5 mr-1" /> Relatórios
            </Button>
          </Link>
        </div>
      </div>

      {/* Top 4 Core KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          titulo="Valor vendido"
          valor={fmtMoeda(resumo.vendido)}
          icone={DollarSign}
          accentColor="cyan"
          delta={
            <DeltaLinha
              variacao={variacaoPct(resumo.vendido, resumoAnterior.vendido)}
              legenda={legendaAnterior}
            />
          }
        />
        <KpiCard
          titulo="Bonificação total"
          valor={fmtMoeda(resumo.bonificacao)}
          icone={Trophy}
          accentColor="amber"
          sub={resumo.vendido > 0 ? `${fmtPct(pctBonificacao)} das vendas` : undefined}
          delta={
            <DeltaLinha
              variacao={variacaoPct(resumo.bonificacao, resumoAnterior.bonificacao)}
              legenda={legendaAnterior}
            />
          }
        />
        <KpiCard
          titulo="Vendas aprovadas"
          valor={fmtNum(resumo.aprovadas)}
          icone={CheckCircle2}
          accentColor="emerald"
          sub={`de ${fmtNum(resumo.lancadas)} lançadas`}
          delta={
            <DeltaLinha
              variacao={variacaoPct(resumo.aprovadas, resumoAnterior.aprovadas)}
              legenda={legendaAnterior}
            />
          }
        />
        <KpiCard
          titulo="Taxa de cancelamento"
          valor={fmtPct(taxaCancelamento)}
          icone={Percent}
          accentColor="rose"
          sub={`${fmtNum(resumo.canceladas)} canceladas`}
          delta={
            <DeltaLinha
              variacao={
                resumoAnterior.lancadas > 0 ? taxaCancelamento - taxaCancelamentoAnterior : null
              }
              sufixo=" p.p."
              legenda={legendaAnterior}
              inverter
            />
          }
        />
      </div>

      {/* Secondary Operational Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-md">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Receipt className="size-4.5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Ticket Médio</p>
            <p className="text-sm font-bold text-slate-200">{fmtMoeda(ticketMedio)} <span className="text-[10px] font-normal text-slate-400">/ venda</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-md">
          <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Users className="size-4.5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Vendedores Ativos</p>
            <p className="text-sm font-bold text-slate-200">{fmtNum(vendedoresComVenda)} <span className="text-[10px] font-normal text-slate-400">de {totalFuncionarios} cadastrados</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 backdrop-blur-md">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MapPin className="size-4.5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Cidades Atendidas</p>
            <p className="text-sm font-bold text-slate-200">{fmtNum(porCidade.length)} <span className="text-[10px] font-normal text-slate-400">com vendas neste mês</span></p>
          </div>
        </div>
      </div>

      {/* Structured Tabbed Dashboard Layout */}
      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-slate-950/90 border border-slate-800 p-1.5 rounded-xl shadow-lg">
          <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-bold text-xs py-2">
            <BarChart3 className="size-4 mr-1.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="distribution" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-bold text-xs py-2">
            <MapPin className="size-4 mr-1.5" /> Cidades & Produtos
          </TabsTrigger>
          <TabsTrigger value="financial" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-bold text-xs py-2">
            <Briefcase className="size-4 mr-1.5" /> Bonificação & Cargos
          </TabsTrigger>
          <TabsTrigger value="ranking" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-bold text-xs py-2">
            <Trophy className="size-4 mr-1.5" /> Ranking Completo
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: VISÃO GERAL */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Trend Line (2 cols) */}
            <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl lg:col-span-2">
              <CardHeader className="px-0 pt-0 pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <TrendingUp className="size-4 text-cyan-400" />
                    Evolução Mensal de Vendas & Bonificação
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Histórico dos últimos 12 meses registrados no sistema
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="h-80 px-0">
                {tendenciaData.length === 0 ? (
                  <p className="text-sm text-slate-400 py-10 text-center">Sem histórico suficiente ainda.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tendenciaData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cyanLineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => fmtMoeda(Number(v))} width={85} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="vendido"
                        name="Valor Vendido"
                        stroke="#06b6d4"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#06b6d4" }}
                        activeDot={{ r: 7, stroke: "#06b6d4", strokeWidth: 2, fill: "#090d16" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="bonificacao"
                        name="Bonificação Total"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="5 3"
                        dot={{ r: 4, fill: "#f59e0b" }}
                        activeDot={{ r: 6, stroke: "#f59e0b", strokeWidth: 2, fill: "#090d16" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales Funnel / Aproveitamento (1 col) */}
            <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl">
              <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-sm font-bold text-slate-200">
                  Funil de Aproveitamento
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Eficiência das vendas no período
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80 px-0 flex flex-col justify-between">
                {semDados ? (
                  <p className="text-sm text-slate-400 py-10 text-center">Sem lançamentos no período.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="80%">
                      <BarChart data={aproveitamento} layout="vertical" margin={{ left: 16, right: 36 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                        <YAxis dataKey="etapa" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="qtd" name="Quantidade" radius={[0, 6, 6, 0]}>
                          {aproveitamento.map((a) => (
                            <Cell key={a.etapa} fill={a.cor} />
                          ))}
                          <LabelList
                            dataKey="qtd"
                            position="right"
                            className="fill-slate-300 font-mono text-[11px]"
                            formatter={(v: any) => fmtNum(Number(v))}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Top 3 Quick Preview */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Top 3 Vendedores do Mês</p>
                      <div className="space-y-1">
                        {topBonificacao.slice(0, 3).map((v, i) => (
                          <div key={v.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-950/60 border border-slate-800">
                            <span className="font-semibold text-slate-200 truncate max-w-28">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {v.nome}
                            </span>
                            <span className="font-mono text-amber-400 font-bold">{fmtMoeda(v.bonificacao)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: CIDADES & PRODUTOS */}
        <TabsContent value="distribution" className="space-y-6 mt-0">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales by City */}
            <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl">
              <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-sm font-bold text-slate-200">
                  Valor Vendido por Cidade — {periodoLabel(periodo)}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Volume financeiro instalado por praça de atendimento
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80 px-0">
                {porCidade.length === 0 ? (
                  <p className="text-sm text-slate-400 py-10 text-center">Sem lançamentos neste período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porCidade} layout="vertical" margin={{ left: 24, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickFormatter={(v) => fmtMoeda(Number(v))}
                      />
                      <YAxis dataKey="cidade" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} width={95} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="valor" name="Valor Vendido" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Product Mix */}
            <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl">
              <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-sm font-bold text-slate-200">
                  Mix de Produtos Vendidos — {periodoLabel(periodo)}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Quantidade total ativada por categoria de serviço
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80 px-0">
                {semDados ? (
                  <p className="text-sm text-slate-400 py-10 text-center">Sem lançamentos neste período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mixProdutos} layout="vertical" margin={{ left: 24, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                      <YAxis dataKey="produto" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qtd" name="Quantidade" fill="#10b981" radius={[0, 6, 6, 0]}>
                        <LabelList
                          dataKey="qtd"
                          position="right"
                          className="fill-slate-300 font-mono text-[11px]"
                          formatter={(v: any) => fmtNum(Number(v))}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: BONIFICAÇÃO & CARGOS */}
        <TabsContent value="financial" className="space-y-6 mt-0">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bonus Composition */}
            <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl">
              <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-sm font-bold text-slate-200">
                  Composição da Bonificação — {periodoLabel(periodo)}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Distribuição dos valores por modalidade de bônus
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80 px-0">
                {composicaoVisivel.length === 0 ? (
                  <p className="text-sm text-slate-400 py-10 text-center">
                    Sem bonificações calculadas neste período.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={composicaoVisivel}
                      layout="vertical"
                      margin={{ left: 24, right: 56 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickFormatter={(v) => fmtMoeda(Number(v))}
                      />
                      <YAxis dataKey="componente" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} width={95} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="valor" name="Valor" fill="#f59e0b" radius={[0, 6, 6, 0]}>
                        <LabelList
                          dataKey="valor"
                          position="right"
                          className="fill-slate-300 font-mono text-[11px]"
                          formatter={(v) => fmtMoeda(Number(v))}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Performance by Cargo */}
            <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl">
              <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-sm font-bold text-slate-200">
                  Desempenho por Cargo — {periodoLabel(periodo)}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Vendas e bonificação agrupadas por função
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80 px-0">
                {porCargoData.length === 0 ? (
                  <p className="text-sm text-slate-400 py-10 text-center">Sem dados neste período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porCargoData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => fmtMoeda(Number(v))} width={85} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
                      <Bar dataKey="vendido" name="Valor Vendido" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bonificacao" name="Bonificação" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: RANKING COMPLETO */}
        <TabsContent value="ranking" className="space-y-6 mt-0">
          <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-5 shadow-xl">
            <CardHeader className="px-0 pt-0 pb-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Trophy className="size-4 text-amber-400" />
                  Ranking Completo de Funcionários — {periodoLabel(periodo)}
                </CardTitle>
                {totalAjustes !== 0 && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                    Ajustes manuais: <strong>{fmtMoeda(totalAjustes)}</strong>
                  </span>
                )}
              </div>

              {/* Ranking Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar vendedor ou cidade..."
                    value={buscaRanking}
                    onChange={(e) => setBuscaRanking(e.target.value)}
                    className="pl-9 bg-slate-950/60 border-slate-800 text-xs"
                  />
                </div>
                <Select value={cargoFiltro} onValueChange={(v) => setCargoFiltro(v ?? "TODOS")}>
                  <SelectTrigger className="bg-slate-950/60 border-slate-800 text-xs">
                    <SelectValue placeholder="Filtrar por cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os Cargos</SelectItem>
                    {CARGOS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="px-0">
              <Tabs defaultValue="bonificacao" className="w-full">
                <TabsList className="bg-slate-950/80 border border-slate-800 p-1 rounded-lg">
                  <TabsTrigger value="bonificacao" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-semibold text-xs px-4">
                    🥇 Por Maior Bonificação
                  </TabsTrigger>
                  <TabsTrigger value="vendas" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-semibold text-xs px-4">
                    💰 Por Maior Valor Vendido
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="bonificacao" className="mt-4">
                  <RankingTable linhas={topBonificacao} totalBonificacao={resumo.bonificacao} />
                </TabsContent>
                <TabsContent value="vendas" className="mt-4">
                  <RankingTable linhas={topVendas} totalBonificacao={resumo.bonificacao} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RankingTable({
  linhas,
  totalBonificacao,
}: {
  linhas: RankingLinha[];
  totalBonificacao: number;
}) {
  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="text-base" title="1º Lugar">🥇</span>;
    if (index === 1) return <span className="text-base" title="2º Lugar">🥈</span>;
    if (index === 2) return <span className="text-base" title="3º Lugar">🥉</span>;
    return <span className="font-mono text-xs text-slate-400 font-bold">#{index + 1}</span>;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 shadow-inner">
      <Table>
        <TableHeader className="bg-slate-900/90">
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Funcionário</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead className="text-right">Aprovadas</TableHead>
            <TableHead className="text-right">Valor vendido</TableHead>
            <TableHead className="text-right">Bonificação</TableHead>
            <TableHead className="w-40 text-right">% da Bonificação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-slate-400">
                Nenhum funcionário encontrado.
              </TableCell>
            </TableRow>
          )}
          {linhas.map((l, i) => {
            const pct = totalBonificacao > 0 ? (l.bonificacao / totalBonificacao) * 100 : 0;
            return (
              <TableRow key={l.id} className="border-slate-800/60 hover:bg-slate-900/50 transition-colors">
                <TableCell className="text-center">{getRankBadge(i)}</TableCell>
                <TableCell className="font-semibold text-slate-100">{l.nome}</TableCell>
                <TableCell className="text-slate-300">{l.cidade}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-slate-700/80 bg-slate-900/80 text-slate-300 text-[11px]">
                    {cargoLabel(l.cargo)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-emerald-400">{fmtNum(l.aprovadas)}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-cyan-400">{fmtMoeda(l.valor)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-amber-400">{fmtMoeda(l.bonificacao)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono text-xs text-slate-300">
                      {totalBonificacao > 0 ? fmtPct(pct) : "—"}
                    </span>
                    {totalBonificacao > 0 && (
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-amber-400"
                          style={{ width: `${Math.min(pct * 2.5, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
