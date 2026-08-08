"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, History, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "EDITAR":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "EXCLUIR":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    case "FECHAR_MES":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "REABRIR_MES":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
    case "MESCLAR":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
    case "IMPORTAR":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-background shadow-xs">
            <History className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Trilha de Auditoria</h1>
            <p className="text-sm text-muted-foreground">
              Histórico append-only de ações e alterações realizadas no sistema.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportar} disabled={logs.length === 0}>
            <Download className="size-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" /> Filtros de Auditoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Mês de Referência</label>
              <Input
                type="month"
                value={filtros.periodo}
                onChange={(e) => atualizarFiltros({ periodo: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Módulo</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
              <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de Ação</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
              <label className="text-xs font-medium text-muted-foreground block mb-1">Buscar (Usuário / Detalhes)</label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  atualizarFiltros({ busca: buscaText });
                }}
                className="relative"
              >
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Pressione Enter..."
                  value={buscaText}
                  onChange={(e) => setBuscaText(e.target.value)}
                  className="pl-8"
                />
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Data / Hora</TableHead>
              <TableHead className="w-48">Usuário</TableHead>
              <TableHead className="w-32">Módulo</TableHead>
              <TableHead className="w-32">Ação</TableHead>
              <TableHead>Detalhes da Operação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum registro de auditoria encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.dataHora).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-xs">{log.usuarioNome}</div>
                    <div className="text-[10px] text-muted-foreground">{log.usuarioRole}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.modulo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={acaoBadgeClass(log.acao)}>
                      {log.acao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{log.detalhes}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
