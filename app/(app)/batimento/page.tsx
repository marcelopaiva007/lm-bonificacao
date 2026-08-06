import { requireCapacidade } from "@/lib/auth-guard";
import { mudancasDesdeOntem } from "@/lib/retrato-vendas";
import { periodoAtual, periodoLabel } from "@/lib/periodo";
import { BatimentoView } from "./batimento-view";

export const dynamic = "force-dynamic";

export default async function BatimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireCapacidade("VER_REGISTRO_ALTERACOES");
  const params = await searchParams;
  const periodo = /^\d{4}-\d{2}$/.test(params.periodo ?? "")
    ? (params.periodo as string)
    : periodoAtual();

  const { diaAtual, diaAnterior, mudancas } = await mudancasDesdeOntem(periodo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Batimento — {periodoLabel(periodo)}
        </h1>
        <p className="text-muted-foreground">
          O que mudou nas vendas de uma sincronização para a outra. O sync regrava
          o mês inteiro a cada rodada, então uma venda pode sair do relatório sem
          ninguém perceber — é isso que esta tela mostra.
        </p>
      </div>
      <BatimentoView
        periodo={periodo}
        diaAtual={diaAtual}
        diaAnterior={diaAnterior}
        mudancas={mudancas}
      />
    </div>
  );
}
