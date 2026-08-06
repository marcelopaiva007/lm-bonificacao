import { requireAdmin } from "@/lib/auth-guard";
import { listarAlteracoes } from "@/lib/auditoria";
import { periodoLabel } from "@/lib/periodo";
import { RegistroView } from "./registro-view";

// Só administrador: o histórico expõe valores de bonificação de pessoas
// nomeadas, junto com quem mexeu neles.
export const dynamic = "force-dynamic";

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const periodo = /^\d{4}-\d{2}$/.test(params.periodo ?? "") ? params.periodo : undefined;

  const alteracoes = await listarAlteracoes({ periodo, limite: 300 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Registro de alterações
          {periodo && ` — ${periodoLabel(periodo)}`}
        </h1>
        <p className="text-muted-foreground">
          Tudo que mudou o valor a pagar: regra de bonificação, ajuste, lançamento
          manual, fechamento e reabertura de mês. Guardado para responder, meses
          depois, por que um valor foi o que foi.
        </p>
      </div>
      <RegistroView
        alteracoes={alteracoes.map((a) => ({
          id: a.id,
          acao: a.acao,
          usuarioNome: a.usuarioNome,
          alvo: a.alvo,
          periodo: a.periodo,
          resumo: a.resumo,
          antes: a.antes,
          depois: a.depois,
          criadoEm: a.criadoEm,
        }))}
        periodoAtual={periodo ?? null}
      />
    </div>
  );
}
