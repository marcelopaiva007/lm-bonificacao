"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DataTable, StatusBadge, type Column } from "@/components/ui/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  toggleFuncionarioAtivo,
} from "@/lib/actions/cadastros";
import { CARGOS, type ActionResult } from "@/lib/constants";

type Cidade = { id: string; nome: string };
type Equipe = { id: string; nome: string };
type Funcionario = {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string;
  ativo: boolean;
  cidadeId: string | null;
  cidade: Cidade | null;
  equipeId: string | null;
  equipe: Equipe | null;
  email: string | null;
  telegramChatId: string | null;
};

const initialState: ActionResult = { ok: true };

const cargoLabel = (cargo: string) => CARGOS.find((c) => c.value === cargo)?.label ?? cargo;

export function FuncionariosTable({
  funcionarios,
  cidades,
  equipes,
}: {
  funcionarios: Funcionario[];
  cidades: Cidade[];
  equipes: Equipe[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editFuncionario, setEditFuncionario] = useState<Funcionario | null>(null);
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return funcionarios;
    return funcionarios.filter(
      (f) =>
        f.nome.toLowerCase().includes(termo) ||
        f.cpf?.includes(termo.replace(/\D/g, "")) ||
        f.cidade?.nome.toLowerCase().includes(termo) ||
        cargoLabel(f.cargo).toLowerCase().includes(termo)
    );
  }, [funcionarios, busca]);

  const cols: Column<Funcionario>[] = [
    {
      key: "nome",
      header: "Nome",
      cell: (f) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-accent">
            {f.nome
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span className={`truncate font-medium ${f.ativo ? "" : "text-muted-foreground"}`}>
            {f.nome}
          </span>
        </div>
      ),
    },
    { key: "cpf", header: "CPF", cell: (f) => <span className="num text-muted-foreground">{f.cpf ?? "—"}</span> },
    { key: "cargo", header: "Cargo", cell: (f) => cargoLabel(f.cargo) },
    { key: "cidade", header: "Cidade", cell: (f) => f.cidade?.nome ?? "—" },
    { key: "equipe", header: "Equipe", cell: (f) => f.equipe?.nome ?? "—" },
    {
      key: "status",
      header: "Situação",
      cell: (f) => (
        <button
          type="button"
          className="cursor-pointer"
          onClick={async () => {
            const result = await toggleFuncionarioAtivo(f.id, !f.ativo);
            if (result.ok)
              toast.success(f.ativo ? "Funcionário desativado." : "Funcionário ativado.");
          }}
        >
          <StatusBadge status={f.ativo ? "Ativo" : "Inativo"} />
        </button>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      align: "right",
      width: "96px",
      cell: (f) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditFuncionario(f)}>
            <Pencil className="size-4" />
          </Button>
          <DeleteFuncionarioButton funcionario={f} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="surface overflow-hidden rounded-xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 p-4">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou cargo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 bg-background/60 pl-9"
            />
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="shrink-0" />}>
              <Plus className="size-4" />
              Novo funcionário
            </DialogTrigger>
            <DialogContent>
              <FuncionarioForm
                action={createFuncionario}
                title="Novo Funcionário"
                cidades={cidades}
                equipes={equipes}
                onSuccess={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <DataTable
          columns={cols}
          rows={filtrados}
          rowKey={(f) => f.id}
          minWidth="820px"
          maxHeight="620px"
          emptyTitle="Nenhum funcionário encontrado"
          emptyHint="Revise o termo buscado ou cadastre um novo funcionário."
        />

        <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <span className="num">
            {filtrados.length} de {funcionarios.length} registros
          </span>
        </div>
      </section>

      <Dialog open={!!editFuncionario} onOpenChange={(open) => !open && setEditFuncionario(null)}>
        <DialogContent>
          {editFuncionario && (
            <FuncionarioForm
              action={updateFuncionario.bind(null, editFuncionario.id)}
              title="Editar Funcionário"
              cidades={cidades}
              equipes={equipes}
              defaultValues={editFuncionario}
              onSuccess={() => setEditFuncionario(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FuncionarioForm({
  action,
  title,
  cidades,
  equipes,
  defaultValues,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  title: string;
  cidades: Cidade[];
  equipes: Equipe[];
  defaultValues?: Funcionario;
  onSuccess: () => void;
}) {
  const [cargo, setCargo] = useState(defaultValues?.cargo ?? "VENDEDOR_EXTERNO");
  const [cidadeId, setCidadeId] = useState(defaultValues?.cidadeId ?? "");
  const [equipeId, setEquipeId] = useState(defaultValues?.equipeId ?? "");
  const [ativo, setAtivo] = useState(defaultValues?.ativo ?? true);

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    fd.set("ativo", ativo ? "true" : "false");
    const result = await action(prev, fd);
    if (result.ok) {
      toast.success("Funcionário salvo com sucesso.");
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
        <Input id="nome" name="nome" defaultValue={defaultValues?.nome ?? ""} required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cpf">CPF ou CNPJ (opcional)</Label>
        <Input
          id="cpf"
          name="cpf"
          defaultValue={defaultValues?.cpf ?? ""}
          placeholder="CPF (11) ou CNPJ (14) — só números"
          maxLength={14}
        />
      </div>
      <div className="space-y-2">
        <Label>Cargo</Label>
        <Select
          value={cargo}
          onValueChange={(v) => setCargo(v ?? "VENDEDOR_EXTERNO")}
          name="cargo"
          items={Object.fromEntries(CARGOS.map((c) => [c.value, c.label]))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o cargo" />
          </SelectTrigger>
          <SelectContent>
            {CARGOS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Cidade</Label>
        <Select
          value={cidadeId}
          onValueChange={(v) => setCidadeId(v ?? "")}
          name="cidadeId"
          items={Object.fromEntries(cidades.map((c) => [c.id, c.nome]))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione a cidade" />
          </SelectTrigger>
          <SelectContent>
            {cidades.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Equipe (opcional)</Label>
        <Select
          value={equipeId}
          onValueChange={(v) => setEquipeId(v ?? "")}
          name="equipeId"
          items={Object.fromEntries(equipes.map((e) => [e.id, e.nome]))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sem equipe" />
          </SelectTrigger>
          <SelectContent>
            {equipes.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail (opcional)</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
          placeholder="Para receber a cobrança de meta por e-mail"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telegramChatId">Telegram chat ID (opcional)</Label>
        <Input
          id="telegramChatId"
          name="telegramChatId"
          defaultValue={defaultValues?.telegramChatId ?? ""}
          placeholder="Ex.: 123456789 — para cobrança por Telegram"
          inputMode="numeric"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ativo" checked={ativo} onCheckedChange={(v) => setAtivo(v === true)} />
        <Label htmlFor="ativo" className="font-normal">
          Funcionário ativo
        </Label>
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

function DeleteFuncionarioButton({ funcionario }: { funcionario: Funcionario }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    const result = await deleteFuncionario(funcionario.id);
    if (result.ok) {
      toast.success("Funcionário excluído.");
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
