"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACAO_LABEL, type AcaoAuditada } from "@/lib/auditoria-labels";

type Alteracao = {
  id: number;
  acao: string;
  usuarioNome: string;
  alvo: string | null;
  periodo: string | null;
  resumo: string;
  antes: unknown;
  depois: unknown;
  criadoEm: Date | string;
};

const fmtData = (d: Date | string) =>
  new Date(d).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const acaoLabel = (acao: string) =>
  ACAO_LABEL[acao as AcaoAuditada] ?? acao;

// Ações que mexem diretamente em quanto alguém recebe ganham destaque — são as
// que alguém vai procurar quando um valor for contestado.
const DESTAQUE = new Set(["REGRA_CRIADA", "AJUSTE_CRIADO", "AJUSTE_REMOVIDO", "MES_REABERTO"]);

export function RegistroView({
  alteracoes,
  periodoAtual,
}: {
  alteracoes: Alteracao[];
  periodoAtual: string | null;
}) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(periodoAtual ?? "");

  function filtrar() {
    if (/^\d{4}-\d{2}$/.test(periodo)) router.push(`/registro?periodo=${periodo}`);
    else router.push("/registro");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="periodo" className="text-sm text-muted-foreground">
            Filtrar por período
          </label>
          <Input
            id="periodo"
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="w-44"
          />
        </div>
        <Button size="sm" onClick={filtrar}>
          Filtrar
        </Button>
        {periodoAtual && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPeriodo("");
              router.push("/registro");
            }}
          >
            Ver tudo
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Quando</TableHead>
              <TableHead className="w-52">O que aconteceu</TableHead>
              <TableHead className="w-36">Quem</TableHead>
              <TableHead>Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alteracoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhuma alteração registrada
                  {periodoAtual ? " neste período." : " ainda."}
                </TableCell>
              </TableRow>
            )}
            {alteracoes.map((a) => (
              <LinhaAlteracao key={a.id} alteracao={a} />
            ))}
          </TableBody>
        </Table>
      </div>

      {alteracoes.length >= 300 && (
        <p className="text-sm text-muted-foreground">
          Mostrando as 300 alterações mais recentes. Filtre por período para ver as
          mais antigas.
        </p>
      )}
    </div>
  );
}

function LinhaAlteracao({ alteracao }: { alteracao: Alteracao }) {
  const [aberto, setAberto] = useState(false);
  const temDetalhe = alteracao.antes != null || alteracao.depois != null;

  return (
    <>
      <TableRow className={DESTAQUE.has(alteracao.acao) ? "bg-muted/40" : undefined}>
        <TableCell className="whitespace-nowrap tabular-nums text-sm">
          {fmtData(alteracao.criadoEm)}
        </TableCell>
        <TableCell className="text-sm font-medium">{acaoLabel(alteracao.acao)}</TableCell>
        <TableCell className="text-sm">{alteracao.usuarioNome}</TableCell>
        <TableCell className="text-sm">
          <div className="flex items-start gap-2">
            {temDetalhe && (
              <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={aberto ? "Ocultar valores" : "Ver valores"}
              >
                {aberto ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            )}
            <span>{alteracao.resumo}</span>
          </div>
        </TableCell>
      </TableRow>
      {aberto && temDetalhe && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30">
            <div className="grid gap-3 py-2 md:grid-cols-2">
              <Valores titulo="Antes" dados={alteracao.antes} />
              <Valores titulo="Depois" dados={alteracao.depois} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function Valores({ titulo, dados }: { titulo: string; dados: unknown }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {dados == null ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded border bg-background p-2 text-xs">
          {JSON.stringify(dados, null, 2)}
        </pre>
      )}
    </div>
  );
}
