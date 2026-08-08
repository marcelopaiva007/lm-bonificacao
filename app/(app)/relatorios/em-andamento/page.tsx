import { requireUser } from "@/lib/auth-guard";
import { getVendasEmAndamento } from "@/lib/actions/vendas-em-andamento";
import { periodoAtual } from "@/lib/periodo";
import { RelatorioEmAndamentoView } from "./relatorio-em-andamento-view";

export default async function VendasEmAndamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const periodo = params.periodo ?? periodoAtual();
  const dados = await getVendasEmAndamento(periodo);

  return <RelatorioEmAndamentoView periodo={periodo} dados={dados} />;
}
