"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { PAPEIS } from "@/lib/permissoes";
import { escopoDoPapel } from "@/lib/permissoes";
import { vincularUsuarioAFuncionario } from "@/lib/escopo";
import type { ActionResult } from "@/lib/constants";

const usuarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  username: z.string().trim().min(3, "Informe o usuário de login"),
  role: z.enum(PAPEIS),
  // Quem esta pessoa é no cadastro de vendas. Obrigatório para supervisor e
  // vendedor: sem isso não há como saber qual equipe é "a dela", e o sistema
  // não mostraria nada — o que pareceria erro em vez de configuração faltando.
  funcionarioId: z.string().trim().optional(),
});

function exigeVinculo(role: string): boolean {
  return escopoDoPapel(role) !== "TUDO";
}

export async function createUsuario(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 8) return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };

  const parsed = usuarioSchema.safeParse({
    nome: formData.get("nome"),
    username: formData.get("username"),
    role: formData.get("role"),
    funcionarioId: formData.get("funcionarioId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (exigeVinculo(parsed.data.role) && !parsed.data.funcionarioId) {
    return {
      ok: false,
      error:
        "Supervisor e vendedor precisam ser vinculados a um funcionário — é assim que o sistema sabe o que essa pessoa pode ver.",
    };
  }

  const passwordHash = await bcrypt.hash(senha, 10);
  try {
    const novo = await prisma.user.create({
      data: {
        nome: parsed.data.nome,
        username: parsed.data.username,
        role: parsed.data.role,
        passwordHash,
      },
    });
    await vincularUsuarioAFuncionario(novo.id, parsed.data.funcionarioId ?? null);
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
    funcionarioId: formData.get("funcionarioId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (exigeVinculo(parsed.data.role) && !parsed.data.funcionarioId) {
    return {
      ok: false,
      error:
        "Supervisor e vendedor precisam ser vinculados a um funcionário — é assim que o sistema sabe o que essa pessoa pode ver.",
    };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        nome: parsed.data.nome,
        username: parsed.data.username,
        role: parsed.data.role,
      },
    });
    await vincularUsuarioAFuncionario(id, parsed.data.funcionarioId ?? null);
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
