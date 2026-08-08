"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  previsualizarLancamentosElleven,
  importarCancelamentosElleven,
  type LinhaPreviewElleven,
} from "@/lib/actions/elleven";
import { confirmarImportacao } from "@/lib/actions/importar";

type Cidade = { nome: string };
type Funcionario = { id: string; nome: string; cidade: Cidade | null };

export function ImportarEllevenView({
  funcionarios,
  periodoInicial,
}: {
  funcionarios: Funcionario[];
  periodoInicial: string;
}) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(periodoInicial);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviandoCancelamentos, setEnviandoCancelamentos] = useState(false);
  const [linhas, setLinhas] = useState<LinhaPreviewElleven[] | null>(null);
  const [totais, setTotais] = useState<{ totalContratosNoPeriodo: number; totalContratosGeral: number } | null>(null);

  async function handleUploadCancelamentos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoCancelamentos(true);
    try {
      const text = await file.text();
      const res = await importarCancelamentosElleven(periodo, text);
      if (res.ok) {
        toast.success(`${res.processados} cancelamento(s) processado(s) com sucesso!`);
        carregar();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao ler o arquivo CSV de cancelamentos.");
    } finally {
      setEnviandoCancelamentos(false);
      e.target.value = "";
    }
  }

  async function carregar() {
    setCarregando(true);
    setLinhas(null);
    try {
      const resultado = await previsualizarLancamentosElleven(periodo);
      setLinhas(resultado.linhas);
      setTotais({
        totalContratosNoPeriodo: resultado.totalContratosNoPeriodo,
        totalContratosGeral: resultado.totalContratosGeral,
      });
      if (resultado.linhas.length === 0) {
        toast.info("Nenhum contrato de ativação encontrado nesse período.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar contratos.");
    }
    setCarregando(false);
  }

  function atualizarFuncionario(vendedorOriginal: string, funcionarioId: string) {
    setLinhas((prev) =>
      prev
        ? prev.map((l) =>
            l.vendedorOriginal === vendedorOriginal ? { ...l, funcionarioId } : l
          )
        : prev
    );
  }

  const linhasSemMatch = (linhas ?? []).filter((l) => !l.funcionarioId);
  const linhasProntas = (linhas ?? []).filter((l) => l.funcionarioId);

  async function handleConfirmar() {
    if (!linhas || linhasSemMatch.length > 0) {
      toast.error("Ainda há vendedores sem funcionário associado.");
      return;
    }
    setEnviando(true);
    const result = await confirmarImportacao({
      periodo,
      arquivoNome: `elleven-sync-${periodo}`,
      linhas: linhasProntas.map((l) => ({
        funcionarioId: l.funcionarioId,
        quantidade: l.quantidade,
        aprovado: l.aprovado,
        cancelado: l.cancelado,
        valorInstalado: l.valorInstalado,
        valorDemaisServicos: l.valorDemaisServicos,
        qtdInternet: l.qtdInternet,
        qtdChip: l.qtdChip,
        qtdGps: l.qtdGps,
        qtdTv: l.qtdTv,
        qtdStreaming: l.qtdStreaming,
        qtdTelefoniaFixa: l.qtdTelefoniaFixa,
      })),
    });
    setEnviando(false);
    if (result.ok) {
      toast.success(`${linhasProntas.length} lançamento(s) gerado(s) a partir do elleven.`);
      router.push(`/lancamentos?periodo=${periodo}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período e Cancelamentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div className="flex items-end gap-3">
              <div className="space-y-2">
                <Label>Mês de referência</Label>
                <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
              </div>
              <Button onClick={carregar} disabled={carregando}>
                <RefreshCw className={carregando ? "size-4 animate-spin" : "size-4"} />
                {carregando ? "Carregando..." : "Carregar contratos do período"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Relatório "Cancelamentos por Mês - Claude" (CSV)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".csv,.txt"
                  disabled={enviandoCancelamentos}
                  onChange={handleUploadCancelamentos}
                  className="max-w-xs cursor-pointer text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {totais && (
        <Alert>
          <AlertDescription>
            {totais.totalContratosNoPeriodo} contrato(s) de ativação encontrados em {periodo}{" "}
            (de {totais.totalContratosGeral} sincronizados no total), agrupados em{" "}
            {linhas?.length ?? 0} vendedor(es).
          </AlertDescription>
        </Alert>
      )}

      {linhasSemMatch.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {linhasSemMatch.length} vendedor(es) do elleven não bateram com nenhum
            funcionário cadastrado (por nome). Selecione manualmente, ou use{" "}
            <Link
              href="/cadastros/funcionarios/elleven"
              className="font-medium underline underline-offset-2"
            >
              Atualizar vendedores pelo elleven
            </Link>{" "}
            para cadastrar/renomear em lote e recarregue.
          </AlertDescription>
        </Alert>
      )}

      {linhas && linhas.length > 0 && (
        <>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor no elleven</TableHead>
                  <TableHead>Funcionário no sistema</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                  <TableHead className="text-right">Internet</TableHead>
                  <TableHead className="text-right">Chip</TableHead>
                  <TableHead className="text-right">GPS</TableHead>
                  <TableHead className="text-right">TV</TableHead>
                  <TableHead className="text-right">Streaming</TableHead>
                  <TableHead className="text-right">Tel. Fixa</TableHead>
                  <TableHead className="text-right">Outros</TableHead>
                  <TableHead className="text-right">Valor Instalado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.vendedorOriginal}>
                    <TableCell className="font-medium">{l.vendedorOriginal}</TableCell>
                    <TableCell>
                      <Select
                        value={l.funcionarioId}
                        onValueChange={(v) => atualizarFuncionario(l.vendedorOriginal, v ?? "")}
                        items={Object.fromEntries(funcionarios.map((f) => [f.id, f.nome]))}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {funcionarios.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">{l.quantidade}</TableCell>
                    <TableCell className="text-right">{l.qtdInternet}</TableCell>
                    <TableCell className="text-right">{l.qtdChip}</TableCell>
                    <TableCell className="text-right">{l.qtdGps}</TableCell>
                    <TableCell className="text-right">{l.qtdTv}</TableCell>
                    <TableCell className="text-right">{l.qtdStreaming}</TableCell>
                    <TableCell className="text-right">{l.qtdTelefoniaFixa}</TableCell>
                    <TableCell className="text-right">{l.qtdOutros}</TableCell>
                    <TableCell className="text-right">
                      {l.valorInstalado.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </TableCell>
                    <TableCell>
                      {l.funcionarioId ? (
                        <Badge>OK</Badge>
                      ) : (
                        <Badge variant="destructive">Sem match</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleConfirmar} disabled={enviando || linhasSemMatch.length > 0}>
              {enviando ? (
                "Importando..."
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Confirmar importação de {linhasProntas.length} lançamento(s)
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
