"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Lock, Calendar, FileSpreadsheet, DollarSign, Layers } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createLancamento, updateLancamento, deleteLancamento } from "@/lib/actions/lancamentos";
import type { ActionResult } from "@/lib/constants";
import { periodoLabel } from "@/lib/periodo";

type Cidade = { id: string; nome: string };
type Funcionario = { id: string; nome: string; cidade: Cidade | null };
type Lancamento = {
  id: string;
  funcionarioId: string;
  periodo: string;
  quantidade: number;
  aprovado: number;
  cancelado: number;
  valorInstalado: number;
  valorDemaisServicos: number;
  qtdInternet: number;
  qtdChip: number;
  qtdGps: number;
  qtdTv: number;
  qtdStreaming: number;
  qtdTelefoniaFixa: number;
  origem: string;
  funcionario: Funcionario;
};

const initialState: ActionResult = { ok: true };
const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LancamentosView({
  periodo,
  funcionarios,
  lancamentos,
  fechado,
}: {
  periodo: string;
  funcionarios: Funcionario[];
  lancamentos: Lancamento[];
  fechado: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editLancamento, setEditLancamento] = useState<Lancamento | null>(null);

  const totalVendido = lancamentos.reduce((acc, l) => acc + l.valorInstalado, 0);
  const totalAprovadas = lancamentos.reduce((acc, l) => acc + l.aprovado, 0);

  return (
    <div className="space-y-6">
      {/* Top Filter & Summary Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5">
            <Calendar className="size-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-300">Mês:</span>
            <Input
              type="month"
              value={periodo}
              onChange={(e) => router.push(`/lancamentos?periodo=${e.target.value}`)}
              className="h-7 w-36 border-none bg-transparent p-0 text-xs font-bold text-cyan-400 focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-slate-700 bg-slate-950/80 text-slate-300 px-3 py-1 text-xs">
              <Layers className="size-3.5 mr-1.5 text-cyan-400" />
              {lancamentos.length} lançamento(s)
            </Badge>
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-mono px-3 py-1 text-xs font-bold">
              <DollarSign className="size-3.5 mr-1" />
              Total Vendido: {fmtMoeda(totalVendido)}
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono px-3 py-1 text-xs font-bold">
              Aprovadas: {totalAprovadas}
            </Badge>
          </div>
        </div>

        {!fechado && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button />}>
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20">
                <Plus className="size-4 mr-1.5" />
                Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg border-slate-800 bg-slate-950/95 backdrop-blur-xl">
              <LancamentoForm
                action={createLancamento}
                title="Novo Lançamento de Vendas"
                periodo={periodo}
                funcionarios={funcionarios}
                onSuccess={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {fechado && (
        <Alert className="border-amber-500/30 bg-amber-950/20 text-amber-300">
          <Lock className="size-4 text-amber-400" />
          <AlertDescription className="text-xs font-medium">
            O mês <strong>{periodoLabel(periodo)}</strong> já foi fechado. Os lançamentos estão em modo de leitura. Reabra o período na tela de Fechamento se desejar editar.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 shadow-xl backdrop-blur-md">
        <Table>
          <TableHeader className="bg-slate-900/90">
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="font-semibold text-slate-300">Funcionário</TableHead>
              <TableHead className="font-semibold text-slate-300">Cidade</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">Qtd.</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">Aprovado</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">Cancelado</TableHead>
              <TableHead className="text-right font-semibold text-slate-300">Valor Instalado</TableHead>
              <TableHead className="font-semibold text-slate-300">Origem</TableHead>
              {!fechado && <TableHead className="w-24 text-right font-semibold text-slate-300">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lancamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={fechado ? 7 : 8} className="py-12 text-center text-slate-400">
                  <FileSpreadsheet className="size-8 mx-auto mb-2 text-slate-600" />
                  Nenhum lançamento registrado neste período ainda.
                </TableCell>
              </TableRow>
            )}
            {lancamentos.map((l) => (
              <TableRow key={l.id} className="border-slate-800/60 hover:bg-slate-900/50 transition-colors">
                <TableCell className="font-semibold text-slate-100">{l.funcionario.nome}</TableCell>
                <TableCell className="text-slate-300">{l.funcionario.cidade?.nome ?? "—"}</TableCell>
                <TableCell className="text-right font-mono font-medium text-slate-300">{l.quantidade}</TableCell>
                <TableCell className="text-right font-mono font-bold text-emerald-400">{l.aprovado}</TableCell>
                <TableCell className="text-right font-mono font-medium text-rose-400">{l.cancelado}</TableCell>
                <TableCell className="text-right font-mono font-bold text-cyan-400">{fmtMoeda(l.valorInstalado)}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      l.origem === "MANUAL"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 text-[11px]"
                        : l.origem === "HISTORICO"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400 text-[11px]"
                        : "border-slate-700 bg-slate-900 text-slate-300 text-[11px]"
                    }
                  >
                    {l.origem === "MANUAL" ? "Manual" : l.origem === "HISTORICO" ? "Histórico" : "Importado"}
                  </Badge>
                </TableCell>
                {!fechado && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                        onClick={() => setEditLancamento(l)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <DeleteLancamentoButton lancamento={l} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editLancamento} onOpenChange={(open) => !open && setEditLancamento(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          {editLancamento && (
            <LancamentoForm
              action={updateLancamento.bind(null, editLancamento.id)}
              title="Editar Lançamento"
              periodo={periodo}
              funcionarios={funcionarios}
              defaultValues={editLancamento}
              onSuccess={() => setEditLancamento(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LancamentoForm({
  action,
  title,
  periodo,
  funcionarios,
  defaultValues,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  title: string;
  periodo: string;
  funcionarios: Funcionario[];
  defaultValues?: Lancamento;
  onSuccess: () => void;
}) {
  const [funcionarioId, setFuncionarioId] = useState(defaultValues?.funcionarioId ?? "");

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) {
      toast.success("Lançamento salvo. Bonificação recalculada.");
      onSuccess();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-slate-100">{title}</DialogTitle>
      </DialogHeader>
      <input type="hidden" name="periodo" value={periodo} />

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-slate-300">Funcionário</Label>
        <Select
          value={funcionarioId}
          onValueChange={(v) => setFuncionarioId(v ?? "")}
          name="funcionarioId"
          items={Object.fromEntries(funcionarios.map((f) => [f.id, f.nome]))}
        >
          <SelectTrigger className="w-full border-slate-800 bg-slate-900/80 text-xs">
            <SelectValue placeholder="Selecione o funcionário" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900">
            {funcionarios.map((f) => (
              <SelectItem key={f.id} value={f.id} className="text-xs">
                {f.nome} {f.cidade ? `— ${f.cidade.nome}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantidade" className="text-xs font-semibold text-slate-300">Quantidade</Label>
          <Input id="quantidade" name="quantidade" type="number" defaultValue={defaultValues?.quantidade ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aprovado" className="text-xs font-semibold text-slate-300">Aprovado</Label>
          <Input id="aprovado" name="aprovado" type="number" defaultValue={defaultValues?.aprovado ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cancelado" className="text-xs font-semibold text-slate-300">Cancelado</Label>
          <Input id="cancelado" name="cancelado" type="number" defaultValue={defaultValues?.cancelado ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="valorInstalado" className="text-xs font-semibold text-slate-300">Valor instalado (R$)</Label>
          <Input
            id="valorInstalado"
            name="valorInstalado"
            type="number"
            step="0.01"
            defaultValue={defaultValues?.valorInstalado ?? 0}
            className="border-slate-800 bg-slate-900/80 text-xs font-mono font-bold text-cyan-400"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valorDemaisServicos" className="text-xs font-semibold text-slate-300">Demais serviços (R$)</Label>
          <Input
            id="valorDemaisServicos"
            name="valorDemaisServicos"
            type="number"
            step="0.01"
            defaultValue={defaultValues?.valorDemaisServicos ?? 0}
            className="border-slate-800 bg-slate-900/80 text-xs font-mono"
          />
        </div>
      </div>

      <Separator className="bg-slate-800" />
      <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Quantidade vendida por produto</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <div className="space-y-1">
          <Label htmlFor="qtdInternet" className="text-[11px] text-slate-400">Internet</Label>
          <Input id="qtdInternet" name="qtdInternet" type="number" defaultValue={defaultValues?.qtdInternet ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qtdChip" className="text-[11px] text-slate-400">Chip</Label>
          <Input id="qtdChip" name="qtdChip" type="number" defaultValue={defaultValues?.qtdChip ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qtdGps" className="text-[11px] text-slate-400">GPS</Label>
          <Input id="qtdGps" name="qtdGps" type="number" defaultValue={defaultValues?.qtdGps ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qtdTv" className="text-[11px] text-slate-400">TV</Label>
          <Input id="qtdTv" name="qtdTv" type="number" defaultValue={defaultValues?.qtdTv ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qtdStreaming" className="text-[11px] text-slate-400">Streaming</Label>
          <Input id="qtdStreaming" name="qtdStreaming" type="number" defaultValue={defaultValues?.qtdStreaming ?? 0} className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qtdTelefoniaFixa" className="text-[11px] text-slate-400">Fixa</Label>
          <Input
            id="qtdTelefoniaFixa"
            name="qtdTelefoniaFixa"
            type="number"
            defaultValue={defaultValues?.qtdTelefoniaFixa ?? 0}
            className="border-slate-800 bg-slate-900/80 text-xs"
          />
        </div>
      </div>

      {!state.ok && (
        <Alert variant="destructive" className="border-rose-800 bg-rose-950/40 text-rose-200">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
        >
          {isPending ? "Salvando..." : "Salvar Lançamento"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteLancamentoButton({ lancamento }: { lancamento: Lancamento }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    const result = await deleteLancamento(lancamento.id);
    if (result.ok) {
      toast.success("Lançamento excluído. Bonificação recalculada.");
    } else {
      toast.error(result.error);
    }
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button variant="destructive" size="sm" onClick={handleDelete} className="h-7 px-2 text-xs">
          Confirmar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} className="h-7 px-2 text-xs">
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-slate-400 hover:text-rose-400 hover:bg-slate-800"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
