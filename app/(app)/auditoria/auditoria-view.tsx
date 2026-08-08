"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, History, Search, ShieldCheck, GitCommit, Sparkles, CheckCircle2, Clock, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type AuditLogItem = {
  id: string;
  usuarioNome: string;
  usuarioRole: string;
  acao: string;
  modulo: string;
  detalhes: string;
  dataHora: Date;
  metadata: unknown;
};

export type SystemReleaseItem = {
  id: string;
  versao: string;
  data: string;
  hora: string;
  autor: string;
  modulo: string;
  resumo: string;
  detalhes: string[];
  status: "APLICADO" | "EM_HOMOLOGACAO";
};

const SYSTEM_RELEASES: SystemReleaseItem[] = [
  {
    id: "rel-021",
    versao: "0.2.1",
    data: "08/08/2026",
    hora: "15:45:00",
    autor: "Marcelo Paiva (Dev Lead)",
    modulo: "Interface, Performance & Versão",
    resumo: "Redesenho do layout do Dashboard, otimizações Prisma/Next.js e controle de versão dinâmico",
    status: "APLICADO",
    detalhes: [
      "Ajuste da altura e proporção da tela do Dashboard Executivo com agrupamento em abas (Vendas x Ranking x Histórico) e limite fixo no gráfico de linha (h-64).",
      "Otimização de performance de banco de dados no PostgreSQL substituindo 'include' por seleção cirúrgica de campos ('select') nas consultas Prisma.",
      "Implementação de cache de servidor Next.js com 'unstable_cache' e revalidação de 60 segundos para dados de Fechamento Mensal.",
      "Sincronização dinâmica da versão exibida no sistema vinculada diretamente ao package.json (v0.2.1).",
      "Criação do módulo de Auditoria de Atualizações do Sistema (Data, Hora, Versão, Autor e Detalhamento das Alterações).",
    ],
  },
  {
    id: "rel-020",
    versao: "0.2.0",
    data: "01/08/2026",
    hora: "10:00:00",
    autor: "Equipe de Engenharia L&M",
    modulo: "Regras & Bonificação",
    resumo: "Novo motor de cálculo de bonificação e aceleradores por faixas de atingimento de meta",
    status: "APLICADO",
    detalhes: [
      "Reestruturação do motor de cálculo de comissões com suporte a aceleradores por meta batida.",
      "Tabela flexível de vigência de regras de bonificação por cargo comercial.",
      "Trilha de auditoria append-only para registro de operações críticas e alteração de parâmetros.",
    ],
  },
  {
    id: "rel-010",
    versao: "0.1.0",
    data: "15/07/2026",
    hora: "08:30:00",
    autor: "Equipe de Engenharia L&M",
    modulo: "Cadastros & Lançamentos",
    resumo: "Lançamento inicial da plataforma SOFT VENDAS da L&M Telecom",
    status: "APLICADO",
    detalhes: [
      "Módulo de cadastros centrais (Funcionários, Equipes, Cidades, Cargos, Supervisores).",
      "Lançamento individual de vendas por produto (Internet, TV, Chip Móvel, GPS, Streaming, Fixa).",
      "Módulo de fechamento mensal com bloqueio/congelamento de períodos de apuração.",
      "Importação manual de planilhas de relatórios Elleven e Vendas de Chip Móvel.",
    ],
  },
];

const MODULOS = [
  { value: "TODOS", label: "Todos os Módulos" },
  { value: "FUNCIONARIOS", label: "Funcionários" },
  { value: "LANCAMENTOS", label: "Lançamentos" },
  { value: "REGRAS", label: "Regras de Bonificação" },
  { value: "FECHAMENTO", label: "Fechamento Mensal" },
  { value: "IMPORTACAO", label: "Importação Manual" },
  { value: "ELLEVEN", label: "Elleven" },
  { value: "CIDADES", label: "Cidades" },
  { value: "EQUIPES", label: "Equipes" },
];

const ACOES = [
  { value: "TODAS", label: "Todas as Ações" },
  { value: "CRIAR", label: "Criar" },
  { value: "EDITAR", label: "Editar" },
  { value: "EXCLUIR", label: "Excluir" },
  { value: "FECHAR_MES", label: "Fechar Mês" },
  { value: "REABRIR_MES", label: "Reabrir Mês" },
  { value: "RECALCULAR", label: "Recalcular" },
  { value: "MESCLAR", label: "Mesclar" },
  { value: "IMPORTAR", label: "Importar" },
];

function acaoBadgeClass(acao: string) {
  switch (acao) {
    case "CRIAR":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
    case "EDITAR":
      return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30";
    case "EXCLUIR":
      return "bg-rose-500/10 text-rose-400 border border-rose-500/30";
    case "FECHAR_MES":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
    case "REABRIR_MES":
      return "bg-purple-500/10 text-purple-400 border border-purple-500/30";
    case "MESCLAR":
      return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30";
    case "IMPORTAR":
      return "bg-sky-500/10 text-sky-400 border border-sky-500/30";
    default:
      return "bg-slate-800 text-slate-300 border border-slate-700";
  }
}

export function AuditoriaView({
  logs,
  filtros,
}: {
  logs: AuditLogItem[];
  filtros: { modulo: string; acao: string; busca: string; periodo: string };
}) {
  const router = useRouter();
  const [buscaText, setBuscaText] = useState(filtros.busca);

  function atualizarFiltros(novos: Partial<typeof filtros>) {
    const f = { ...filtros, ...novos };
    const params = new URLSearchParams();
    if (f.modulo && f.modulo !== "TODOS") params.set("modulo", f.modulo);
    if (f.acao && f.acao !== "TODAS") params.set("acao", f.acao);
    if (f.busca) params.set("busca", f.busca);
    if (f.periodo) params.set("periodo", f.periodo);
    router.push(`/auditoria?${params.toString()}`);
  }

  async function handleExportar() {
    const XLSX = await import("xlsx");
    const wsData = [
      ["L&M Telecom — SOFT VENDAS"],
      ["Trilha de Auditoria do Sistema"],
      [],
      ["Data / Hora", "Usuário", "Perfil", "Módulo", "Ação", "Detalhes"],
      ...logs.map((l) => [
        new Date(l.dataHora).toLocaleString("pt-BR"),
        l.usuarioNome,
        l.usuarioRole,
        l.modulo,
        l.acao,
        l.detalhes,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, `trilha-de-auditoria-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-500/20 bg-slate-900/80 p-4 shadow-lg backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-sm shadow-cyan-500/20">
            <History className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Trilha de Auditoria & Versões
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro append-only de operações do sistema e histórico oficial de atualizações e releases.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExportar} disabled={logs.length === 0} className="border-slate-800 bg-slate-900/80 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-cyan-400">
            <Download className="size-3.5 mr-1.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="versoes" className="w-full space-y-4">
        <TabsList className="bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <TabsTrigger value="versoes" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 font-bold text-xs gap-2">
            <GitCommit className="size-4 text-cyan-400" />
            Atualizações do Sistema ({SYSTEM_RELEASES.length})
          </TabsTrigger>
          <TabsTrigger value="operacoes" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 font-bold text-xs gap-2">
            <ShieldCheck className="size-4 text-emerald-400" />
            Auditoria de Operações ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: System Release History Audit Log */}
        <TabsContent value="versoes" className="space-y-4">
          <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-4 shadow-xl">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="size-4 text-cyan-400" />
                Histórico Oficial de Atualizações do Sistema (Changelog de Auditoria)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Registro detalhado de cada versão publicada, data, hora, responsabilidade e resumo das implementações.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
              {SYSTEM_RELEASES.map((release) => (
                <div
                  key={release.id}
                  className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-4 shadow-lg backdrop-blur-md hover:border-cyan-500/30 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-extrabold text-cyan-300 shadow-sm shadow-cyan-500/20 font-mono">
                        <GitCommit className="size-3.5" /> v{release.versao}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">{release.resumo}</h3>
                        <p className="text-[11px] text-cyan-400 font-medium">Módulo: {release.modulo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar className="size-3.5 text-slate-400" />
                        <span>{release.data}</span>
                        <Clock className="size-3.5 text-slate-400 ml-1" />
                        <span>{release.hora}</span>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        <CheckCircle2 className="size-3 mr-1" /> {release.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <User className="size-3.5 text-cyan-400" />
                      <span>Responsável / Autor: <strong className="text-slate-100">{release.autor}</strong></span>
                    </div>
                    <ul className="space-y-1.5 pl-4 text-xs text-slate-300">
                      {release.detalhes.map((item, idx) => (
                        <li key={idx} className="list-disc leading-relaxed text-slate-300">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Operations Audit Log */}
        <TabsContent value="operacoes" className="space-y-4">
          <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-4 shadow-xl">
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" /> Filtros de Auditoria de Operações
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Mês de Referência</label>
                  <Input
                    type="month"
                    value={filtros.periodo}
                    onChange={(e) => atualizarFiltros({ periodo: e.target.value })}
                    className="border-slate-800 bg-slate-950 text-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Módulo</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-100 shadow-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    value={filtros.modulo}
                    onChange={(e) => atualizarFiltros({ modulo: e.target.value })}
                  >
                    {MODULOS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Tipo de Ação</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-100 shadow-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    value={filtros.acao}
                    onChange={(e) => atualizarFiltros({ acao: e.target.value })}
                  >
                    {ACOES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Buscar (Usuário / Detalhes)</label>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      atualizarFiltros({ busca: buscaText });
                    }}
                    className="relative"
                  >
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                    <Input
                      placeholder="Pressione Enter..."
                      value={buscaText}
                      onChange={(e) => setBuscaText(e.target.value)}
                      className="pl-8 border-slate-800 bg-slate-950 text-slate-100 text-xs"
                    />
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 shadow-xl">
            <Table>
              <TableHeader className="bg-slate-900/90">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="w-40 font-bold text-slate-300">Data / Hora</TableHead>
                  <TableHead className="w-48 font-bold text-slate-300">Usuário</TableHead>
                  <TableHead className="w-32 font-bold text-slate-300">Módulo</TableHead>
                  <TableHead className="w-32 font-bold text-slate-300">Ação</TableHead>
                  <TableHead className="font-bold text-slate-300">Detalhes da Operação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-400">
                      Nenhum registro de auditoria encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="border-slate-800/60 hover:bg-slate-900/50 transition-colors">
                      <TableCell className="font-mono text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.dataHora).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-xs text-slate-200">{log.usuarioNome}</div>
                        <div className="text-[10px] text-cyan-400 font-mono">{log.usuarioRole}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 text-[10px]">
                          {log.modulo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] font-bold ${acaoBadgeClass(log.acao)}`}>
                          {log.acao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">{log.detalhes}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
