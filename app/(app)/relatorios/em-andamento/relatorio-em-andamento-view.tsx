"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Download, Clock, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
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
import { periodoLabel } from "@/lib/periodo";
import type { ResumoVendasEmAndamento } from "@/lib/actions/vendas-em-andamento";

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RelatorioEmAndamentoView({
  periodo,
  dados,
}: {
  periodo: string;
  dados: ResumoVendasEmAndamento;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return dados.vendas;
    return dados.vendas.filter(
      (v) =>
        v.vendedor.toLowerCase().includes(termo) ||
        v.cliente.toLowerCase().includes(termo) ||
        v.cidade.toLowerCase().includes(termo) ||
        v.contrato.toLowerCase().includes(termo) ||
        v.servico.toLowerCase().includes(termo)
    );
  }, [dados.vendas, busca]);

  async function handleExportar() {
    const XLSX = await import("xlsx");
    const wsData = [
      ["L&M Telecom"],
      [`Relatório de Vendas em Andamento — ${periodo ? periodoLabel(periodo) : "Todas"}`],
      [],
      ["Contrato", "Vendedor", "Cliente", "Cidade", "Serviço", "Valor R$", "Data Contrato", "Prazo Instalação", "Status"],
      ...vendasFiltradas.map((v) => [
        v.contrato,
        v.vendedor,
        v.cliente,
        v.cidade,
        v.servico,
        v.valorServico,
        v.dataContrato,
        v.prazoAtivacao,
        v.statusContrato,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Em Andamento");
    XLSX.writeFile(wb, `vendas-em-andamento-${periodo || "todas"}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/relatorios">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Vendas em Andamento</h1>
            <p className="text-sm text-muted-foreground">
              Vendas contratadas no Elleven que ainda pendem de instalação/ativação.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={periodo}
            onChange={(e) => router.push(`/relatorios/em-andamento?periodo=${e.target.value}`)}
            className="w-44"
          />
          <Button variant="outline" onClick={handleExportar} disabled={vendasFiltradas.length === 0}>
            <Download className="size-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="size-4 text-amber-500" /> Total em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{dados.totalCount} contrato(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Estimado em Instalação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmtMoeda(dados.valorTotalEstimado)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, vendedor, cidade ou contrato..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrato</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data Contrato</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendasFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nenhuma venda em andamento encontrada.
                </TableCell>
              </TableRow>
            ) : (
              vendasFiltradas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs font-semibold">{v.contrato}</TableCell>
                  <TableCell className="font-medium">{v.vendedor}</TableCell>
                  <TableCell>{v.cliente}</TableCell>
                  <TableCell>{v.cidade}</TableCell>
                  <TableCell>{v.servico}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMoeda(v.valorServico)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.dataContrato}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {v.statusContrato}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
