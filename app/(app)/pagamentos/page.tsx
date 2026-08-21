import { requireAdmin } from "@/lib/auth-guard";
import { listarPagamentos, resumirPagamentos } from "@/lib/pagamento";
import { periodoAtual, periodoLabel } from "@/lib/periodo";
import { prisma } from "@/lib/prisma";
import { PagamentosView } from "./pagamentos-view";

export const dynamic = "force-dynamic";

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  const periodo = /^\d{4}-\d{2}$/.test(params.periodo ?? "")
    ? (params.periodo as string)
    : periodoAtual();

  const [linhas, fechamento] = await Promise.all([
    listarPagamentos(periodo),
    prisma.fechamentoMensal.findUnique({ where: { periodo }, select: { status: true } }),
  ]);
  const resumo = resumirPagamentos(linhas);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pagamentos — {periodoLabel(periodo)}
        </h1>
        <p className="text-muted-foreground">
          Quem já recebeu a bonificação do mês, quem está para receber e quem está
          retido. Cada marcação guarda quem fez e quando.
        </p>
      </div>
      <PagamentosView
        periodo={periodo}
        linhas={linhas.map((l) => ({
          ...l,
          marcadoEm: l.marcadoEm ? l.marcadoEm.toISOString() : null,
        }))}
        resumo={resumo}
        mesFechado={fechamento?.status === "FECHADO"}
        podeMarcar={user.role === "ADMIN" || user.role === "GERENTE"}
      />
    </div>
  );
}
