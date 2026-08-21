"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Linha = {
  nome: string;
  fonte: number;
  lancado: number;
  bonificado: number;
  diferenca: number;
  situacao: "OK" | "NAO_LANCADO" | "SEM_FONTE" | "DIVERGENTE" | "SEM_BONUS";
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Cada situação diz o que ela SIGNIFICA para o negócio, não o estado técnico.
const SITUACAO = {
  NAO_LANCADO: {
    rotulo: "Vendeu, não entrou",
    classe: "bg-bad/15 text-bad",
    ajuda: "A fonte registra venda e o sistema não lançou. A pessoa não recebe por ela.",
  },
  SEM_FONTE: {
    rotulo: "Lançado sem fonte",
    classe: "bg-warn/15 text-warn",
    ajuda: "Há lançamento sem venda na fonte. Normal se foi lançamento manual.",
  },
  DIVERGENTE: {
    rotulo: "Quantidade diferente",
    classe: "bg-warn/15 text-warn",
    ajuda: "Fonte e sistema discordam de quantas vendas a pessoa fez.",
  },
  SEM_BONUS: {
    rotulo: "Sem bônus",
    classe: "bg-muted text-muted-foreground",
    ajuda: "Vendeu e foi lançado, mas não gerou bônus — meta não atingida ou regra faltando.",
  },
  OK: { rotulo: "Confere", classe: "bg-ok/15 text-ok", ajuda: "" },
} as const;

export function ConferenciaView({
  linhas,
  totalFonte,
  totalLancado,
  semVendedorNaFonte,
}: {
  linhas: Linha[];
  totalFonte: number;
  totalLancado: number;
  semVendedorNaFonte: number;
}) {
  const problemas = linhas.filter((l) => l.situacao !== "OK" && l.situacao !== "SEM_BONUS");
  const diferencaTotal = totalLancado - totalFonte;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Na fonte</p>
          <p className="num text-xl font-semibold">{totalFonte}</p>
          <p className="text-xs text-muted-foreground">Elleven + chip</p>
        </div>
        <div className="surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lançado</p>
          <p className="num text-xl font-semibold">{totalLancado}</p>
          <p className={`text-xs ${diferencaTotal === 0 ? "text-ok" : "text-bad"}`}>
            {diferencaTotal === 0
              ? "bate com a fonte"
              : `${diferencaTotal > 0 ? "+" : ""}${diferencaTotal} vs. fonte`}
          </p>
        </div>
        <div className="surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Precisam de atenção
          </p>
          <p className={`num text-xl font-semibold ${problemas.length ? "text-bad" : "text-ok"}`}>
            {problemas.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {semVendedorNaFonte > 0
              ? `+ ${semVendedorNaFonte} venda(s) sem vendedor na fonte`
              : "nenhuma venda órfã na fonte"}
          </p>
        </div>
      </div>

      <div className="surface-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="w-40">Situação</TableHead>
              <TableHead className="w-24 text-right">Na fonte</TableHead>
              <TableHead className="w-24 text-right">Lançado</TableHead>
              <TableHead className="w-32 text-right">Bonificação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhuma venda neste período ainda.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => {
              const s = SITUACAO[l.situacao];
              return (
                <TableRow key={l.nome}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${s.classe}`}
                      title={s.ajuda}
                    >
                      {s.rotulo}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{l.fonte}</TableCell>
                  <TableCell className="text-right">
                    {l.lancado}
                    {l.diferenca !== 0 && (
                      <span className={l.diferenca < 0 ? "ml-2 text-bad" : "ml-2 text-warn"}>
                        {l.diferenca > 0 ? `+${l.diferenca}` : l.diferenca}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{fmtMoeda(l.bonificado)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Passe o mouse sobre a situação para ver o que ela significa. &quot;Na
        fonte&quot; é o dado cru do Elleven e do L&amp;M Móvel; &quot;lançado&quot;
        é o que a importação gravou; &quot;bonificação&quot; é a base do pagamento.
      </p>
    </div>
  );
}
