"use client";

import { Fragment } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  MESES_CURTOS,
  MESES_NOMES,
  formatBRL,
  formatData,
  margem,
  porTrimestre,
  somaLinhas,
  temMovimento,
  type LinhaMes,
  type ResumoBloco,
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
  tributos,
  matrizImpostos,
  guias,
}: {
  empresas: EmpresaOpcao[];
  empresaId: string;
  empresaNome: string;
  anos: number[];
  ano: number;
  linhas: LinhaMes[];
  porTipo: TipoTotal[];
  tributos: string[];
  matrizImpostos: { mes: number; valores: number[] }[];
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

  /**
   * Exporta a planilha anual: uma aba de resultado (com os subtotais de
   * trimestre, como o analista já lia) e outra com a matriz de impostos.
   */
  async function exportarPlanilha() {
    const XLSX = await import("xlsx");

    const abaResultado: (string | number)[][] = [
      [`RESULTADO ${empresaNome.toUpperCase()} — ${ano}`],
      [],
      ["PERÍODO", "FATURAMENTO", "DESPESAS", "LUCRO", "IMPOSTOS", "SITUAÇÃO"],
    ];
    for (const { trimestre, linhas: doTrimestre, total: t } of trimestres) {
      for (const l of doTrimestre) {
        abaResultado.push([
          MESES_NOMES[l.mes - 1].toUpperCase(),
          l.faturamento,
          l.despesas,
          l.lucro,
          l.impostos,
          l.status === "FECHADA" ? "Fechado" : "Aberto",
        ]);
      }
      abaResultado.push([`TOTAL ${trimestre}º TRIMESTRE`, t.faturamento, t.despesas, t.lucro, t.impostos, ""]);
      abaResultado.push([]);
    }
    abaResultado.push([`TOTAL ${ano}`, total.faturamento, total.despesas, total.lucro, total.impostos, ""]);

    const abaImpostos: (string | number)[][] = [
      [`IMPOSTOS ${empresaNome.toUpperCase()} — ${ano}`],
      [],
      ["PERÍODO", ...tributos, "TOTAL"],
    ];
    for (const linha of matrizImpostos) {
      abaImpostos.push([
        MESES_NOMES[linha.mes - 1].toUpperCase(),
        ...linha.valores,
        linha.valores.reduce((s, v) => s + v, 0),
      ]);
    }
    abaImpostos.push([
      "TOTAL",
      ...tributos.map((_, i) => matrizImpostos.reduce((s, l) => s + (l.valores[i] ?? 0), 0)),
      matrizImpostos.reduce((s, l) => s + l.valores.reduce((sv, v) => sv + v, 0), 0),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaResultado), "Resultado");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaImpostos), "Impostos");
    XLSX.writeFile(wb, `contabilidade-${empresaNome.toLowerCase().replace(/\s+/g, "-")}-${ano}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContabilFiltros empresas={empresas} empresaId={empresaId} anos={anos} ano={ano} />
        <Button variant="outline" onClick={exportarPlanilha}>
          <Download className="size-4" />
          Baixar planilha do ano
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

      <Tabs defaultValue="ano">
        <TabsList>
          <TabsTrigger value="ano">Planilha do ano</TabsTrigger>
          <TabsTrigger value="trimestres">Por trimestre</TabsTrigger>
        </TabsList>

        <TabsContent value="ano" className="mt-4">
          <PlanilhaAnual
            ano={ano}
            empresaNome={empresaNome}
            trimestres={trimestres}
            total={total}
            margemAno={margemAno}
          />
        </TabsContent>

        <TabsContent value="trimestres" className="mt-4">
          {/* Os 4 blocos trimestrais — mesmo recorte da planilha original. */}
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
        </TabsContent>
      </Tabs>

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

/**
 * O ano inteiro numa tabela só, com o subtotal de cada trimestre no meio — é a
 * visão que substitui a planilha, sem precisar somar dois blocos na mão.
 */
function PlanilhaAnual({
  ano,
  empresaNome,
  trimestres,
  total,
  margemAno,
}: {
  ano: number;
  empresaNome: string;
  trimestres: { trimestre: number; linhas: LinhaMes[]; total: ResumoBloco }[];
  total: ResumoBloco;
  margemAno: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {empresaNome} — resultado de {ano}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Os 12 meses com o fechamento de cada trimestre e o total do ano. O lucro é sempre
          faturamento menos despesas; a coluna de impostos é informativa.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Período</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Impostos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trimestres.map(({ trimestre, linhas: doTrimestre, total: t }) => (
                <Fragment key={trimestre}>
                  {doTrimestre.map((l) => {
                    const m = margem(l.faturamento, l.lucro);
                    return (
                      <TableRow key={l.periodo} className={temMovimento(l) ? "" : "opacity-50"}>
                        <TableCell className="uppercase">{MESES_NOMES[l.mes - 1]}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.faturamento ? formatBRL(l.faturamento) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.despesas ? formatBRL(l.despesas) : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            temMovimento(l) && l.lucro < 0 && "text-rose-600",
                            temMovimento(l) && l.lucro > 0 && "text-emerald-600",
                          )}
                        >
                          {temMovimento(l) ? formatBRL(l.lucro) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {m === null ? "—" : `${m.toFixed(1)}%`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {l.impostos ? formatBRL(l.impostos) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-y bg-muted/40 font-medium">
                    <TableCell>{trimestre}º trimestre</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(t.faturamento)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(t.despesas)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        t.lucro < 0 ? "text-rose-600" : t.lucro > 0 ? "text-emerald-600" : "",
                      )}
                    >
                      {formatBRL(t.lucro)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {margem(t.faturamento, t.lucro)?.toFixed(1) ?? "—"}
                      {margem(t.faturamento, t.lucro) === null ? "" : "%"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {t.impostos ? formatBRL(t.impostos) : "—"}
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}

              <TableRow className="border-t-2 text-base font-semibold">
                <TableCell>TOTAL {ano}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(total.faturamento)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(total.despesas)}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    total.lucro < 0 ? "text-rose-600" : "text-emerald-600",
                  )}
                >
                  {formatBRL(total.lucro)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {margemAno === null ? "—" : `${margemAno.toFixed(1)}%`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBRL(total.impostos)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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
