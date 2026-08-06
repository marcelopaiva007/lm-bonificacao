"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { salvarMeta, excluirMeta } from "@/lib/actions/metas";
import type { ActionResult } from "@/lib/constants";

type Progresso = {
  alvoNome: string;
  alvo: "FUNCIONARIO" | "EQUIPE";
  metaInternet: number;
  metaChip: number;
  internet: number;
  chip: number;
  percentualInternet: number | null;
  percentualChip: number | null;
};

type Meta = { id: number; alvoNome: string; alvo: "FUNCIONARIO" | "EQUIPE" };
type Opcao = { id: string; nome: string };

const initialState: ActionResult = { ok: true };

// Cor por faixa de atingimento — e o rótulo em texto acompanha, para não
// depender só de enxergar a cor.
function faixa(pct: number | null) {
  if (pct === null) return { classe: "text-muted-foreground", texto: "—" };
  if (pct >= 100) return { classe: "text-ok", texto: `${pct}%` };
  if (pct >= 80) return { classe: "text-warn", texto: `${pct}%` };
  return { classe: "text-bad", texto: `${pct}%` };
}

export function MetasDefinidasView({
  periodo,
  progresso,
  metas,
  funcionarios,
  equipes,
  podeEditar,
}: {
  periodo: string;
  progresso: Progresso[];
  metas: Meta[];
  funcionarios: Opcao[];
  equipes: Opcao[];
  podeEditar: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Metas do mês</h2>
          <p className="text-sm text-muted-foreground">
            Definidas por pessoa ou equipe. Servem para acompanhar e cobrar —{" "}
            <strong>não alteram o cálculo da bonificação</strong>, que segue a regra
            vigente.
          </p>
        </div>
        {podeEditar && (
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" />
              Nova meta
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Definir meta</DialogTitle>
              </DialogHeader>
              <FormMeta
                periodo={periodo}
                funcionarios={funcionarios}
                equipes={equipes}
                onSuccess={() => setAberto(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {progresso.length === 0 ? (
        <div className="surface-card p-4 text-sm text-muted-foreground">
          Nenhuma meta definida para este mês.
          {podeEditar && " Use “Nova meta” para criar a primeira."}
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quem</TableHead>
                <TableHead className="w-40 text-right">Internet</TableHead>
                <TableHead className="w-40 text-right">Chip</TableHead>
                {podeEditar && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {progresso.map((p, i) => {
                const fi = faixa(p.percentualInternet);
                const fc = faixa(p.percentualChip);
                const meta = metas[i];
                return (
                  <TableRow key={`${p.alvo}-${p.alvoNome}`}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {p.alvo === "EQUIPE" ? (
                          <Users className="size-3.5 text-muted-foreground" />
                        ) : (
                          <User className="size-3.5 text-muted-foreground" />
                        )}
                        {p.alvoNome}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.metaInternet > 0 ? (
                        <>
                          {p.internet} / {p.metaInternet}
                          <span className={`ml-2 font-medium ${fi.classe}`}>{fi.texto}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.metaChip > 0 ? (
                        <>
                          {p.chip} / {p.metaChip}
                          <span className={`ml-2 font-medium ${fc.classe}`}>{fc.texto}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        {meta && <BotaoExcluir id={meta.id} nome={p.alvoNome} />}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FormMeta({
  periodo,
  funcionarios,
  equipes,
  onSuccess,
}: {
  periodo: string;
  funcionarios: Opcao[];
  equipes: Opcao[];
  onSuccess: () => void;
}) {
  const [alvo, setAlvo] = useState<"FUNCIONARIO" | "EQUIPE">("FUNCIONARIO");
  const [alvoId, setAlvoId] = useState("");

  const opcoes = alvo === "FUNCIONARIO" ? funcionarios : equipes;

  const [state, formAction, pendente] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await salvarMeta(prev, fd);
    if (r.ok) {
      toast.success("Meta salva.");
      onSuccess();
    }
    return r;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="periodo" value={periodo} />
      <input type="hidden" name="alvo" value={alvo} />
      <input type="hidden" name="alvoId" value={alvoId} />

      <div className="space-y-2">
        <Label>Meta para</Label>
        <Select
          value={alvo}
          onValueChange={(v) => {
            if (!v) return;
            setAlvo(v as "FUNCIONARIO" | "EQUIPE");
            setAlvoId("");
          }}
          items={{ FUNCIONARIO: "Uma pessoa", EQUIPE: "Uma equipe" }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FUNCIONARIO">Uma pessoa</SelectItem>
            <SelectItem value="EQUIPE">Uma equipe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{alvo === "FUNCIONARIO" ? "Funcionário" : "Equipe"}</Label>
        <Select
          value={alvoId}
          onValueChange={(v) => {
            if (v) setAlvoId(String(v));
          }}
          items={Object.fromEntries(opcoes.map((o) => [o.id, o.nome]))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="metaInternet">Meta de internet</Label>
          <Input id="metaInternet" name="metaInternet" type="number" min={0} defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="metaChip">Meta de chip</Label>
          <Input id="metaChip" name="metaChip" type="number" min={0} defaultValue={0} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacao">Observação</Label>
        <Input id="observacao" name="observacao" placeholder="Opcional" />
      </div>

      {!state.ok && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="submit" disabled={pendente || !alvoId}>
          {pendente ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function BotaoExcluir({ id, nome }: { id: number; nome: string }) {
  const [removendo, iniciar] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={removendo}
      onClick={() =>
        iniciar(async () => {
          const r = await excluirMeta(id);
          if (r.ok) toast.success(`Meta de ${nome} removida.`);
          else toast.error(r.error);
        })
      }
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
