"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Lock, LockOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MESES_NOMES, formatBRL, formatData } from "@/lib/contabil";
import { fecharCompetencia, reabrirCompetencia } from "@/lib/actions/contabil";
import { ContabilFiltros, type EmpresaOpcao } from "../contabil-filtros";

type MesFechamento = {
  periodo: string;
  mes: number;
  temLancamento: boolean;
  faturamento: number;
  despesas: number;
  lucro: number;
  impostos: number;
  impostosPendentes: number;
  status: "ABERTA" | "FECHADA";
  fechadaEm: string | null;
  fechadaPor: string | null;
};

export function FechamentoView({
  empresas,
  empresaId,
  anos,
  ano,
  meses,
  podeEditar,
  podeReabrir,
}: {
  empresas: EmpresaOpcao[];
  empresaId: string;
  anos: number[];
  ano: number;
  meses: MesFechamento[];
  podeEditar: boolean;
  podeReabrir: boolean;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const fechados = meses.filter((m) => m.status === "FECHADA").length;
  const comLancamento = meses.filter((m) => m.temLancamento);

  function fechar(periodo: string) {
    iniciarTransicao(async () => {
      const result = await fecharCompetencia(empresaId, periodo);
      if (result.ok) toast.success("Mês fechado.");
      else toast.error(result.error);
      setConfirmando(null);
    });
  }

  function reabrir(periodo: string) {
    iniciarTransicao(async () => {
      const result = await reabrirCompetencia(empresaId, periodo);
      if (result.ok) toast.success("Mês reaberto.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <ContabilFiltros empresas={empresas} empresaId={empresaId} anos={anos} ano={ano} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fechamento mensal — {ano}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fechar o mês trava faturamento, despesas e impostos daquela competência. É o que
            garante que um número já entregue à diretoria não mude depois. {fechados} de{" "}
            {comLancamento.length} mês(es) com lançamento estão fechados.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.map((m) => (
                  <TableRow key={m.periodo} className={cn(m.mes % 3 === 0 && "border-b-2")}>
                    <TableCell className="font-medium uppercase">
                      {MESES_NOMES[m.mes - 1]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.temLancamento ? formatBRL(m.faturamento) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.temLancamento ? formatBRL(m.despesas) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        m.temLancamento && m.lucro < 0 && "text-rose-600",
                        m.temLancamento && m.lucro > 0 && "text-emerald-600",
                      )}
                    >
                      {m.temLancamento ? formatBRL(m.lucro) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="flex items-center justify-end gap-1.5">
                        {m.impostos ? formatBRL(m.impostos) : "—"}
                        {m.impostosPendentes > 0 && (
                          <AlertTriangle
                            className="size-3.5 text-amber-600"
                            aria-label="Há guia em aberto neste mês"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {m.status === "FECHADA" ? (
                        <div className="space-y-0.5">
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="size-3" />
                            Fechado
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {formatData(m.fechadaEm)}
                            {m.fechadaPor ? ` · ${m.fechadaPor}` : ""}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Aberto</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.status === "FECHADA" ? (
                        podeReabrir && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendente}
                            onClick={() => reabrir(m.periodo)}
                          >
                            <LockOpen className="size-4" />
                            Reabrir
                          </Button>
                        )
                      ) : podeEditar && m.temLancamento ? (
                        confirmando === m.periodo ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" disabled={pendente} onClick={() => fechar(m.periodo)}>
                              Confirmar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmando(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmando(m.periodo)}
                          >
                            <Lock className="size-4" />
                            Fechar
                          </Button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {m.temLancamento ? "" : "sem lançamento"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
