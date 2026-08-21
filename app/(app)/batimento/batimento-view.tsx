"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
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

type Mudanca = {
  funcionarioNome: string;
  origem: string;
  tipo: "ENTROU" | "SUMIU" | "MUDOU";
  vendasAntes: number;
  vendasDepois: number;
  valorAntes: number;
  valorDepois: number;
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDia = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const ORIGEM_LABEL: Record<string, string> = {
  ELLEVEN_AUTO: "Elleven",
  CHIP_MOVEL: "Chip",
  MANUAL: "Manual",
  IMPORTADO: "Planilha",
};

// Severidade em cor E forma: sumiço não pode depender só de alguém enxergar
// vermelho.
const ESTILO = {
  SUMIU: { rotulo: "Sumiu", classe: "bg-bad/15 text-bad", Icone: ArrowDown },
  MUDOU: { rotulo: "Mudou", classe: "bg-warn/15 text-warn", Icone: Minus },
  ENTROU: { rotulo: "Entrou", classe: "bg-ok/15 text-ok", Icone: ArrowUp },
} as const;

export function BatimentoView({
  periodo,
  diaAtual,
  diaAnterior,
  mudancas,
}: {
  periodo: string;
  diaAtual: string | null;
  diaAnterior: string | null;
  mudancas: Mudanca[];
}) {
  const router = useRouter();
  const [mes, setMes] = useState(periodo);

  const sumiram = mudancas.filter((m) => m.tipo === "SUMIU");
  const perdaEmVendas = sumiram.reduce((acc, m) => acc + m.vendasAntes, 0);

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
        <Button size="sm" onClick={() => router.push(`/batimento?periodo=${mes}`)}>
          Ver
        </Button>
      </div>

      <div className="surface-card p-4 text-sm">
        {diaAnterior ? (
          <>
            Comparando <strong>{fmtDia(diaAtual)}</strong> com{" "}
            <strong>{fmtDia(diaAnterior)}</strong>.{" "}
            {mudancas.length === 0 ? (
              <span className="text-ok">Nada mudou entre as duas sincronizações.</span>
            ) : (
              <>
                {mudancas.length} mudança(s)
                {sumiram.length > 0 && (
                  <span className="text-bad">
                    {" "}
                    — {sumiram.length} vendedor(es) sumiram, {perdaEmVendas} venda(s) a menos
                  </span>
                )}
                .
              </>
            )}
          </>
        ) : diaAtual ? (
          <>
            Primeiro retrato deste período, de <strong>{fmtDia(diaAtual)}</strong>. A
            comparação aparece a partir da próxima sincronização.
          </>
        ) : (
          <>
            Ainda não há retrato deste período. Ele é gravado ao fim de cada
            sincronização — o próximo sync já deixa o primeiro.
          </>
        )}
      </div>

      {mudancas.length > 0 && (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">O que houve</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="w-24">Origem</TableHead>
                <TableHead className="w-32 text-right">Vendas</TableHead>
                <TableHead className="w-48 text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mudancas.map((m, i) => {
                const { rotulo, classe, Icone } = ESTILO[m.tipo];
                const difVendas = m.vendasDepois - m.vendasAntes;
                return (
                  <TableRow key={`${m.funcionarioNome}-${m.origem}-${i}`}>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${classe}`}
                      >
                        <Icone className="size-3" />
                        {rotulo}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{m.funcionarioNome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ORIGEM_LABEL[m.origem] ?? m.origem}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.vendasAntes} → {m.vendasDepois}
                      <span
                        className={
                          difVendas < 0 ? "ml-2 text-bad" : difVendas > 0 ? "ml-2 text-ok" : "ml-2"
                        }
                      >
                        {difVendas > 0 ? `+${difVendas}` : difVendas}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtMoeda(m.valorAntes)} → {fmtMoeda(m.valorDepois)}
                    </TableCell>
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
