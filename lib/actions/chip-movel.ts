"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guard";
import {
  previewChipMovel,
  syncChipMovel,
  type LinhaChipMovel,
  type ResultadoSyncChip,
} from "@/lib/chip-movel";

export type { LinhaChipMovel };

// Dados da tela de conferência (/importar/chip) — snapshot já sincronizado.
// Retorna o erro real como dado (não lança): em produção o Next redige a
// mensagem de exceções de server action, mascarando a causa — devolvendo
// { ok:false, error } a tela consegue mostrar o motivo verdadeiro.
function isNextRedirect(e: unknown): boolean {
  return !!(
    e &&
    typeof e === "object" &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (e as { digest: string }).digest === "NEXT_NOT_FOUND")
  );
}

export async function previsualizarChipMovel(periodo: string): Promise<
  | {
      ok: true;
      linhas: LinhaChipMovel[];
      totalVendas: number;
      ultimaSync: Date | null;
    }
  | { ok: false; error: string }
> {
  try {
    // requireAdmin dentro do try: se a falha estiver na autenticação (ou em
    // qualquer passo), capturamos a mensagem real em vez de deixá-la cruzar a
    // fronteira do server action e ser redigida pelo Next.
    await requireAdmin();
    const r = await previewChipMovel(periodo);
    return { ok: true, ...r };
  } catch (e) {
    // redirect()/notFound() do Next usam `digest` e PRECISAM propagar
    // sem serem capturados pelo try-catch do cliente.
    if (isNextRedirect(e)) {
      throw e;
    }
    console.error("[chip] previsualizarChipMovel falhou:", e);
    const detalhe = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return { ok: false, error: detalhe.slice(0, 600) };
  }
}

// Botão "Sincronizar agora": mesma rotina do cron diário, sob demanda.
export async function sincronizarChipMovelAgora(
  periodo: string,
): Promise<{ ok: true; resultado: ResultadoSyncChip } | { ok: false; error: string }> {
  try {
    await requireAdmin();
  } catch (e) {
    // Se a autenticação falhou (redirect/not found), propagar sem capturar
    if (isNextRedirect(e)) {
      throw e;
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const [ano, mes] = periodo.split("-").map(Number);
  if (!ano || !mes || mes < 1 || mes > 12) {
    return { ok: false, error: "Período inválido." };
  }

  try {
    const resultado = await syncChipMovel(ano, mes);
    revalidatePath("/lancamentos");
    revalidatePath("/fechamento");
    revalidatePath("/importar/chip");
    return { ok: true, resultado };
  } catch (e) {
    if (isNextRedirect(e)) {
      throw e;
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
