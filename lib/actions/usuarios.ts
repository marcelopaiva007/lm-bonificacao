"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import type { ActionResult } from "@/lib/constants";

const ROLES = ["ADMIN", "DIRETORIA"] as const;

const usuarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  username: z.string().trim().min(3, "Informe o usuário de login"),
  role: z.enum(ROLES),
});

export async function createUsuario(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 8) return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };

  const parsed = usuarioSchema.safeParse({
    nome: formData.get("nome"),
    username: formData.get("username"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const passwordHash = await bcrypt.hash(senha, 10);
  try {
    await prisma.user.create({
      data: {
        nome: parsed.data.nome,
        username: parsed.data.username,
        role: parsed.data.role,
        passwordHash,
      },
    });
  } catch {
    return { ok: false, error: "Já existe um usuário com esse login." };
  }

  revalidatePath("/cadastros/usuarios");
  return { ok: true };
}

export async function updateUsuario(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = usuarioSchema.safeParse({
    nome: formData.get("nome"),
    username: formData.get("username"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.user.update({
      where: { id },
      data: {
        nome: parsed.data.nome,
        username: parsed.data.username,
        role: parsed.data.role,
      },
    });
  } catch {
    return { ok: false, error: "Já existe um usuário com esse login." };
  }

  revalidatePath("/cadastros/usuarios");
  return { ok: true };
}

export async function deleteUsuario(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.id === id) {
    return { ok: false, error: "Você não pode excluir seu próprio usuário." };
  }
  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    return {
      ok: false,
      error: "Não é possível excluir: há lotes de importação ou outros registros vinculados a esse usuário.",
    };
  }
  revalidatePath("/cadastros/usuarios");
  return { ok: true };
}
