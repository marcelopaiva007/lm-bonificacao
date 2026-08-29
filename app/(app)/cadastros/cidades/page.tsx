import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { CidadesTable } from "./cidades-table";

export default async function CidadesPage() {
  await requireAdmin();

  const cidades = await prisma.cidade.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { funcionarios: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cadastros"
        title="Cidades"
        description="Cidades atendidas pela LM Telecom. Cadastre uma vez, use em todos os meses."
      />
      <CidadesTable cidades={cidades} />
    </div>
  );
}
