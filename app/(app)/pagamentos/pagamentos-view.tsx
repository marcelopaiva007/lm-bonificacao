"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Clock, Ban } from "lucide-react";
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
import { marcarSituacaoPagamento } from "@/lib/actions/pagamento";

type Situacao = "A_PAGAR" | "PAGO" | "RETIDO";

type Linha = {
  funcionarioId: string;
  funcionarioNome: string;
  valorCalculado: number;
  situacao: Situacao;
  observacao: string | null;
  marcadoPorNome: string | null;
  marcadoEm: string | null;
};

type Resumo = {
  aPagar: { pessoas: number; valor: number };
  pago: { pessoas: number; valor: number };
  retido: { pessoas: number; valor: number };
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtQuando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

const ESTILO: Record<Situacao, { rotulo: string; classe: string; Icone: typeof Check }> = {
  PAGO: { rotulo: "Pago", classe: "bg-ok/15 text-ok", Icone: Check },
  A_PAGAR: { rotulo: "A pagar", classe: "bg-warn/15 text-warn", Icone: Clock },
  RETIDO: { rotulo: "Retido", classe: "bg-bad/15 text-bad", Icone: Ban },
};

export function PagamentosView({
  periodo,
  linhas,
  resumo,
  mesFechado,
  podeMarcar,
}: {
  periodo: string;
  linhas: Linha[];
  resumo: Resumo;
  mesFechado: boolean;
  podeMarcar: boolean;
}) {
  const router = useRouter();
  const [mes, setMes] = useState(periodo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="mes" className="text-sm text-muted-foreground">
            Período
          </label>
          <Input
            id="mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-44"
          />
        </div>
        <Button size="sm" onClick={() => router.push(`/pagamentos?periodo=${mes}`)}>
          Ver
        </Button>
      </div>

      {!mesFechado && linhas.length > 0 && (
        <div className="surface rounded-xl p-3 text-sm text-warn">
          Este mês ainda está aberto — os valores podem mudar até o fechamento.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {(["aPagar", "pago", "retido"] as const).map((chave) => {
          const mapa = { aPagar: "A_PAGAR", pago: "PAGO", retido: "RETIDO" } as const;
          const s = ESTILO[mapa[chave]];
          const dado = resumo[chave];
          return (
            <div key={chave} className="surface rounded-xl p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {s.rotulo}
              </p>
              <p className="num text-xl font-semibold">{fmtMoeda(dado.valor)}</p>
              <p className="text-xs text-muted-foreground">{dado.pessoas} pessoa(s)</p>
            </div>
          );
        })}
      </div>

      <div className="surface rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead className="w-32 text-right">Valor</TableHead>
              <TableHead className="w-28">Situação</TableHead>
              <TableHead>Marcado por</TableHead>
              {podeMarcar && <TableHead className="w-56 text-right">Marcar como</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={podeMarcar ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  Nenhuma bonificação calculada neste período.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => (
              <LinhaPagamento
                key={l.funcionarioId}
                linha={l}
                periodo={periodo}
                podeMarcar={podeMarcar}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LinhaPagamento({
  linha,
  periodo,
  podeMarcar,
}: {
  linha: Linha;
  periodo: string;
  podeMarcar: boolean;
}) {
  const [salvando, iniciar] = useTransition();
  const { rotulo, classe, Icone } = ESTILO[linha.situacao];
  const quando = fmtQuando(linha.marcadoEm);

  function marcar(situacao: Situacao) {
    // Reter exige motivo — a ação recusa sem ele, então pedimos aqui.
    let observacao: string | undefined;
    if (situacao === "RETIDO") {
      const motivo = window.prompt(`Por que a bonificação de ${linha.funcionarioNome} está retida?`);
      if (motivo === null) return;
      observacao = motivo;
    }
    iniciar(async () => {
      const r = await marcarSituacaoPagamento(periodo, linha.funcionarioId, situacao, observacao);
      if (r.ok) toast.success(`${linha.funcionarioNome}: ${ESTILO[situacao].rotulo.toLowerCase()}.`);
      else toast.error(r.error);
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{linha.funcionarioNome}</TableCell>
      <TableCell className="text-right">{fmtMoeda(linha.valorCalculado)}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${classe}`}
        >
          <Icone className="size-3" />
          {rotulo}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {linha.marcadoPorNome ? (
          <>
            {linha.marcadoPorNome}
            {quando && <span className="ml-1 text-xs">· {quando}</span>}
            {linha.observacao && (
              <div className="text-xs italic">&ldquo;{linha.observacao}&rdquo;</div>
            )}
          </>
        ) : (
          "—"
        )}
      </TableCell>
      {podeMarcar && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            {(["PAGO", "A_PAGAR", "RETIDO"] as const)
              .filter((s) => s !== linha.situacao)
              .map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="ghost"
                  disabled={salvando}
                  onClick={() => marcar(s)}
                >
                  {ESTILO[s].rotulo}
                </Button>
              ))}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
