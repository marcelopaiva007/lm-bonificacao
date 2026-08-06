"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidade } from "@/lib/auth-guard";
import { marcarPagamento, type SituacaoPagamento } from "@/lib/pagamento";
import type { ActionResult } from "@/lib/constants";

const SITUACOES: SituacaoPagamento[] = ["A_PAGAR", "PAGO", "RETIDO"];

export async function marcarSituacaoPagamento(
  periodo: string,
  funcionarioId: string,
  situacao: string,
  observacao?: string,
): Promise<ActionResult> {
  const user = await requireCapacidade("MARCAR_PAGAMENTO");

  if (!SITUACOES.includes(situacao as SituacaoPagamento)) {
    return { ok: false, error: "Situação inválida." };
  }
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return { ok: false, error: "Período inválido." };
  }
  // Reter é decisão consciente e precisa de motivo — sem isso ninguém consegue
  // explicar, meses depois, por que aquela pessoa não recebeu.
  if (situacao === "RETIDO" && !observacao?.trim()) {
    return { ok: false, error: "Para reter um pagamento, escreva o motivo." };
  }

  await marcarPagamento({
    periodo,
    funcionarioId,
    situacao: situacao as SituacaoPagamento,
    observacao: observacao?.trim() || null,
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
  });

  revalidatePath(`/fechamento/${periodo}`);
  revalidatePath("/pagamentos");
  return { ok: true };
}
