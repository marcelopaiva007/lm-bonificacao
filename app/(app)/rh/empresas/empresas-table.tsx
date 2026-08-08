"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createEmpresa, updateEmpresa, deleteEmpresa, toggleEmpresaAtiva } from "@/lib/actions/rh-empresas";
import type { ActionResult } from "@/lib/constants";

type Empresa = {
  id: string;
  nome: string;
  cnpj?: string | null;
  razaoSocial?: string | null;
  marca?: string | null;
  ativo: boolean;
  _count: { setores: number; colaboradores: number; pesquisas: number };
};

const initialState: ActionResult = { ok: true };

export function EmpresasTable({ empresas }: { empresas: Empresa[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState<Empresa | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" />
            Nova Empresa / Marca / CNPJ
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <EmpresaForm action={createEmpresa} title="Nova Empresa" onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca / Nome</TableHead>
              <TableHead>CNPJ / Razão Social</TableHead>
              <TableHead>Setores</TableHead>
              <TableHead>Colaboradores</TableHead>
              <TableHead>Pesquisas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhuma empresa cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
            {empresas.map((e) => (
              <TableRow key={e.id} className={e.ativo ? "" : "opacity-60"}>
                <TableCell className="font-medium">
                  <div>{e.nome}</div>
                  {e.marca && <div className="text-xs text-cyan-500 font-normal">Marca: {e.marca}</div>}
                </TableCell>
                <TableCell>
                  {e.cnpj ? (
                    <div>
                      <span className="font-mono text-xs">{e.cnpj}</span>
                      {e.razaoSocial && <div className="text-xs text-muted-foreground">{e.razaoSocial}</div>}
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{e._count.setores}</TableCell>
                <TableCell>{e._count.colaboradores}</TableCell>
                <TableCell>{e._count.pesquisas}</TableCell>
                <TableCell>
                  <button
                    onClick={async () => {
                      const result = await toggleEmpresaAtiva(e.id, !e.ativo);
                      if (result.ok) toast.success(e.ativo ? "Empresa desativada." : "Empresa ativada.");
                    }}
                  >
                    <Badge variant={e.ativo ? "default" : "secondary"}>{e.ativo ? "Ativa" : "Inativa"}</Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/rh/${e.id}/colaboradores`} />}>
                      <Users className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditEmpresa(e)}>
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteEmpresaButton empresa={e} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editEmpresa} onOpenChange={(open) => !open && setEditEmpresa(null)}>
        <DialogContent className="max-w-md">
          {editEmpresa && (
            <EmpresaForm
              action={updateEmpresa.bind(null, editEmpresa.id)}
              title="Editar Empresa"
              defaultValues={editEmpresa}
              onSuccess={() => setEditEmpresa(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmpresaForm({
  action,
  title,
  defaultValues,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  title: string;
  defaultValues?: Partial<Empresa>;
  onSuccess: () => void;
}) {
  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) {
      toast.success("Empresa salva com sucesso.");
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
        <Label htmlFor="nome">Nome de Identificação (Ex: LM Telecom)</Label>
        <Input id="nome" name="nome" defaultValue={defaultValues?.nome ?? ""} required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="marca">Marca / Nome Fantasia (Ex: LM Telecom, Centrysol, VAPT)</Label>
        <Input id="marca" name="marca" defaultValue={defaultValues?.marca ?? ""} placeholder="Ex: LM Telecom" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input id="cnpj" name="cnpj" defaultValue={defaultValues?.cnpj ?? ""} placeholder="00.000.000/0001-00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="razaoSocial">Razão Social</Label>
          <Input id="razaoSocial" name="razaoSocial" defaultValue={defaultValues?.razaoSocial ?? ""} placeholder="Razão Social completa" />
        </div>
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

function DeleteEmpresaButton({ empresa }: { empresa: Empresa }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    const result = await deleteEmpresa(empresa.id);
    if (result.ok) {
      toast.success("Empresa excluída.");
    } else {
      toast.error(result.error);
    }
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex gap-1">
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Confirmar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={() => setConfirming(true)}>
      <Trash2 className="size-4" />
    </Button>
  );
}
