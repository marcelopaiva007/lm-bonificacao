"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { unificarFuncionariosAction } from "@/lib/actions/duplicados";
import type { GrupoSuspeito } from "@/lib/duplicados";
import { CARGOS } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Merge } from "lucide-react";

const cargoLabel = (cargo: string) =>
  CARGOS.find((c) => c.value === cargo)?.label ?? cargo;

type Escolha = {
  grupo: GrupoSuspeito;
  manterId: string;
  removerId: string;
};

export function DuplicadosView({ grupos }: { grupos: GrupoSuspeito[] }) {
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [pending, startTransition] = useTransition();

  if (grupos.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Nenhuma suspeita de duplicidade entre os funcionários ativos. Se uma importação criar
          ficha parecida (nome, grafia ou CPF), ela aparece aqui.
        </AlertDescription>
      </Alert>
    );
  }

  function confirmar() {
    if (!escolha) return;
    startTransition(async () => {
      const r = await unificarFuncionariosAction(escolha.manterId, escolha.removerId);
      if (r.ok) {
        toast.success(`Fichas unificadas. ${r.detalhe ?? ""}`);
        setEscolha(null);
      } else {
        toast.error(r.error);
      }
    });
  }

  const fichaEscolhida = (id: string | undefined) =>
    escolha?.grupo.fichas.find((f) => f.id === id);

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <Card key={grupo.chave}>
          <CardHeader>
            <CardTitle className="text-base">{grupo.fichas[0].nome}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {grupo.fichas.length} fichas · suspeita por {grupo.motivo}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {grupo.fichas.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{f.nome}</p>
                  <p className="text-muted-foreground">
                    {cargoLabel(f.cargo)} · {f.cidade ?? "sem cidade"} ·{" "}
                    {f.equipe ?? "sem equipe"} · {f.cpf ? "com CPF" : "sem CPF"} · criada em{" "}
                    {f.criadoEm.split("-").reverse().join("/")}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {f.periodos.length === 0 && (
                      <Badge variant="outline">nunca vendeu</Badge>
                    )}
                    {f.periodos.map((p) => (
                      <Badge key={p.periodo} variant="secondary">
                        {p.periodo}: {p.vendas} venda(s)
                        {p.status === "FECHADO" ? " · fechado" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {grupo.fichas
                    .filter((outra) => outra.id !== f.id)
                    .slice(0, 1)
                    .map(() => (
                      <Button
                        key={f.id}
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // O botão fica na ficha que será MANTIDA; a outra do
                          // grupo é a removida. Grupos com 3+ fichas unificam
                          // em pares, um clique de cada vez.
                          const outra = grupo.fichas.find((o) => o.id !== f.id);
                          if (!outra) return;
                          setEscolha({ grupo, manterId: f.id, removerId: outra.id });
                        }}
                      >
                        <Merge className="size-4" />
                        Manter esta
                      </Button>
                    ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Dialog open={escolha != null} onOpenChange={(aberto) => !aberto && setEscolha(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unificar cadastros?</DialogTitle>
            <DialogDescription>Confira antes de confirmar — a decisão é sua.</DialogDescription>
          </DialogHeader>
          {escolha && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Fica:</span>{" "}
                {fichaEscolhida(escolha.manterId)?.nome} (
                {cargoLabel(fichaEscolhida(escolha.manterId)?.cargo ?? "")})
              </p>
              <p>
                <span className="font-medium">É desativada:</span>{" "}
                {fichaEscolhida(escolha.removerId)?.nome} (
                {cargoLabel(fichaEscolhida(escolha.removerId)?.cargo ?? "")})
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Lançamentos de meses abertos passam para a ficha mantida e o mês recalcula.</li>
                <li>Meses fechados não mudam — ficam documentados na ficha desativada.</li>
                <li>CPF, contato e equipe migram se a ficha mantida não os tiver.</li>
                <li>Nada é apagado, e a unificação fica no Registro de Alterações.</li>
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscolha(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={pending}>
              {pending ? "Unificando..." : "Unificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
