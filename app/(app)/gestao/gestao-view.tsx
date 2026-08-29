"use client";

import { useState, useTransition } from "react";
import { TrendingUp, TrendingDown, Minus, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartCard } from "@/components/ui/chart-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Sparkline } from "@/components/ui/sparkline";
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
  subindo: { Icone: TrendingUp, classe: "text-ok", rotulo: "subindo", tone: "success" },
  caindo: { Icone: TrendingDown, classe: "text-bad", rotulo: "caindo", tone: "destructive" },
  estavel: { Icone: Minus, classe: "text-muted-foreground", rotulo: "estável", tone: "primary" },
} as const;

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
  const colsConsistencia: Column<Consistencia>[] = [
    { key: "nome", header: "Vendedor", cell: (c) => <span className="font-medium">{c.nome}</span> },
    {
      key: "serie",
      header: "6 meses",
      width: "132px",
      cell: (c) => (
        <div className="w-28">
          <Sparkline data={c.serie} tone={TENDENCIA[c.tendencia].tone} />
        </div>
      ),
    },
    {
      key: "meses",
      header: "Meses com venda",
      align: "center",
      width: "128px",
      cell: (c) => (
        <span
          className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${
            c.mesesComVenda === c.totalMeses
              ? "bg-ok/15 text-ok"
              : c.mesesComVenda >= c.totalMeses / 2
                ? "bg-warn/15 text-warn"
                : "bg-bad/15 text-bad"
          }`}
        >
          {c.mesesComVenda} de {c.totalMeses}
        </span>
      ),
    },
    {
      key: "media",
      header: "Média/mês",
      align: "right",
      width: "128px",
      cell: (c) => fmtMoeda(c.mediaMes),
    },
    {
      key: "tendencia",
      header: "Tendência",
      align: "center",
      width: "120px",
      cell: (c) => {
        const t = TENDENCIA[c.tendencia];
        return (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.classe}`}>
            <t.Icone className="size-3.5" />
            {t.rotulo}
          </span>
        );
      },
    },
  ];

  const colsCidades: Column<Cidade>[] = [
    { key: "cidade", header: "Cidade", cell: (c) => <span className="font-medium">{c.cidade}</span> },
    { key: "vend", header: "Vend.", align: "right", width: "64px", cell: (c) => c.vendedores },
    {
      key: "porVend",
      header: "Por vendedor",
      align: "right",
      width: "128px",
      cell: (c) => fmtMoeda(c.porVendedor),
    },
    {
      key: "custo",
      header: "Custo",
      align: "right",
      width: "88px",
      cell: (c) => <span className={classeCusto(c.custoComissao)}>{fmtPct(c.custoComissao)}</span>,
    },
  ];

  const colsDesembolso: Column<Desembolso>[] = [
    { key: "mes", header: "Mês", cell: (d) => <span className="font-medium">{d.label}</span> },
    { key: "vendido", header: "Vendido", align: "right", width: "112px", cell: (d) => fmtMoeda(d.vendido) },
    {
      key: "comissao",
      header: "Comissão",
      align: "right",
      width: "112px",
      cell: (d) => fmtMoeda(d.comissao),
    },
    {
      key: "pct",
      header: "%",
      align: "right",
      width: "76px",
      cell: (d) => (
        <span className={`font-medium ${classeCusto(d.percentual)}`}>{fmtPct(d.percentual)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <ChartCard
        title="Consistência das pessoas"
        subtitle="Quem sustenta resultado, não quem teve um mês bom"
        className="p-0 [&>div]:p-0"
      >
        <DataTable
          columns={colsConsistencia}
          rows={consistencia}
          rowKey={(c) => c.nome}
          minWidth="620px"
          emptyTitle="Sem histórico suficiente ainda"
          emptyHint="Assim que houver alguns meses de vendas, a consistência de cada pessoa aparece aqui."
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Cidades"
          subtitle="Rendimento por vendedor"
          className="p-0 [&>div]:p-0"
        >
          <DataTable
            columns={colsCidades}
            rows={cidades}
            rowKey={(c) => c.cidade}
            minWidth="420px"
            emptyTitle="Sem cidades no período"
          />
          <p className="px-5 py-3 text-xs text-muted-foreground">
            O total sempre elege a cidade maior. Dividido por cabeça, aparece onde a próxima
            vaga rende mais.
          </p>
        </ChartCard>

        <ChartCard
          title="Desembolso por mês"
          subtitle="O percentual é o alarme do custo"
          className="p-0 [&>div]:p-0"
        >
          <DataTable
            columns={colsDesembolso}
            rows={desembolso}
            rowKey={(d) => d.periodo}
            minWidth="420px"
            emptyTitle="Sem desembolso no período"
          />
          <p className="px-5 py-3 text-xs text-muted-foreground">
            O total sobe junto com as vendas; o percentual diz se a comissão está ficando
            mais cara.
          </p>
        </ChartCard>
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
    <ChartCard
      title="Simulador de regra"
      subtitle="Testa uma regra hipotética antes de valer — nada é gravado"
      className="ring-1 ring-accent/30"
      actions={<FlaskConical className="size-4 text-accent" />}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Aplica uma regra hipotética sobre as vendas de <strong>{periodo}</strong> e mostra o
          que teria custado. <strong>Nada é gravado.</strong>
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

        {resposta && !resposta.ok && <p className="text-sm text-bad">{resposta.error}</p>}

        {resposta?.ok && (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full border-collapse text-sm" style={{ minWidth: "520px" }}>
              <thead>
                <tr className="bg-elevated/90">
                  <th className="border-b border-border px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    Cenário
                  </th>
                  <th className="border-b border-border px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    Teria custado
                  </th>
                  <th className="border-b border-border px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    Custo
                  </th>
                  <th className="border-b border-border px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                    Diferença
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <td className="px-4 py-2.5">Regra atual</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {fmtMoeda(resposta.resultado.comissaoAtual)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono tabular-nums ${classeCusto(resposta.resultado.custoAtual)}`}
                  >
                    {fmtPct(resposta.resultado.custoAtual)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">Regra simulada</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium tabular-nums">
                    {fmtMoeda(resposta.resultado.comissaoSimulada)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums ${classeCusto(resposta.resultado.custoSimulado)}`}
                  >
                    {fmtPct(resposta.resultado.custoSimulado)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums ${
                      resposta.resultado.diferenca > 0 ? "text-bad" : "text-ok"
                    }`}
                  >
                    {resposta.resultado.diferenca > 0 ? "+" : ""}
                    {fmtMoeda(resposta.resultado.diferenca)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="px-4 py-2.5 text-xs text-muted-foreground">
              {resposta.resultado.pessoasQueGanhamMais} pessoa(s) ganhariam mais ·{" "}
              {resposta.resultado.pessoasQueGanhamMenos} ganhariam menos.
              {resposta.resultado.custoSimulado !== null &&
                resposta.resultado.custoSimulado > LIMITE_VERMELHO &&
                " ⚠ Esta regra passa do limite de 25%."}
            </p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
