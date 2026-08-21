"use client";

import { useState, useTransition } from "react";
import { TrendingUp, TrendingDown, Minus, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { simular, type RespostaSimulacao } from "@/lib/actions/simulacao";

type Consistencia = {
  nome: string;
  serie: number[];
  mediaMes: number;
  mesesComVenda: number;
  totalMeses: number;
  tendencia: "subindo" | "caindo" | "estavel";
};

type Cidade = {
  cidade: string;
  vendedores: number;
  vendido: number;
  porVendedor: number;
  custoComissao: number | null;
};

type Desembolso = {
  periodo: string;
  label: string;
  vendido: number;
  comissao: number;
  percentual: number | null;
};

type Faixa = { min: number; max: number | null; valor: number };

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);

const LIMITE_VERMELHO = 25;
const LIMITE_AMARELO = 23;

function classeCusto(v: number | null) {
  if (v === null) return "text-muted-foreground";
  if (v > LIMITE_VERMELHO) return "text-bad";
  if (v > LIMITE_AMARELO) return "text-warn";
  return "text-ok";
}

const TENDENCIA = {
  subindo: { Icone: TrendingUp, classe: "text-ok", rotulo: "subindo" },
  caindo: { Icone: TrendingDown, classe: "text-bad", rotulo: "caindo" },
  estavel: { Icone: Minus, classe: "text-muted-foreground", rotulo: "estável" },
} as const;

function Sparkline({ serie }: { serie: number[] }) {
  const max = Math.max(...serie, 1);
  return (
    <span className="inline-flex h-6 items-end gap-0.5" aria-hidden>
      {serie.map((v, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-t bg-brand ${i === serie.length - 1 ? "" : "opacity-50"}`}
          style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
        />
      ))}
    </span>
  );
}

export function GestaoView({
  periodo,
  consistencia,
  cidades,
  desembolso,
  faixasAtuais,
  metaChipAtual,
}: {
  periodo: string;
  consistencia: Consistencia[];
  cidades: Cidade[];
  desembolso: Desembolso[];
  faixasAtuais: Faixa[];
  metaChipAtual: { metaQtd: number; valor: number };
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-medium">
          Consistência das pessoas{" "}
          <span className="text-sm font-normal text-muted-foreground">
            — quem sustenta resultado, não quem teve um mês bom
          </span>
        </h2>
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="w-28">6 meses</TableHead>
                <TableHead className="w-28 text-right">Meses com venda</TableHead>
                <TableHead className="w-32 text-right">Média/mês</TableHead>
                <TableHead className="w-28 text-right">Tendência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consistencia.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Sem histórico suficiente ainda.
                  </TableCell>
                </TableRow>
              )}
              {consistencia.map((c) => {
                const t = TENDENCIA[c.tendencia];
                return (
                  <TableRow key={c.nome}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>
                      <Sparkline serie={c.serie} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          c.mesesComVenda === c.totalMeses
                            ? "bg-ok/15 text-ok"
                            : c.mesesComVenda >= c.totalMeses / 2
                              ? "bg-warn/15 text-warn"
                              : "bg-bad/15 text-bad"
                        }`}
                      >
                        {c.mesesComVenda} de {c.totalMeses}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{fmtMoeda(c.mediaMes)}</TableCell>
                    <TableCell className={`text-right ${t.classe}`}>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <t.Icone className="size-3.5" />
                        {t.rotulo}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-lg font-medium">
            Cidades{" "}
            <span className="text-sm font-normal text-muted-foreground">
              — rendimento por vendedor
            </span>
          </h2>
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="w-16 text-right">Vend.</TableHead>
                  <TableHead className="w-32 text-right">Por vendedor</TableHead>
                  <TableHead className="w-24 text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cidades.map((c) => (
                  <TableRow key={c.cidade}>
                    <TableCell className="font-medium">{c.cidade}</TableCell>
                    <TableCell className="text-right">{c.vendedores}</TableCell>
                    <TableCell className="text-right">{fmtMoeda(c.porVendedor)}</TableCell>
                    <TableCell className={`text-right ${classeCusto(c.custoComissao)}`}>
                      {fmtPct(c.custoComissao)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            O total sempre elege a cidade maior. Dividido por cabeça, aparece onde a
            próxima vaga rende mais.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Desembolso por mês</h2>
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="w-28 text-right">Vendido</TableHead>
                  <TableHead className="w-28 text-right">Comissão</TableHead>
                  <TableHead className="w-20 text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desembolso.map((d) => (
                  <TableRow key={d.periodo}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-right">{fmtMoeda(d.vendido)}</TableCell>
                    <TableCell className="text-right">{fmtMoeda(d.comissao)}</TableCell>
                    <TableCell className={`text-right font-medium ${classeCusto(d.percentual)}`}>
                      {fmtPct(d.percentual)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            A coluna de percentual é o alarme: o total sobe junto com as vendas, o
            percentual diz se a comissão está ficando mais cara.
          </p>
        </section>
      </div>

      <Simulador periodo={periodo} faixasAtuais={faixasAtuais} metaChipAtual={metaChipAtual} />
    </div>
  );
}

function Simulador({
  periodo,
  faixasAtuais,
  metaChipAtual,
}: {
  periodo: string;
  faixasAtuais: Faixa[];
  metaChipAtual: { metaQtd: number; valor: number };
}) {
  const [faixas, setFaixas] = useState<Faixa[]>(faixasAtuais);
  const [metaChip, setMetaChip] = useState(metaChipAtual);
  const [resposta, setResposta] = useState<RespostaSimulacao | null>(null);
  const [rodando, iniciar] = useTransition();

  function rodar() {
    iniciar(async () => {
      const r = await simular({
        periodo,
        cargo: "VENDEDOR_EXTERNO",
        faixas,
        metaChipQtd: metaChip.metaQtd,
        metaChipValor: metaChip.valor,
      });
      setResposta(r);
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">
        Simulador de regra{" "}
        <span className="text-sm font-normal text-muted-foreground">— testa antes de valer</span>
      </h2>
      <div className="accent-card space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Aplica uma regra hipotética sobre as vendas de <strong>{periodo}</strong> e
          mostra o que teria custado. <strong>Nada é gravado.</strong>
        </p>

        <div className="space-y-2">
          <Label>Faixas de internet (R$ por venda)</Label>
          {faixas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">de</span>
              <Input
                type="number"
                className="w-20"
                value={f.min}
                onChange={(e) =>
                  setFaixas((ant) =>
                    ant.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)),
                  )
                }
              />
              <span className="text-muted-foreground">a</span>
              <Input
                type="number"
                className="w-20"
                value={f.max ?? ""}
                placeholder="∞"
                onChange={(e) =>
                  setFaixas((ant) =>
                    ant.map((x, j) =>
                      j === i
                        ? { ...x, max: e.target.value === "" ? null : Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
              <span className="text-muted-foreground">vendas →</span>
              <Input
                type="number"
                className="w-24"
                value={f.valor}
                onChange={(e) =>
                  setFaixas((ant) =>
                    ant.map((x, j) => (j === i ? { ...x, valor: Number(e.target.value) } : x)),
                  )
                }
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="metaQtd">Meta de chip</Label>
            <Input
              id="metaQtd"
              type="number"
              className="w-24"
              value={metaChip.metaQtd}
              onChange={(e) => setMetaChip((m) => ({ ...m, metaQtd: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="metaValor">R$ por chip</Label>
            <Input
              id="metaValor"
              type="number"
              className="w-24"
              value={metaChip.valor}
              onChange={(e) => setMetaChip((m) => ({ ...m, valor: Number(e.target.value) }))}
            />
          </div>
          <Button onClick={rodar} disabled={rodando}>
            <FlaskConical className="size-4" />
            {rodando ? "Simulando..." : "Simular"}
          </Button>
        </div>

        {resposta && !resposta.ok && (
          <p className="text-sm text-bad">{resposta.error}</p>
        )}

        {resposta?.ok && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cenário</TableHead>
                  <TableHead className="w-32 text-right">Teria custado</TableHead>
                  <TableHead className="w-24 text-right">Custo</TableHead>
                  <TableHead className="w-32 text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Regra atual</TableCell>
                  <TableCell className="text-right">
                    {fmtMoeda(resposta.resultado.comissaoAtual)}
                  </TableCell>
                  <TableCell className={`text-right ${classeCusto(resposta.resultado.custoAtual)}`}>
                    {fmtPct(resposta.resultado.custoAtual)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Regra simulada</TableCell>
                  <TableCell className="text-right font-medium">
                    {fmtMoeda(resposta.resultado.comissaoSimulada)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${classeCusto(resposta.resultado.custoSimulado)}`}
                  >
                    {fmtPct(resposta.resultado.custoSimulado)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      resposta.resultado.diferenca > 0 ? "text-bad" : "text-ok"
                    }`}
                  >
                    {resposta.resultado.diferenca > 0 ? "+" : ""}
                    {fmtMoeda(resposta.resultado.diferenca)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="p-2 text-xs text-muted-foreground">
              {resposta.resultado.pessoasQueGanhamMais} pessoa(s) ganhariam mais ·{" "}
              {resposta.resultado.pessoasQueGanhamMenos} ganhariam menos.
              {resposta.resultado.custoSimulado !== null &&
                resposta.resultado.custoSimulado > LIMITE_VERMELHO &&
                " ⚠ Esta regra passa do limite de 25%."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
