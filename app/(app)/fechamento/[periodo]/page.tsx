import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { idsVisiveisPara, filtroPorEscopo } from "@/lib/escopo";
import { prisma } from "@/lib/prisma";
import { periodoLabel } from "@/lib/periodo";
import { FechamentoDetailView } from "./fechamento-detail-view";

export default async function FechamentoDetailPage({
  params,
}: {
  params: Promise<{ periodo: string }>;
}) {
  const user = await requireUser();
  const { periodo } = await params;

  if (!/^\d{4}-\d{2}$/.test(periodo)) notFound();

  // Esta é a tela que mostra quanto cada pessoa vai receber. Sem o recorte
  // abaixo, um supervisor abria aqui e lia o bônus de todos os colegas.
  // `null` = vê tudo (diretoria, gerente, administrador).
  const idsVisiveis = await idsVisiveisPara(user);
  const filtroFuncionario = filtroPorEscopo(idsVisiveis);

  const [fechamento, funcionarios] = await Promise.all([
    prisma.fechamentoMensal.findUnique({
      where: { periodo },
      include: {
        bonificacoes: {
          where: filtroFuncionario,
          include: { funcionario: { include: { cidade: true } } },
          orderBy: { valorTotal: "desc" },
        },
        ajustes: {
          where: filtroFuncionario,
          include: { funcionario: true },
          orderBy: { createdAt: "desc" },
        },
        fechadoPor: true,
      },
    }),
    prisma.funcionario.findMany({
      where: {
        ativo: true,
        ...(idsVisiveis === null ? {} : { id: { in: idsVisiveis } }),
      },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Fechamento — {periodoLabel(periodo)}
        </h1>
        <p className="text-muted-foreground">
          Bonificação calculada automaticamente a partir dos lançamentos do mês.
        </p>
      </div>
      <FechamentoDetailView
        periodo={periodo}
        fechamento={fechamento}
        funcionarios={funcionarios}
        role={user.role}
      />
    </div>
  );
}
