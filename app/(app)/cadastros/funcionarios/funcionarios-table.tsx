"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCheck } from "lucide-react";
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
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  toggleFuncionarioAtivo,
  detectarFuncionariosDuplicados,
  mesclarFuncionarios,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar por nome, cidade ou cargo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <DetectarDuplicadosModal />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4" />
              Novo Funcionário
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
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum funcionário encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((f) => (
              <TableRow key={f.id} className={f.ativo ? "" : "opacity-60"}>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell>{f.cpf ?? "—"}</TableCell>
                <TableCell>{cargoLabel(f.cargo)}</TableCell>
                <TableCell>{f.cidade?.nome ?? "—"}</TableCell>
                <TableCell>{f.equipe?.nome ?? "—"}</TableCell>
                <TableCell>
                  <button
                    onClick={async () => {
                      const result = await toggleFuncionarioAtivo(f.id, !f.ativo);
                      if (result.ok) toast.success(f.ativo ? "Funcionário desativado." : "Funcionário ativado.");
                    }}
                  >
                    <Badge variant={f.ativo ? "default" : "secondary"}>
                      {f.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditFuncionario(f)}>
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteFuncionarioButton funcionario={f} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
        <Label htmlFor="cpf">CPF (opcional)</Label>
        <Input
          id="cpf"
          name="cpf"
          defaultValue={defaultValues?.cpf ?? ""}
          placeholder="Somente números"
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

type GrupoDuplicadoItem = {
  motivo: string;
  principal: { id: string; nome: string; cpf: string | null; cargo: string; cidade: string | null };
  duplicados: { id: string; nome: string; cpf: string | null; cargo: string; cidade: string | null }[];
};

function DetectarDuplicadosModal() {
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [grupos, setGrupos] = useState<GrupoDuplicadoItem[]>([]);
  const [mesclandoId, setMesclandoId] = useState<string | null>(null);

  async function handleBuscar() {
    setCarregando(true);
    try {
      const res = await detectarFuncionariosDuplicados();
      setGrupos(res);
      if (res.length === 0) {
        toast.info("Nenhum funcionário duplicado encontrado.");
      }
    } catch {
      toast.error("Erro ao buscar funcionários duplicados.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleMesclar(idPrincipal: string, idDuplicado: string) {
    setMesclandoId(idDuplicado);
    try {
      const res = await mesclarFuncionarios(idPrincipal, idDuplicado);
      if (res.ok) {
        toast.success("Funcionários mesclados com sucesso!");
        handleBuscar();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao mesclar funcionários.");
    } finally {
      setMesclandoId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" onClick={handleBuscar} />}>
        <UserCheck className="size-4" />
        Detectar Duplicados
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detecção de Funcionários Duplicados</DialogTitle>
        </DialogHeader>
        {carregando ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Analisando cadastros...</p>
        ) : grupos.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Nenhum provável duplicado detectado no momento.</p>
            <Button variant="outline" size="sm" onClick={handleBuscar}>
              Buscar novamente
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Escolha qual cadastro manter (Principal) e clique em Mesclar para transferir todo o histórico e desativar o cadastro duplicado.
            </p>
            {grupos.map((g, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{g.motivo}</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="p-2 rounded bg-background border">
                    <p className="font-medium text-foreground">Cadastro 1: {g.principal.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      CPF: {g.principal.cpf ?? "Não informado"} | Cargo: {cargoLabel(g.principal.cargo)} | Cidade: {g.principal.cidade ?? "—"}
                    </p>
                  </div>
                  {g.duplicados.map((d) => (
                    <div key={d.id} className="p-2 rounded bg-background border flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">Cadastro 2: {d.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          CPF: {d.cpf ?? "Não informado"} | Cargo: {cargoLabel(d.cargo)} | Cidade: {d.cidade ?? "—"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={mesclandoId === d.id}
                        onClick={() => handleMesclar(g.principal.id, d.id)}
                      >
                        {mesclandoId === d.id ? "Mesclando..." : "Mesclar no Cadastro 1"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
