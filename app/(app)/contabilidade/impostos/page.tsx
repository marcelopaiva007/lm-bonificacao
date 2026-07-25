import { requireContabilAccess } from "@/lib/contabil-auth-guard";
import { carregarAno, contextoContabil } from "@/lib/contabil-data";
import { podeEditarContabil } from "@/lib/contabil";
import { SemEmpresa } from "../sem-empresa";
import { ImpostosView } from "./impostos-view";

export default async function ImpostosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; ano?: string }>;
}) {
  const user = await requireContabilAccess();
  const params = await searchParams;
  const { empresas, empresaId, anos, ano } = await contextoContabil(params);

  const podeEditar = podeEditarContabil(user.role);
  if (!empresaId) return <SemEmpresa podeCadastrar={podeEditar} />;

  const { meses, tipos } = await carregarAno(empresaId, ano);
  const empresaNome = empresas.find((e) => e.id === empresaId)?.nome ?? "";

  return (
    <ImpostosView
      empresas={empresas}
      empresaId={empresaId}
      empresaNome={empresaNome}
      anos={anos}
      ano={ano}
      podeEditar={podeEditar}
      tipos={tipos.filter((t) => t.ativo).map((t) => ({ id: t.id, nome: t.nome }))}
      meses={meses.map((m) => ({
        periodo: m.periodo,
        mes: m.mes,
        status: m.status,
        impostos: m.impostos.map((i) => ({
          id: i.id,
          tipoId: i.tipoId,
          valor: i.valor,
          status: i.status,
          vencimento: i.vencimento?.toISOString() ?? null,
          dataPagamento: i.dataPagamento?.toISOString() ?? null,
          valorPago: i.valorPago,
          documento: i.documento,
          observacoes: i.observacoes,
        })),
      }))}
    />
  );
}
