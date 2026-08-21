import { requireAdmin } from "@/lib/auth-guard";
import { listarSuspeitasDeDuplicidade } from "@/lib/duplicados";
import { DuplicadosView } from "./duplicados-view";

export const dynamic = "force-dynamic";

// Cadastros duplicados: o sistema aponta a suspeita, a unificação só acontece
// com confirmação humana (decisão da diretoria, 08/08/2026). Mesma chave de
// nome da auditoria semanal — o alerta e esta lista são o mesmo universo.
export default async function DuplicadosPage() {
  await requireAdmin();
  const grupos = await listarSuspeitasDeDuplicidade();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Funcionários — possíveis duplicados</h1>
        <p className="text-sm text-muted-foreground">
          Fichas ativas cujo nome normalizado coincide. Unificar move os lançamentos dos meses
          abertos para a ficha mantida e desativa a duplicada; meses fechados ficam exatamente como
          foram pagos. Tudo vai para o Registro de Alterações.
        </p>
      </div>
      <DuplicadosView grupos={grupos} />
    </div>
  );
}
