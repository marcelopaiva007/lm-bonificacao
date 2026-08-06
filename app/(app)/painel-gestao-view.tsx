"use client";

import { Phone, Search, Megaphone, TriangleAlert } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Resumo = {
  vendido: number;
  bonificacao: number;
  projecaoVendido: number;
  projecaoBonificacao: number;
  custoComissao: number | null;
  custoComissaoAnterior: number | null;
  vendidoAnterior: number;
  diaAtual: number;
  diasNoMes: number;
  projecaoConfiavel: boolean;
};

type ItemAtencao = {
  nome: string;
  motivo: string;
  acao: "ligar" | "entender" | "avisar";
  gravidade: "alta" | "media" | "boa";
};

type LinhaEquipe = {
  nome: string;
  internet: number;
  meta: number | null;
  percentual: number | null;
  pessoas: number;
};

const LIMITE_VERMELHO = 25;
const LIMITE_AMARELO = 23;

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

const ACAO = {
  ligar: { rotulo: "ligar", Icone: Phone },
  entender: { rotulo: "entender", Icone: Search },
  avisar: { rotulo: "avisar", Icone: Megaphone },
} as const;

const GRAVIDADE = {
  alta: "bg-bad/15 text-bad",
  media: "bg-warn/15 text-warn",
  boa: "bg-ok/15 text-ok",
} as const;

export function PainelGestaoView({
  resumo,
  atencao,
  equipes,
  crons,
}: {
  resumo: Resumo;
  atencao: ItemAtencao[];
  equipes: LinhaEquipe[];
  crons: { label: string; atrasado: boolean; erro: string | null }[];
}) {
  const custo = resumo.custoComissao;
  const custoClasse =
    custo === null
      ? ""
      : custo > LIMITE_VERMELHO
        ? "text-bad"
        : custo > LIMITE_AMARELO
          ? "text-warn"
          : "text-ok";

  const problemas = crons.filter((c) => c.atrasado || c.erro);
  const pctRealizado =
    resumo.projecaoVendido > 0
      ? Math.min((resumo.vendido / resumo.projecaoVendido) * 100, 100)
      : 0;
  const pctMesAnterior =
    resumo.projecaoVendido > 0
      ? Math.min((resumo.vendidoAnterior / resumo.projecaoVendido) * 100, 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Só aparece quando há problema — em dia normal não ocupa espaço. */}
      {problemas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-bad bg-bad/10 px-3 py-2">
          <TriangleAlert className="size-4 shrink-0 text-bad" />
          <span className="text-sm font-medium text-bad">
            {problemas.length} automação(ões) com problema
          </span>
          <span className="text-sm text-muted-foreground">
            {problemas.map((p) => p.label).join(" · ")}
          </span>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="accent-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Projeção do mês
          </p>
          <p className="num text-2xl font-semibold">{fmtMoeda(resumo.projecaoVendido)}</p>
          <p className="text-xs text-muted-foreground">
            {resumo.projecaoConfiavel
              ? `no ritmo do dia ${resumo.diaAtual} de ${resumo.diasNoMes}`
              : `estimativa grosseira — só ${resumo.diaAtual} dia(s) corridos`}
          </p>
        </div>

        <div className="accent-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Custo da comissão
          </p>
          <p className={`num text-2xl font-semibold ${custoClasse}`}>{fmtPct(custo)}</p>
          <p className="text-xs text-muted-foreground">
            limite {LIMITE_VERMELHO}%
            {resumo.custoComissaoAnterior !== null &&
              ` · mês passado ${fmtPct(resumo.custoComissaoAnterior)}`}
          </p>
        </div>

        <div className="surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Vendido até aqui
          </p>
          <p className="num text-2xl font-semibold">{fmtMoeda(resumo.vendido)}</p>
          <p className="text-xs text-muted-foreground">
            mês passado fechou {fmtMoeda(resumo.vendidoAnterior)}
          </p>
        </div>

        <div className="surface-card p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Comissão prevista
          </p>
          <p className="num text-2xl font-semibold">{fmtMoeda(resumo.projecaoBonificacao)}</p>
          <p className="text-xs text-muted-foreground">
            {fmtMoeda(resumo.bonificacao)} calculados até agora
          </p>
        </div>
      </div>

      <div className="surface-card space-y-2 p-3">
        <p className="text-sm font-medium">Ritmo do mês</p>
        <div className="relative h-6 overflow-hidden rounded bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-brand-gradient opacity-30"
            style={{ width: "100%" }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-brand-gradient"
            style={{ width: `${pctRealizado}%` }}
          />
          {resumo.vendidoAnterior > 0 && (
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground"
              style={{ left: `${pctMesAnterior}%` }}
              title="onde o mês passado fechou"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>■ realizado {fmtMoeda(resumo.vendido)}</span>
          <span>▨ projetado {fmtMoeda(resumo.projecaoVendido)}</span>
          {resumo.vendidoAnterior > 0 && (
            <span>│ mês passado {fmtMoeda(resumo.vendidoAnterior)}</span>
          )}
          <span>
            dia {resumo.diaAtual} de {resumo.diasNoMes}
          </span>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <div className="surface-card overflow-x-auto">
          <p className="border-b p-3 text-sm font-medium">Precisa de atenção</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-24 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atencao.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-ok">
                    Ninguém precisando de atenção agora.
                  </TableCell>
                </TableRow>
              )}
              {atencao.map((a, i) => {
                const { rotulo, Icone } = ACAO[a.acao];
                return (
                  <TableRow key={`${a.nome}-${i}`}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${GRAVIDADE[a.gravidade]}`}>
                        {a.motivo}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Icone className="size-3" />
                        {rotulo}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="surface-card overflow-x-auto">
          <p className="border-b p-3 text-sm font-medium">
            Equipes <span className="font-normal text-muted-foreground">— base do bônus de supervisor</span>
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipe</TableHead>
                <TableHead className="w-20 text-right">Internet</TableHead>
                <TableHead className="w-20 text-right">Meta</TableHead>
                <TableHead className="w-20 text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhuma equipe cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {equipes.map((e) => (
                <TableRow key={e.nome}>
                  <TableCell className="font-medium">
                    {e.nome}
                    <span className="ml-1 text-xs text-muted-foreground">({e.pessoas})</span>
                  </TableCell>
                  <TableCell className="text-right">{e.internet}</TableCell>
                  <TableCell className="text-right">{e.meta ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {e.percentual === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          e.percentual >= 100
                            ? "bg-ok/15 text-ok"
                            : e.percentual >= 80
                              ? "bg-warn/15 text-warn"
                              : "bg-bad/15 text-bad"
                        }`}
                      >
                        {e.percentual}%
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
