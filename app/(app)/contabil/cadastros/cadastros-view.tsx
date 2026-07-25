"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
import { REGIMES } from "@/lib/contabil";
import {
  createEmpresaContabil,
  updateEmpresaContabil,
  deleteEmpresaContabil,
  toggleEmpresaContabilAtiva,
  createTipoImposto,
  updateTipoImposto,
  deleteTipoImposto,
  toggleTipoImpostoAtivo,
} from "@/lib/actions/contabil";
import type { ActionResult } from "@/lib/constants";

type Empresa = {
  id: string;
  nome: string;
  cnpj: string | null;
  regime: string | null;
  ativo: boolean;
  competencias: number;
};

type Tipo = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  usos: number;
};

const initialState: ActionResult = { ok: true };

const REGIME_LABEL: Record<string, string> = Object.fromEntries(
  REGIMES.map((r) => [r.value, r.label]),
);

export function CadastrosView({ empresas, tipos }: { empresas: Empresa[]; tipos: Tipo[] }) {
  return (
    <Tabs defaultValue="empresas">
      <TabsList>
        <TabsTrigger value="empresas">Empresas</TabsTrigger>
        <TabsTrigger value="tributos">Tributos</TabsTrigger>
      </TabsList>

      <TabsContent value="empresas" className="mt-4">
        <EmpresasCard empresas={empresas} />
      </TabsContent>

      <TabsContent value="tributos" className="mt-4">
        <TributosCard tipos={tipos} />
      </TabsContent>
    </Tabs>
  );
}

function EmpresasCard({ empresas }: { empresas: Empresa[] }) {
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Empresa | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Empresas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada empresa tem seu próprio resultado, seus impostos e seu fechamento.
          </p>
        </div>
        <Dialog open={criando} onOpenChange={setCriando}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" />
            Nova empresa
          </DialogTrigger>
          <DialogContent>
            <EmpresaForm
              action={createEmpresaContabil}
              title="Nova empresa"
              onSuccess={() => setCriando(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>Meses lançados</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhuma empresa cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
            {empresas.map((e) => (
              <TableRow key={e.id} className={e.ativo ? "" : "opacity-60"}>
                <TableCell className="font-medium">{e.nome}</TableCell>
                <TableCell className="tabular-nums">{e.cnpj ?? "—"}</TableCell>
                <TableCell>{e.regime ? (REGIME_LABEL[e.regime] ?? e.regime) : "—"}</TableCell>
                <TableCell className="tabular-nums">{e.competencias}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await toggleEmpresaContabilAtiva(e.id, !e.ativo);
                      if (r.ok) toast.success(e.ativo ? "Empresa desativada." : "Empresa ativada.");
                      else toast.error(r.error);
                    }}
                  >
                    <Badge variant={e.ativo ? "default" : "secondary"}>
                      {e.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditando(e)}>
                      <Pencil className="size-4" />
                    </Button>
                    <BotaoExcluir
                      onConfirm={async () => {
                        const r = await deleteEmpresaContabil(e.id);
                        if (r.ok) toast.success("Empresa excluída.");
                        else toast.error(r.error);
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editando} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          {editando && (
            <EmpresaForm
              action={updateEmpresaContabil.bind(null, editando.id)}
              title="Editar empresa"
              empresa={editando}
              onSuccess={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EmpresaForm({
  action,
  title,
  empresa,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  title: string;
  empresa?: Empresa;
  onSuccess: () => void;
}) {
  const [regime, setRegime] = useState(empresa?.regime ?? "");
  const [ativo, setAtivo] = useState(empresa?.ativo ?? true);

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    fd.set("ativo", ativo ? "true" : "false");
    const result = await action(prev, fd);
    if (result.ok) {
      toast.success("Empresa salva.");
      onSuccess();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" defaultValue={empresa?.nome ?? ""} required autoFocus />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cnpj">CNPJ</Label>
        <Input
          id="cnpj"
          name="cnpj"
          defaultValue={empresa?.cnpj ?? ""}
          placeholder="00.000.000/0000-00"
        />
      </div>

      <div className="space-y-2">
        <Label>Regime tributário</Label>
        <Select
          value={regime}
          onValueChange={(v) => setRegime(v ? String(v) : "")}
          name="regime"
          items={Object.fromEntries(REGIMES.map((r) => [r.value, r.label]))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o regime" />
          </SelectTrigger>
          <SelectContent>
            {REGIMES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {empresa && (
        <div className="flex items-center gap-2">
          <Checkbox id="ativo" checked={ativo} onCheckedChange={(v) => setAtivo(v === true)} />
          <Label htmlFor="ativo" className="font-normal">
            Empresa ativa
          </Label>
        </div>
      )}

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

function TributosCard({ tipos }: { tipos: Tipo[] }) {
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Tipo | null>(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Tributos acompanhados</CardTitle>
          <p className="text-sm text-muted-foreground">
            São as colunas da planilha de impostos. A ordem define a ordem das colunas.
          </p>
        </div>
        <Dialog open={criando} onOpenChange={setCriando}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" />
            Novo tributo
          </DialogTrigger>
          <DialogContent>
            <TipoForm
              action={createTipoImposto}
              title="Novo tributo"
              onSuccess={() => setCriando(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Ordem</TableHead>
              <TableHead>Tributo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Lançamentos</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum tributo cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {tipos.map((t) => (
              <TableRow key={t.id} className={t.ativo ? "" : "opacity-60"}>
                <TableCell className="tabular-nums">{t.ordem}</TableCell>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell className="text-muted-foreground">{t.descricao ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{t.usos}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await toggleTipoImpostoAtivo(t.id, !t.ativo);
                      if (r.ok) toast.success(t.ativo ? "Tributo desativado." : "Tributo ativado.");
                      else toast.error(r.error);
                    }}
                  >
                    <Badge variant={t.ativo ? "default" : "secondary"}>
                      {t.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditando(t)}>
                      <Pencil className="size-4" />
                    </Button>
                    <BotaoExcluir
                      onConfirm={async () => {
                        const r = await deleteTipoImposto(t.id);
                        if (r.ok) toast.success("Tributo excluído.");
                        else toast.error(r.error);
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!editando} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          {editando && (
            <TipoForm
              action={updateTipoImposto.bind(null, editando.id)}
              title="Editar tributo"
              tipo={editando}
              onSuccess={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TipoForm({
  action,
  title,
  tipo,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  title: string;
  tipo?: Tipo;
  onSuccess: () => void;
}) {
  const [ativo, setAtivo] = useState(tipo?.ativo ?? true);

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    fd.set("ativo", ativo ? "true" : "false");
    const result = await action(prev, fd);
    if (result.ok) {
      toast.success("Tributo salvo.");
      onSuccess();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          name="nome"
          defaultValue={tipo?.nome ?? ""}
          placeholder="Ex.: ISS, PIS, COFINS"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Input id="descricao" name="descricao" defaultValue={tipo?.descricao ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ordem">Ordem na planilha</Label>
        <Input
          id="ordem"
          name="ordem"
          type="number"
          min={0}
          defaultValue={tipo?.ordem ?? 0}
          className="w-28"
        />
      </div>

      {tipo && (
        <div className="flex items-center gap-2">
          <Checkbox id="ativoTipo" checked={ativo} onCheckedChange={(v) => setAtivo(v === true)} />
          <Label htmlFor="ativoTipo" className="font-normal">
            Tributo ativo
          </Label>
        </div>
      )}

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

function BotaoExcluir({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando) {
    return (
      <div className="flex gap-1">
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            await onConfirm();
            setConfirmando(false);
          }}
        >
          Confirmar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={() => setConfirmando(true)}>
      <Trash2 className="size-4" />
    </Button>
  );
}
