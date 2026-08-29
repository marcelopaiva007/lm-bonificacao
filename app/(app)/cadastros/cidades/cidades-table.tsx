"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createCidade, updateCidade, deleteCidade } from "@/lib/actions/cadastros";
import type { ActionResult } from "@/lib/constants";

type Cidade = {
  id: string;
  nome: string;
  _count: { funcionarios: number };
};

const initialState: ActionResult = { ok: true };

export function CidadesTable({ cidades }: { cidades: Cidade[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editCidade, setEditCidade] = useState<Cidade | null>(null);

  const cols: Column<Cidade>[] = [
    { key: "nome", header: "Cidade", cell: (c) => <span className="font-medium">{c.nome}</span> },
    {
      key: "func",
      header: "Funcionários",
      align: "right",
      width: "140px",
      cell: (c) => c._count.funcionarios,
    },
    {
      key: "acoes",
      header: "Ações",
      align: "right",
      width: "96px",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditCidade(c)}>
            <Pencil className="size-4" />
          </Button>
          <DeleteCidadeButton cidade={c} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="surface overflow-hidden rounded-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
          <p className="text-xs text-muted-foreground">
            <span className="num">{cidades.length}</span> {cidades.length === 1 ? "cidade" : "cidades"}
          </p>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button size="sm" className="shrink-0" />}>
              <Plus className="size-4" />
              Nova cidade
            </DialogTrigger>
            <DialogContent>
              <CidadeForm
                action={createCidade}
                title="Nova Cidade"
                onSuccess={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <DataTable
          columns={cols}
          rows={cidades}
          rowKey={(c) => c.id}
          minWidth="420px"
          emptyTitle="Nenhuma cidade cadastrada ainda"
          emptyHint="Clique em “Nova cidade” para começar."
        />
      </section>

      <Dialog open={!!editCidade} onOpenChange={(open) => !open && setEditCidade(null)}>
        <DialogContent>
          {editCidade && (
            <CidadeForm
              action={updateCidade.bind(null, editCidade.id)}
              title="Editar Cidade"
              defaultNome={editCidade.nome}
              onSuccess={() => setEditCidade(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CidadeForm({
  action,
  title,
  defaultNome = "",
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  title: string;
  defaultNome?: string;
  onSuccess: () => void;
}) {
  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) {
      toast.success("Cidade salva com sucesso.");
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
        <Label htmlFor="nome">Nome da cidade</Label>
        <Input id="nome" name="nome" defaultValue={defaultNome} required autoFocus />
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

function DeleteCidadeButton({ cidade }: { cidade: Cidade }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    const result = await deleteCidade(cidade.id);
    if (result.ok) {
      toast.success("Cidade excluída.");
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
