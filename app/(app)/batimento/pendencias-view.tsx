"use client";

import { AlertTriangle, UserPlus, UserSearch } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Aproximado = {
  nomeNaFonte: string;
  nomeNoCadastro: string;
  vendas: number;
  valor: number;
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PendenciasView({
  aproximados,
  vendasSemVendedor,
  semCadastro,
}: {
  aproximados: Aproximado[];
  vendasSemVendedor: number;
  semCadastro: string[];
}) {
  const nada =
    aproximados.length === 0 && vendasSemVendedor === 0 && semCadastro.length === 0;

  if (nada) {
    return (
      <div className="surface rounded-xl p-4 text-sm text-ok">
        Nenhuma pendência: todas as vendas do período têm vendedor identificado e
        nenhum nome precisou ser adivinhado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {aproximados.length > 0 && (
        <div className="surface rounded-xl overflow-x-auto">
          <div className="flex items-start gap-2 border-b p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <p className="text-sm font-medium">Nome adivinhado pelo sistema</p>
              <p className="text-xs text-muted-foreground">
                O nome na fonte não bate exatamente com o cadastro e o sistema
                escolheu o mais parecido. Se errou, a venda foi para a pessoa errada.
              </p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome na fonte</TableHead>
                <TableHead>Foi atribuído a</TableHead>
                <TableHead className="w-20 text-right">Vendas</TableHead>
                <TableHead className="w-32 text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aproximados.map((a) => (
                <TableRow key={a.nomeNaFonte}>
                  <TableCell className="font-medium">{a.nomeNaFonte}</TableCell>
                  <TableCell className="text-muted-foreground">{a.nomeNoCadastro}</TableCell>
                  <TableCell className="text-right">{a.vendas}</TableCell>
                  <TableCell className="text-right">{fmtMoeda(a.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {vendasSemVendedor > 0 && (
        <div className="surface rounded-xl flex items-start gap-2 p-3">
          <UserSearch className="mt-0.5 size-4 shrink-0 text-bad" />
          <div>
            <p className="text-sm font-medium">
              {vendasSemVendedor} venda(s) sem vendedor na fonte
            </p>
            <p className="text-xs text-muted-foreground">
              Negociações ganhas em que o campo de vendedor veio vazio no Elleven.
              Elas não entram no bônus de ninguém. Para recuperá-las, é preciso
              preencher o vendedor no próprio Elleven — o próximo sync as traz.
            </p>
          </div>
        </div>
      )}

      {semCadastro.length > 0 && (
        <div className="surface rounded-xl flex items-start gap-2 p-3">
          <UserPlus className="mt-0.5 size-4 shrink-0 text-warn" />
          <div>
            <p className="text-sm font-medium">
              {semCadastro.length} vendedor(es) criado(s) automaticamente
            </p>
            <p className="text-xs text-muted-foreground">
              Nomes que não existiam no cadastro: {semCadastro.join(", ")}. Entraram
              como Vendedor Externo, sem CPF, cidade nem equipe — e já contam para a
              bonificação. Confira se é contratação nova ou o mesmo nome escrito de
              outro jeito.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
