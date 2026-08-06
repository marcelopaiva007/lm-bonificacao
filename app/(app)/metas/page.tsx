import { requireUser } from "@/lib/auth-guard";
import { idsVisiveisPara } from "@/lib/escopo";
import { periodoAtual } from "@/lib/periodo";
import { carregarAcompanhamento } from "@/lib/acompanhamento-data";
import { MetasView } from "./metas-view";
import { MetasDefinidasView } from "./metas-definidas-view";
import { listarMetas, progressoDasMetas } from "@/lib/metas";
import { pode } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const user = await requireUser();
  const { periodo: periodoParam } = await searchParams;
  const periodo = periodoParam?.match(/^\d{4}-\d{2}$/) ? periodoParam : periodoAtual();

  // Supervisor acompanha a própria equipe; vendedor, só ele.
  const [acompanhamentos, progresso, metas, funcionarios, equipes] = await Promise.all([
    carregarAcompanhamento(periodo, await idsVisiveisPara(user)),
    progressoDasMetas(periodo),
    listarMetas(periodo),
    prisma.funcionario.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.equipe.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Acompanhamento de Metas</h1>
        <p className="text-muted-foreground">
          Progresso de cada vendedor, supervisor e gestor em relação à meta do mês,
          com um feedback do que falta para subir de faixa. Base: as vendas já
          sincronizadas e as Regras de Bonificação vigentes.
        </p>
      </div>
      <MetasDefinidasView
        periodo={periodo}
        progresso={progresso}
        metas={metas.map((m) => ({ id: m.id, alvoNome: m.alvoNome, alvo: m.alvo }))}
        funcionarios={funcionarios}
        equipes={equipes}
        podeEditar={pode(user.role, "DEFINIR_META")}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Faixas da bonificação</h2>
        <MetasView acompanhamentos={acompanhamentos} periodo={periodo} />
      </div>
    </div>
  );
}
