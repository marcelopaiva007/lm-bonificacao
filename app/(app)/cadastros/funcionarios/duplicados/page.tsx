import { requireAdmin } from "@/lib/auth-guard";
import { listarSuspeitasDeDuplicidade } from "@/lib/duplicados";
import { DuplicadosView } from "./duplicados-view";

export const dynamic = "force-dynamic";

// Cadastros duplicados: o sistema aponta a suspeita (nome idêntico ou parecido —
// erro de digitação, abreviação, um nome contido no outro — ou mesmo CPF) e a
// unificação só acontece com confirmação humana (decisão da diretoria, 08/08/2026).
export default async function DuplicadosPage() {
  await requireAdmin();
  const grupos = await listarSuspeitasDeDuplicidade();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Funcionários — possíveis duplicados</h1>
        <p className="text-sm text-muted-foreground">
          Fichas ativas que parecem a mesma pessoa — por nome idêntico, grafia parecida (erro de
          digitação ou abreviação), um nome contido no outro, ou mesmo CPF. Unificar move os
          lançamentos dos meses abertos para a ficha mantida e desativa a duplicada; meses fechados
          ficam exatamente como foram pagos. Tudo vai para o Registro de Alterações.
        </p>
      </div>
      <DuplicadosView grupos={grupos} />
    </div>
  );
}
