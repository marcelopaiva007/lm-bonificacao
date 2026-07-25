"use client";

import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { Download, TrendingUp, TrendingDown, Receipt, Wallet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  MESES_CURTOS,
  MESES_NOMES,
  formatBRL,
  formatData,
  margem,
  montarCSV,
  porTrimestre,
  somaLinhas,
  temMovimento,
  type LinhaMes,
} from "@/lib/contabil";
import { ContabilFiltros, type EmpresaOpcao } from "./contabil-filtros";

const fmtCurto = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type TipoTotal = { nome: string; total: number; pago: number };
type Guia = {
  id: string;
  empresa: string;
  periodo: string;
  tipo: string;
  valor: number;
  vencimento: string | null;
};

export function PainelView({
  empresas,
  empresaId,
  empresaNome,
  anos,
  ano,
  linhas,
  porTipo,
  guias,
}: {
  empresas: EmpresaOpcao[];
  empresaId: string;
  empresaNome: string;
  anos: number[];
  ano: number;
  linhas: LinhaMes[];
  porTipo: TipoTotal[];
  guias: Guia[];
}) {
  const total = somaLinhas(linhas);
  const trimestres = porTrimestre(linhas);
  const margemAno = margem(total.faturamento, total.lucro);
  const comMovimento = linhas.filter(temMovimento);

  const dadosGrafico = linhas.map((l) => ({
    mes: MESES_CURTOS[l.mes - 1],
    faturamento: l.faturamento,
    despesas: l.despesas,
    lucro: l.lucro,
  }));

  function exportarCSV() {
    const csv = montarCSV(
      ["Mês", "Faturamento", "Despesas", "Lucro", "Impostos", "Lucro após impostos", "Status"],
      linhas.map((l) => [
        MESES_NOMES[l.mes - 1],
        l.faturamento,
        l.despesas,
        l.lucro,
        l.impostos,
        l.lucroAposImpostos,
        l.status,
      ]),
    );
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultado-${empresaNome.toLowerCase().replace(/\s+/g, "-")}-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContabilFiltros empresas={empresas} empresaId={empresaId} anos={anos} ano={ano} />
        <Button variant="outline" onClick={exportarCSV}>
          <Download className="size-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          titulo={`Faturamento ${ano}`}
          valor={formatBRL(total.faturamento)}
          icone={<TrendingUp className="size-4 text-emerald-600" />}
          detalhe={`${comMovimento.length} mês(es) com movimento`}
        />
        <KpiCard
          titulo={`Despesas ${ano}`}
          valor={formatBRL(total.despesas)}
          icone={<TrendingDown className="size-4 text-rose-600" />}
        />
        <KpiCard
          titulo={`Lucro ${ano}`}
          valor={formatBRL(total.lucro)}
          destaque={total.lucro < 0 ? "negativo" : "positivo"}
          icone={<Wallet className="size-4 text-muted-foreground" />}
          detalhe={margemAno === null ? "—" : `Margem de ${margemAno.toFixed(1)}%`}
        />
        <KpiCard
          titulo={`Impostos ${ano}`}
          valor={formatBRL(total.impostos)}
          icone={<Receipt className="size-4 text-muted-foreground" />}
          detalhe={`${formatBRL(total.impostosPendentes)} em aberto`}
        />
      </div>

      {/* Os 4 blocos trimestrais — mesmo recorte da planilha do analista. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {trimestres.map(({ trimestre, linhas: doTrimestre, total: totalTri }) => (
          <Card key={trimestre}>
            <CardHeader>
              <CardTitle className="text-base">{trimestre}º Trimestre</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doTrimestre.map((l) => (
                    <TableRow key={l.periodo}>
                      <TableCell className="uppercase">{MESES_NOMES[l.mes - 1]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.faturamento ? formatBRL(l.faturamento) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.despesas ? formatBRL(l.despesas) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-medium">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(totalTri.faturamento)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(totalTri.despesas)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">Lucro no trimestre</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    totalTri.lucro < 0 ? "text-rose-600" : "text-emerald-600",
                  )}
                >
                  {formatBRL(totalTri.lucro)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento x Despesas x Lucro — {ano}</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosGrafico} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtCurto(Number(v))} width={90} />
              <Tooltip formatter={(v) => formatBRL(Number(v))} />
              <Legend />
              <Bar dataKey="faturamento" name="Faturamento" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="var(--chart-1)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impostos por tributo — {ano}</CardTitle>
          </CardHeader>
          <CardContent>
            {porTipo.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum imposto lançado neste ano.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tributo</TableHead>
                    <TableHead className="text-right">Apurado</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Em aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porTipo.map((t) => (
                    <TableRow key={t.nome}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(t.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(t.pago)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(Math.max(t.total - t.pago, 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-medium">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(porTipo.reduce((s, t) => s + t.total, 0))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(porTipo.reduce((s, t) => s + t.pago, 0))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(
                        porTipo.reduce((s, t) => s + Math.max(t.total - t.pago, 0), 0),
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              Guias em aberto (todas as empresas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {guias.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma guia pendente. 🎉
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Tributo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guias.map((g) => {
                    const vencida =
                      g.vencimento !== null && new Date(g.vencimento) < new Date();
                    return (
                      <TableRow key={g.id}>
                        <TableCell>{g.empresa}</TableCell>
                        <TableCell className="tabular-nums">{g.periodo}</TableCell>
                        <TableCell>{g.tipo}</TableCell>
                        <TableCell>
                          {vencida ? (
                            <Badge variant="destructive">{formatData(g.vencimento)}</Badge>
                          ) : (
                            formatData(g.vencimento)
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(g.valor)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  detalhe,
  icone,
  destaque,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone?: React.ReactNode;
  destaque?: "positivo" | "negativo";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          {titulo}
          {icone}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            destaque === "negativo" && "text-rose-600",
            destaque === "positivo" && "text-emerald-600",
          )}
        >
          {valor}
        </p>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}
