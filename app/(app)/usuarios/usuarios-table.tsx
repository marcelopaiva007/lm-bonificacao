"use client";

import { useActionState, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, KeyRound, Building2, Mail, ShieldAlert, Search, UserCheck, UserX, Shield } from "lucide-react";
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
  createUsuario,
  updateUsuario,
  deleteUsuario,
  resetSenhaUsuario,
  toggleUsuarioAtivo,
} from "@/lib/actions/usuarios";
import type { ActionResult } from "@/lib/constants";

const ROLES = [
  { value: "ADMIN", label: "Administrativo/Financeiro" },
  { value: "DIRETORIA", label: "Diretoria/Gestão" },
  { value: "RH_MANAGER", label: "RH (gestor de empresa)" },
  { value: "GESTOR_SETOR", label: "Gestor de setor" },
] as const;

const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

type Empresa = { id: string; nome: string; cnpj?: string | null; marca?: string | null };
type Setor = { id: string; nome: string; empresaId: string };
type UserScope = {
  empresaId: string;
  nivelAcesso?: string;
  empresa?: Empresa;
};

type Usuario = {
  id: string;
  nome: string;
  username: string;
  email?: string | null;
  cpf?: string | null;
  role: string;
  ativo?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: Date | string | null;
  empresaId: string | null;
  empresa: Empresa | null;
  setorId: string | null;
  setor: Setor | null;
  scopes?: UserScope[];
};

const initialState: ActionResult = { ok: true };

export function UsuariosTable({
  usuarios,
  empresas,
  setores,
}: {
  usuarios: Usuario[];
  empresas: Empresa[];
  setores: Setor[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editUsuario, setEditUsuario] = useState<Usuario | null>(null);
  const [senhaUsuario, setSenhaUsuario] = useState<Usuario | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  const totalAtivos = useMemo(() => usuarios.filter((u) => u.ativo !== false).length, [usuarios]);
  const totalInativos = useMemo(() => usuarios.filter((u) => u.ativo === false).length, [usuarios]);

  const filtrados = useMemo(() => {
    let result = usuarios;

    if (filtroRole !== "TODOS") {
      result = result.filter((u) => u.role === filtroRole);
    }

    if (filtroStatus === "ATIVOS") {
      result = result.filter((u) => u.ativo !== false);
    } else if (filtroStatus === "INATIVOS") {
      result = result.filter((u) => u.ativo === false);
    }

    const termo = busca.trim().toLowerCase();
    if (!termo) return result;

    return result.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        u.username.toLowerCase().includes(termo) ||
        (u.email && u.email.toLowerCase().includes(termo)) ||
        roleLabel(u.role).toLowerCase().includes(termo)
    );
  }, [usuarios, busca, filtroRole, filtroStatus]);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              placeholder="Buscar por nome, login, e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-64 border-slate-800 bg-slate-950/80 pl-9 text-xs"
            />
          </div>
          <select
            className="flex h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-200 shadow-xs transition-colors focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            value={filtroRole}
            onChange={(e) => setFiltroRole(e.target.value)}
          >
            <option value="TODOS">Todos os Papéis</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className="flex h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-200 shadow-xs transition-colors focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVOS">Somente Ativos ({totalAtivos})</option>
            <option value="INATIVOS">Somente Inativos ({totalInativos})</option>
          </select>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20 text-xs">
              <Plus className="size-4 mr-1.5" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950/95 backdrop-blur-xl">
            <UsuarioForm
              action={createUsuario}
              title="Novo Usuário do Sistema"
              empresas={empresas}
              setores={setores}
              onSuccess={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 shadow-xl backdrop-blur-md">
        <Table>
          <TableHeader className="bg-slate-900/90">
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="font-semibold text-slate-300">Usuário / E-mail</TableHead>
              <TableHead className="font-semibold text-slate-300">Login</TableHead>
              <TableHead className="font-semibold text-slate-300">Papel Global</TableHead>
              <TableHead className="font-semibold text-slate-300">Empresa / Setor</TableHead>
              <TableHead className="font-semibold text-slate-300">Último Acesso</TableHead>
              <TableHead className="font-semibold text-slate-300">Status</TableHead>
              <TableHead className="w-32 text-right font-semibold text-slate-300">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((u) => (
              <TableRow
                key={u.id}
                className={`border-slate-800/60 transition-colors ${
                  u.ativo === false ? "opacity-50 bg-slate-950/40" : "hover:bg-slate-900/50"
                }`}
              >
                <TableCell className="font-semibold text-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-400">
                      {u.nome ? u.nome.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <div className="text-slate-100 font-semibold">{u.nome}</div>
                      {u.email && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="size-3 text-slate-500" /> {u.email}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/20">
                    {u.username}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 text-[11px]">
                    <Shield className="size-3 mr-1 text-cyan-400" />
                    {roleLabel(u.role)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.empresa ? (
                    <span className="text-xs text-slate-300 font-medium">{u.empresa.nome} {u.setor ? `(${u.setor.nome})` : ""}</span>
                  ) : (
                    <span className="text-xs text-slate-500">Global</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-400 font-mono">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await toggleUsuarioAtivo(u.id, u.ativo === false ? true : false);
                        if (res.ok) {
                          toast.success(u.ativo === false ? "Usuário ativado com sucesso." : "Usuário desativado.");
                        } else {
                          toast.error(res.error);
                        }
                      }}
                      className="cursor-pointer focus:outline-none"
                    >
                      <Badge
                        variant={u.ativo !== false ? "default" : "destructive"}
                        className={
                          u.ativo !== false
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold hover:bg-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold hover:bg-rose-500/20"
                        }
                      >
                        <span className={`mr-1 inline-block size-1.5 rounded-full ${u.ativo !== false ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                        {u.ativo !== false ? "Ativo" : "Inativo"}
                      </Badge>
                    </button>
                    {u.mustChangePassword && (
                      <div>
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40 bg-amber-500/10">
                          Senha Pendente
                        </Badge>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-slate-400 hover:text-amber-400 hover:bg-slate-800"
                      onClick={() => setSenhaUsuario(u)}
                      title="Redefinir senha"
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                      onClick={() => setEditUsuario(u)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteUsuarioButton usuario={u} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Modal */}
      <Dialog open={!!editUsuario} onOpenChange={(open) => !open && setEditUsuario(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          {editUsuario && (
            <UsuarioForm
              action={updateUsuario.bind(null, editUsuario.id)}
              title="Editar Cadastro de Usuário"
              empresas={empresas}
              setores={setores}
              defaultValues={editUsuario}
              onSuccess={() => setEditUsuario(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={!!senhaUsuario} onOpenChange={(open) => !open && setSenhaUsuario(null)}>
        <DialogContent className="border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          {senhaUsuario && (
            <RedefinirSenhaForm usuario={senhaUsuario} onSuccess={() => setSenhaUsuario(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsuarioForm({
  action,
  title,
  empresas,
  setores,
  defaultValues,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  title: string;
  empresas: Empresa[];
  setores: Setor[];
  defaultValues?: Usuario;
  onSuccess: () => void;
}) {
  const [role, setRole] = useState(defaultValues?.role ?? "DIRETORIA");
  const [empresaId, setEmpresaId] = useState(defaultValues?.empresaId ?? "");
  const [setorId, setSetorId] = useState(defaultValues?.setorId ?? "");

  const precisaEmpresa = role === "RH_MANAGER" || role === "GESTOR_SETOR";
  const precisaSetor = role === "GESTOR_SETOR";
  const setoresDaEmpresa = setores.filter((s) => s.empresaId === empresaId);

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) {
      toast.success("Usuário salvo com sucesso.");
      onSuccess();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-slate-100">{title}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="nome" className="text-xs font-semibold text-slate-300">Nome Completo</Label>
          <Input id="nome" name="nome" defaultValue={defaultValues?.nome ?? ""} required autoFocus className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-xs font-semibold text-slate-300">Login de Acesso</Label>
          <Input id="username" name="username" defaultValue={defaultValues?.username ?? ""} required className="border-slate-800 bg-slate-900/80 text-xs font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-slate-300">E-mail Corporativo</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} placeholder="email@empresa.com" className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cpf" className="text-xs font-semibold text-slate-300">CPF (opcional)</Label>
          <Input id="cpf" name="cpf" defaultValue={defaultValues?.cpf ?? ""} placeholder="000.000.000-00" className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
      </div>

      {!defaultValues && (
        <div className="space-y-1.5">
          <Label htmlFor="senha" className="text-xs font-semibold text-slate-300">Senha inicial</Label>
          <Input id="senha" name="senha" type="password" minLength={8} required className="border-slate-800 bg-slate-900/80 text-xs" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-300">Papel Global</Label>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v ?? "DIRETORIA");
            setEmpresaId("");
            setSetorId("");
          }}
          name="role"
          items={Object.fromEntries(ROLES.map((r) => [r.value, r.label]))}
        >
          <SelectTrigger className="w-full border-slate-800 bg-slate-900/80 text-xs">
            <SelectValue placeholder="Selecione o papel" />
          </SelectTrigger>
          <SelectContent className="border-slate-800 bg-slate-900">
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-xs">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {precisaEmpresa && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">Empresa Principal (RH)</Label>
          <Select
            value={empresaId}
            onValueChange={(v) => {
              setEmpresaId(v ?? "");
              setSetorId("");
            }}
            name="empresaId"
            items={Object.fromEntries(empresas.map((e) => [e.id, e.nome]))}
          >
            <SelectTrigger className="w-full border-slate-800 bg-slate-900/80 text-xs">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900">
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-xs">
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {precisaSetor && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">Setor Principal</Label>
          <Select
            value={setorId}
            onValueChange={(v) => setSetorId(v ?? "")}
            name="setorId"
            items={Object.fromEntries(setoresDaEmpresa.map((s) => [s.id, s.nome]))}
          >
            <SelectTrigger className="w-full border-slate-800 bg-slate-900/80 text-xs">
              <SelectValue placeholder={empresaId ? "Selecione o setor" : "Selecione a empresa primeiro"} />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900">
              {setoresDaEmpresa.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
          {isPending ? "Salvando..." : "Salvar Usuário"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RedefinirSenhaForm({ usuario, onSuccess }: { usuario: Usuario; onSuccess: () => void }) {
  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await resetSenhaUsuario(usuario.id, prev, fd);
    if (result.ok) {
      toast.success("Senha redefinida com sucesso. O usuário precisará alterar no próximo login.");
      onSuccess();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-slate-100">Redefinir senha de {usuario.nome}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="senha" className="text-xs font-semibold text-slate-300">Nova senha temporária</Label>
        <Input id="senha" name="senha" type="password" minLength={8} required autoFocus className="border-slate-800 bg-slate-900/80 text-xs" />
      </div>
      <p className="text-xs text-amber-400 flex items-center gap-1.5 bg-amber-950/20 border border-amber-500/30 p-2 rounded-lg font-medium">
        <ShieldAlert className="size-4 shrink-0 text-amber-400" />
        O usuário será solicitado a alterar esta senha obrigatoriamente no próximo acesso.
      </p>
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
          {isPending ? "Salvando..." : "Redefinir Senha"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteUsuarioButton({ usuario }: { usuario: Usuario }) {
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    const result = await deleteUsuario(usuario.id);
    if (result.ok) {
      toast.success("Usuário excluído com sucesso.");
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
