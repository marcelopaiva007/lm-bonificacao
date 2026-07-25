import { requireContabilAccess } from "@/lib/contabil-auth-guard";
import { carregarAno, contextoContabil, guiasEmAberto } from "@/lib/contabil-data";
import { podeEditarContabil } from "@/lib/contabil";
import { SemEmpresa } from "./sem-empresa";
import { PainelView } from "./painel-view";

export default async function ContabilPainelPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; ano?: string }>;
}) {
  const user = await requireContabilAccess();
  const params = await searchParams;
  const { empresas, empresaId, anos, ano } = await contextoContabil(params);

  if (!empresaId) return <SemEmpresa podeCadastrar={podeEditarContabil(user.role)} />;

  const [{ linhas, meses, tipos }, guias] = await Promise.all([
    carregarAno(empresaId, ano),
    guiasEmAberto(),
  ]);

  // Total de cada tributo no ano — a linha "TOTAL" da planilha de impostos.
  const porTipo = tipos
    .map((t) => ({
      nome: t.nome,
      total: meses.reduce(
        (soma, m) => soma + (m.impostos.find((i) => i.tipoId === t.id)?.valor ?? 0),
        0,
      ),
      pago: meses.reduce(
        (soma, m) =>
          soma +
          m.impostos
            .filter((i) => i.tipoId === t.id && i.status === "PAGO")
            .reduce((s, i) => s + (i.valorPago ?? i.valor), 0),
        0,
      ),
    }))
    .filter((t) => t.total !== 0);

  const empresaNome = empresas.find((e) => e.id === empresaId)?.nome ?? "";

  return (
    <PainelView
      empresas={empresas}
      empresaId={empresaId}
      empresaNome={empresaNome}
      anos={anos}
      ano={ano}
      linhas={linhas}
      porTipo={porTipo}
      guias={guias.map((g) => ({ ...g, vencimento: g.vencimento?.toISOString() ?? null }))}
    />
  );
}
