"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Lock, CheckCircle2, Circle, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  MESES_NOMES,
  formatBRL,
  formatData,
  inputDeData,
  montarCSV,
  parseValorBR,
} from "@/lib/contabil";
import { salvarImpostosAno, salvarPagamentoImposto, baixarImpostoRapido } from "@/lib/actions/contabil";
import type { ActionResult } from "@/lib/constants";
import { ContabilFiltros, type EmpresaOpcao } from "../contabil-filtros";

type Celula = {
  id: string;
  tipoId: string;
  valor: number;
  status: "PENDENTE" | "PAGO";
  vencimento: string | null;
  dataPagamento: string | null;
  valorPago: number | null;
  documento: string | null;
  observacoes: string | null;
};

type MesImposto = {
  periodo: string;
  mes: number;
  status: "ABERTA" | "FECHADA";
  impostos: Celula[];
};

type Tipo = { id: string; nome: string };

const initialState: ActionResult = { ok: true };

function paraCampo(valor: number): string {
  if (!valor) return "";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ImpostosView({
  empresas,
  empresaId,
  empresaNome,
  anos,
  ano,
  tipos,
  meses,
  podeEditar,
}: {
  empresas: EmpresaOpcao[];
  empresaId: string;
  empresaNome: string;
  anos: number[];
  ano: number;
  tipos: Tipo[];
  meses: MesImposto[];
  podeEditar: boolean;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const m of meses) {
      for (const t of tipos) {
        const celula = m.impostos.find((i) => i.tipoId === t.id);
        inicial[`${m.periodo}_${t.id}`] = paraCampo(celula?.valor ?? 0);
      }
    }
    return inicial;
  });
  const [editando, setEditando] = useState<{ celula: Celula; periodo: string; tipo: string } | null>(
    null,
  );

  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const result = await salvarImpostosAno(prev, fd);
      if (result.ok) toast.success("Impostos salvos.");
      return result;
    },
    initialState,
  );

  const totaisPorTipo = useMemo(() => {
    const totais: Record<string, number> = {};
    for (const t of tipos) {
      totais[t.id] = meses.reduce(
        (soma, m) => soma + parseValorBR(valores[`${m.periodo}_${t.id}`] ?? ""),
        0,
      );
    }
    return totais;
  }, [tipos, meses, valores]);

  const totalGeral = Object.values(totaisPorTipo).reduce((s, v) => s + v, 0);

  const guias = meses
    .flatMap((m) =>
      m.impostos
        .filter((i) => i.valor > 0)
        .map((i) => ({
          ...i,
          periodo: m.periodo,
          mes: m.mes,
          mesFechado: m.status === "FECHADA",
          tipoNome: tipos.find((t) => t.id === i.tipoId)?.nome ?? "—",
        })),
    )
    .sort((a, b) => a.mes - b.mes || a.tipoNome.localeCompare(b.tipoNome));

  function exportarCSV() {
    const csv = montarCSV(
      ["Mês", ...tipos.map((t) => t.nome), "Total"],
      meses.map((m) => {
        const linha = tipos.map((t) => parseValorBR(valores[`${m.periodo}_${t.id}`] ?? ""));
        return [
          MESES_NOMES[m.mes - 1],
          ...linha,
          linha.reduce((s, v) => s + v, 0),
        ];
      }),
    );
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impostos-${empresaNome.toLowerCase().replace(/\s+/g, "-")}-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function baixaRapida(id: string) {
    const result = await baixarImpostoRapido(id);
    if (result.ok) toast.success("Situação da guia atualizada.");
    else toast.error(result.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContabilFiltros empresas={empresas} empresaId={empresaId} anos={anos} ano={ano} />
        <Button variant="outline" onClick={exportarCSV}>
          <Download className="size-4" />
          Exportar CSV
        </Button>
      </div>

      {tipos.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nenhum tributo ativo cadastrado. Cadastre ISS, PIS, COFINS e os demais em
            &ldquo;Cadastros&rdquo; para começar a apurar.
          </AlertDescription>
        </Alert>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="empresaId" value={empresaId} />
          <input type="hidden" name="ano" value={ano} />

          {!state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Impostos {empresaNome} — {ano}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Um valor por mês e tributo, como na planilha. O controle de pagamento de cada
                  guia fica na tabela abaixo.
                </p>
              </div>
              {podeEditar && (
                <Button type="submit" disabled={isPending}>
                  <Save className="size-4" />
                  {isPending ? "Salvando..." : "Salvar ano"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Período</TableHead>
                      {tipos.map((t) => (
                        <TableHead key={t.id} className="min-w-36">
                          {t.nome}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meses.map((m) => {
                      const travado = m.status === "FECHADA" || !podeEditar;
                      const totalMes = tipos.reduce(
                        (s, t) => s + parseValorBR(valores[`${m.periodo}_${t.id}`] ?? ""),
                        0,
                      );
                      return (
                        <TableRow key={m.periodo} className={cn(m.mes % 3 === 0 && "border-b-2")}>
                          <TableCell className="font-medium uppercase">
                            <span className="flex items-center gap-1.5">
                              {MESES_NOMES[m.mes - 1]}
                              {m.status === "FECHADA" && (
                                <Lock className="size-3 text-muted-foreground" />
                              )}
                            </span>
                          </TableCell>
                          {tipos.map((t) => (
                            <TableCell key={t.id}>
                              <Input
                                name={`imp_${m.periodo}_${t.id}`}
                                value={valores[`${m.periodo}_${t.id}`] ?? ""}
                                onChange={(e) =>
                                  setValores((v) => ({
                                    ...v,
                                    [`${m.periodo}_${t.id}`]: e.target.value,
                                  }))
                                }
                                disabled={travado}
                                inputMode="decimal"
                                placeholder="—"
                                className="text-right tabular-nums"
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-medium tabular-nums">
                            {totalMes ? formatBRL(totalMes) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell>TOTAL</TableCell>
                      {tipos.map((t) => (
                        <TableCell key={t.id} className="text-right tabular-nums">
                          {formatBRL(totaisPorTipo[t.id] ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(totalGeral)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guias e pagamentos — {ano}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada valor apurado vira uma guia a acompanhar: vencimento, baixa e número do
            documento.
          </p>
        </CardHeader>
        <CardContent>
          {guias.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum imposto lançado neste ano. Preencha a tabela acima e salve.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Tributo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guias.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="uppercase">{MESES_NOMES[g.mes - 1]}</TableCell>
                      <TableCell className="font-medium">{g.tipoNome}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(g.valor)}</TableCell>
                      <TableCell>{formatData(g.vencimento)}</TableCell>
                      <TableCell>
                        {g.status === "PAGO" ? (
                          <Badge className="gap-1 bg-emerald-600 text-white">
                            <CheckCircle2 className="size-3" />
                            Pago
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Circle className="size-3" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {g.status === "PAGO"
                          ? `${formatData(g.dataPagamento)}${
                              g.valorPago !== null && g.valorPago !== g.valor
                                ? ` · ${formatBRL(g.valorPago)}`
                                : ""
                            }`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {g.documento ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {podeEditar && !g.mesFechado ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title={g.status === "PAGO" ? "Desfazer baixa" : "Dar baixa hoje"}
                              onClick={() => baixaRapida(g.id)}
                            >
                              {g.status === "PAGO" ? (
                                <Circle className="size-4" />
                              ) : (
                                <CheckCircle2 className="size-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar guia"
                              onClick={() =>
                                setEditando({
                                  celula: g,
                                  periodo: MESES_NOMES[g.mes - 1],
                                  tipo: g.tipoNome,
                                })
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <Lock className="ml-auto size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          {editando && (
            <PagamentoForm
              celula={editando.celula}
              titulo={`${editando.tipo} — ${editando.periodo}`}
              onSuccess={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PagamentoForm({
  celula,
  titulo,
  onSuccess,
}: {
  celula: Celula;
  titulo: string;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<"PENDENTE" | "PAGO">(celula.status);

  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult, fd: FormData) => {
      const result = await salvarPagamentoImposto(celula.id, prev, fd);
      if (result.ok) {
        toast.success("Guia atualizada.");
        onSuccess();
      }
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{titulo}</DialogTitle>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        Valor apurado: <span className="font-medium">{formatBRL(celula.valor)}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Situação</Label>
          <Select
            value={status}
            onValueChange={(v) => v && setStatus(v as "PENDENTE" | "PAGO")}
            name="status"
            items={{ PENDENTE: "Pendente", PAGO: "Pago" }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vencimento">Vencimento</Label>
          <Input
            id="vencimento"
            name="vencimento"
            type="date"
            defaultValue={inputDeData(celula.vencimento)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dataPagamento">Data do pagamento</Label>
          <Input
            id="dataPagamento"
            name="dataPagamento"
            type="date"
            defaultValue={inputDeData(celula.dataPagamento)}
            disabled={status !== "PAGO"}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="valorPago">Valor pago (se diferente)</Label>
          <Input
            id="valorPago"
            name="valorPago"
            inputMode="decimal"
            placeholder={formatBRL(celula.valor)}
            defaultValue={
              celula.valorPago !== null
                ? celula.valorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                : ""
            }
            disabled={status !== "PAGO"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documento">Documento (DARF/DAS/guia)</Label>
        <Input id="documento" name="documento" defaultValue={celula.documento ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" defaultValue={celula.observacoes ?? ""} rows={2} />
      </div>

      {!state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
