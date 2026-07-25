import { requireContabilAccess } from "@/lib/contabil-auth-guard";
import { carregarAno, contextoContabil } from "@/lib/contabil-data";
import { podeEditarContabil } from "@/lib/contabil";
import { SemEmpresa } from "../sem-empresa";
import { FechamentoView } from "./fechamento-view";

export default async function FechamentoContabilPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; ano?: string }>;
}) {
  const user = await requireContabilAccess();
  const params = await searchParams;
  const { empresas, empresaId, anos, ano } = await contextoContabil(params);

  const podeEditar = podeEditarContabil(user.role);
  if (!empresaId) return <SemEmpresa podeCadastrar={podeEditar} />;

  const { meses, linhas } = await carregarAno(empresaId, ano);
  const porPeriodo = new Map(linhas.map((l) => [l.periodo, l]));

  return (
    <FechamentoView
      empresas={empresas}
      empresaId={empresaId}
      anos={anos}
      ano={ano}
      podeEditar={podeEditar}
      podeReabrir={user.role === "ADMIN"}
      meses={meses.map((m) => {
        const linha = porPeriodo.get(m.periodo)!;
        return {
          periodo: m.periodo,
          mes: m.mes,
          temLancamento: m.competenciaId !== null,
          faturamento: m.faturamento,
          despesas: m.despesas,
          lucro: linha.lucro,
          impostos: linha.impostos,
          impostosPendentes: linha.impostosPendentes,
          status: m.status,
          fechadaEm: m.fechadaEm?.toISOString() ?? null,
          fechadaPor: m.fechadaPor,
        };
      })}
    />
  );
}
