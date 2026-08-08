"use server";

import { revalidatePath } from "next/cache";
import { requireCapacidade } from "@/lib/auth-guard";
import { unificarFuncionarios } from "@/lib/duplicados";
import type { ActionResult } from "@/lib/constants";

// Unificação de cadastros duplicados — sempre por confirmação humana
// (decisão da diretoria, 08/08/2026). A tela aponta; quem clica decide.
export async function unificarFuncionariosAction(
  manterId: string,
  removerId: string,
): Promise<ActionResult & { detalhe?: string }> {
  const user = await requireCapacidade("EDITAR_CADASTRO");
  try {
    const r = await unificarFuncionarios({
      manterId,
      removerId,
      usuarioId: user.id,
      usuarioNome: user.name ?? user.username,
    });
    revalidatePath("/cadastros/funcionarios/duplicados");
    revalidatePath("/cadastros/funcionarios");
    return {
      ok: true,
      detalhe:
        `${r.lancamentosMovidos} lançamento(s) movido(s)` +
        (r.periodosRecalculados.length
          ? `; recalculado: ${r.periodosRecalculados.join(", ")}`
          : "") +
        (r.periodosFechadosPreservados.length
          ? `; meses fechados preservados: ${r.periodosFechadosPreservados.join(", ")}`
          : ""),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
