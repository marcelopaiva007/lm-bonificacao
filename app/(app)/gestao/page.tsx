import { requireCapacidade } from "@/lib/auth-guard";
import { periodoAtual, periodoLabel } from "@/lib/periodo";
import {
  consistenciaDasPessoas,
  rendimentoPorCidade,
  desembolsoPorMes,
} from "@/lib/gestao";
import { getRegraVigente, asRegraConfig } from "@/lib/bonificacao";
import { GestaoView } from "./gestao-view";

export const dynamic = "force-dynamic";

export default async function GestaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireCapacidade("VER_REGISTRO_ALTERACOES");
  const params = await searchParams;
  const periodo = /^\d{4}-\d{2}$/.test(params.periodo ?? "")
    ? (params.periodo as string)
    : periodoAtual();

  const [consistencia, cidades, desembolso, regraVendedor] = await Promise.all([
    consistenciaDasPessoas(periodo),
    rendimentoPorCidade(periodo),
    desembolsoPorMes(periodo),
    getRegraVigente("VENDEDOR_EXTERNO", periodo),
  ]);

  const config = asRegraConfig(regraVendedor?.config);
  const internet = config?.servicos?.internet;
  const chip = config?.servicos?.chip;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Gestão — {periodoLabel(periodo)}
        </h1>
        <p className="text-muted-foreground">
          O que se consulta antes de uma decisão que custa dinheiro: promover,
          desligar, abrir vaga numa cidade ou mudar a regra de comissão.
        </p>
      </div>
      <GestaoView
        periodo={periodo}
        consistencia={consistencia}
        cidades={cidades}
        desembolso={desembolso.map((d) => ({ ...d, label: periodoLabel(d.periodo) }))}
        faixasAtuais={
          internet?.tipo === "faixas"
            ? internet.faixas
            : [{ min: 20, max: 29, valor: 10 }]
        }
        metaChipAtual={
          chip?.tipo === "meta" ? { metaQtd: chip.metaQtd, valor: chip.valor } : { metaQtd: 0, valor: 0 }
        }
      />
    </div>
  );
}
