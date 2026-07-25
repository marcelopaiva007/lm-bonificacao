"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MESES_NOMES, formatBRL, parseValorBR, margem } from "@/lib/contabil";
import { salvarResultadoAno } from "@/lib/actions/contabil";
import type { ActionResult } from "@/lib/constants";
import { ContabilFiltros, type EmpresaOpcao } from "../contabil-filtros";

type MesLinha = {
  periodo: string;
  mes: number;
  competenciaId: string | null;
  faturamento: number;
  despesas: number;
  status: "ABERTA" | "FECHADA";
  observacoes: string | null;
  impostos: number;
};

const initialState: ActionResult = { ok: true };

/** Número → "1.234,56" (vazio quando zero, para a grade não ficar poluída). */
function paraCampo(valor: number): string {
  if (!valor) return "";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ResultadoView({
  empresas,
  empresaId,
  anos,
  ano,
  meses,
  podeEditar,
}: {
  empresas: EmpresaOpcao[];
  empresaId: string;
  anos: number[];
  ano: number;
  meses: MesLinha[];
  podeEditar: boolean;
}) {
  // A grade inteira é um estado só: o analista digita os 12 meses e salva uma
  // vez, como faria na planilha.
  const [valores, setValores] = useState<Record<string, { fat: string; desp: string }>>(() =>
    Object.fromEntries(
      meses.map((m) => [m.periodo, { fat: paraCampo(m.faturamento), desp: paraCampo(m.despesas) }]),
    ),
  );

  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const result = await salvarResultadoAno(prev, fd);
      if (result.ok) toast.success("Resultado salvo.");
      return result;
    },
    initialState,
  );

  const calculado = useMemo(
    () =>
      meses.map((m) => {
        const fat = parseValorBR(valores[m.periodo]?.fat ?? "");
        const desp = parseValorBR(valores[m.periodo]?.desp ?? "");
        return { ...m, fat, desp, lucro: fat - desp };
      }),
    [meses, valores],
  );

  const totalFat = calculado.reduce((s, l) => s + l.fat, 0);
  const totalDesp = calculado.reduce((s, l) => s + l.desp, 0);
  const totalLucro = totalFat - totalDesp;
  const margemAno = margem(totalFat, totalLucro);

  function alterar(periodo: string, campo: "fat" | "desp", valor: string) {
    setValores((atual) => ({ ...atual, [periodo]: { ...atual[periodo], [campo]: valor } }));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="ano" value={ano} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContabilFiltros empresas={empresas} empresaId={empresaId} anos={anos} ano={ano} />
        {podeEditar && (
          <Button type="submit" disabled={isPending}>
            <Save className="size-4" />
            {isPending ? "Salvando..." : "Salvar ano"}
          </Button>
        )}
      </div>

      {!state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Faturamento x Despesas — {ano}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Digite os valores como na planilha (1.234,56). O lucro é calculado sozinho —
            faturamento menos despesas. Meses fechados ficam travados.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Período</TableHead>
                  <TableHead className="w-52">Faturamento</TableHead>
                  <TableHead className="w-52">Despesas</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead className="w-28">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculado.map((l) => {
                  const travado = l.status === "FECHADA" || !podeEditar;
                  const fimDeTrimestre = l.mes % 3 === 0;
                  return (
                    <TableRow key={l.periodo} className={cn(fimDeTrimestre && "border-b-2")}>
                      <TableCell className="font-medium uppercase">
                        {MESES_NOMES[l.mes - 1]}
                      </TableCell>
                      <TableCell>
                        <Input
                          name={`fat_${l.periodo}`}
                          value={valores[l.periodo]?.fat ?? ""}
                          onChange={(e) => alterar(l.periodo, "fat", e.target.value)}
                          disabled={travado}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          name={`desp_${l.periodo}`}
                          value={valores[l.periodo]?.desp ?? ""}
                          onChange={(e) => alterar(l.periodo, "desp", e.target.value)}
                          disabled={travado}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          l.lucro < 0 ? "text-rose-600" : l.lucro > 0 ? "text-emerald-600" : "",
                        )}
                      >
                        {l.fat || l.desp ? formatBRL(l.lucro) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {l.impostos ? formatBRL(l.impostos) : "—"}
                      </TableCell>
                      <TableCell>
                        {l.status === "FECHADA" ? (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="size-3" />
                            Fechado
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aberto</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>TOTAL {ano}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(totalFat)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(totalDesp)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      totalLucro < 0 ? "text-rose-600" : "text-emerald-600",
                    )}
                  >
                    {formatBRL(totalLucro)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(calculado.reduce((s, l) => s + l.impostos, 0))}
                  </TableCell>
                  <TableCell className="text-xs font-normal text-muted-foreground">
                    {margemAno === null ? "" : `Margem ${margemAno.toFixed(1)}%`}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
