import { requireContabilAccess } from "@/lib/contabil-auth-guard";
import { carregarAno, contextoContabil } from "@/lib/contabil-data";
import { podeEditarContabil } from "@/lib/contabil";
import { SemEmpresa } from "../sem-empresa";
import { ResultadoView } from "./resultado-view";

export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; ano?: string }>;
}) {
  const user = await requireContabilAccess();
  const params = await searchParams;
  const { empresas, empresaId, anos, ano } = await contextoContabil(params);

  const podeEditar = podeEditarContabil(user.role);
  if (!empresaId) return <SemEmpresa podeCadastrar={podeEditar} />;

  const { meses } = await carregarAno(empresaId, ano);

  return (
    <ResultadoView
      empresas={empresas}
      empresaId={empresaId}
      anos={anos}
      ano={ano}
      podeEditar={podeEditar}
      meses={meses.map((m) => ({
        periodo: m.periodo,
        mes: m.mes,
        competenciaId: m.competenciaId,
        faturamento: m.faturamento,
        despesas: m.despesas,
        status: m.status,
        observacoes: m.observacoes,
        impostos: m.impostos.reduce((s, i) => s + i.valor, 0),
      }))}
    />
  );
}
