import { Info } from "lucide-react";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { RegrasView } from "./regras-view";

export default async function RegrasPage() {
  await requireAdmin();

  const regras = await prisma.regraBonificacao.findMany({
    orderBy: { vigenciaInicio: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuração"
        title="Regras de Bonificação"
        description="Faixas e valores por serviço, por equipe e papel, além do bônus de supervisor. Cada mudança cria uma nova vigência — o histórico de regras anteriores fica preservado."
      />

      <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.07] p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cada nova vigência passa a valer a partir da data informada e a regra anterior é
          encerrada — <span className="font-medium text-foreground">nada é sobrescrito</span>.
          Períodos já fechados não são recalculados automaticamente.
        </p>
      </div>

      <RegrasView regras={regras} />
    </div>
  );
}
