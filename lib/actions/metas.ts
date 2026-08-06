"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireCapacidade } from "@/lib/auth-guard";
import { definirMeta, removerMeta } from "@/lib/metas";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/constants";

const metaSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Período inválido"),
  alvo: z.enum(["FUNCIONARIO", "EQUIPE"]),
  alvoId: z.string().trim().min(1, "Escolha a pessoa ou equipe"),
  metaInternet: z.coerce.number().int().min(0, "Meta não pode ser negativa"),
  metaChip: z.coerce.number().int().min(0, "Meta não pode ser negativa"),
  observacao: z.string().trim().optional(),
});

export async function salvarMeta(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireCapacidade("DEFINIR_META");

  const parsed = metaSchema.safeParse({
    periodo: formData.get("periodo"),
    alvo: formData.get("alvo"),
    alvoId: formData.get("alvoId"),
    metaInternet: formData.get("metaInternet") || 0,
    metaChip: formData.get("metaChip") || 0,
    observacao: formData.get("observacao") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (parsed.data.metaInternet === 0 && parsed.data.metaChip === 0) {
    return { ok: false, error: "Defina ao menos uma meta — internet ou chip." };
  }

  // Nome resolvido aqui para o registro de alterações poder dizer de quem é a
  // meta, e não só o identificador.
  const alvoNome =
    parsed.data.alvo === "FUNCIONARIO"
      ? (await prisma.funcionario.findUnique({
          where: { id: parsed.data.alvoId },
          select: { nome: true },
        }))?.nome
      : (await prisma.equipe.findUnique({
          where: { id: parsed.data.alvoId },
          select: { nome: true },
        }))?.nome;

  if (!alvoNome) return { ok: false, error: "Pessoa ou equipe não encontrada." };

  await definirMeta({
    ...parsed.data,
    alvoNome,
    observacao: parsed.data.observacao || null,
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
  });

  revalidatePath("/metas");
  return { ok: true };
}

export async function excluirMeta(id: number): Promise<ActionResult> {
  await requireCapacidade("DEFINIR_META");
  await removerMeta(id);
  revalidatePath("/metas");
  return { ok: true };
}
