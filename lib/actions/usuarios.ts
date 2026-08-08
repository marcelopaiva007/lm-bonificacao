"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { ensureAuthAndUserSchema } from "@/lib/ensure-schema";
import { registrarAuditoria } from "@/lib/auditoria";
import type { ActionResult } from "@/lib/constants";

const ROLES = ["ADMIN", "DIRETORIA", "RH_MANAGER", "GESTOR_SETOR"] as const;

const usuarioSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome"),
    username: z.string().trim().min(3, "Informe o usuário de login"),
    email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
    cpf: z.string().trim().optional().or(z.literal("")),
    role: z.enum(ROLES),
    empresaId: z.string().trim().optional(),
    setorId: z.string().trim().optional(),
  })
  .refine((data) => data.role !== "RH_MANAGER" || !!data.empresaId, {
    message: "Selecione a empresa do gestor de RH",
    path: ["empresaId"],
  })
  .refine((data) => data.role !== "GESTOR_SETOR" || !!data.empresaId, {
    message: "Selecione a empresa do gestor de setor",
    path: ["empresaId"],
  })
  .refine((data) => data.role !== "GESTOR_SETOR" || !!data.setorId, {
    message: "Selecione o setor do gestor",
    path: ["setorId"],
  });

function escopoPorRole(data: z.infer<typeof usuarioSchema>) {
  if (data.role === "RH_MANAGER") return { empresaId: data.empresaId!, setorId: null };
  if (data.role === "GESTOR_SETOR") return { empresaId: data.empresaId!, setorId: data.setorId! };
  return { empresaId: null, setorId: null };
}

export async function createUsuario(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  await ensureAuthAndUserSchema();

  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 8) return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };

  const parsed = usuarioSchema.safeParse({
    nome: formData.get("nome"),
    username: formData.get("username"),
    email: formData.get("email") || undefined,
    cpf: formData.get("cpf") || undefined,
    role: formData.get("role"),
    empresaId: formData.get("empresaId") || undefined,
    setorId: formData.get("setorId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const passwordHash = await bcrypt.hash(senha, 10);
  try {
    const novoUsuario = await prisma.user.create({
      data: {
        nome: parsed.data.nome,
        username: parsed.data.username,
        email: parsed.data.email || null,
        cpf: parsed.data.cpf || null,
        role: parsed.data.role,
        passwordHash,
        ativo: true,
        mustChangePassword: true,
        ...escopoPorRole(parsed.data),
      },
    });

    await registrarAuditoria({
      acao: "CRIAR",
      modulo: "USUARIOS",
      detalhes: `Novo usuário ${parsed.data.username} (${parsed.data.nome}) criado por ${admin.name}`,
      metadata: { novoUsuarioId: novoUsuario.id, role: parsed.data.role },
    });
  } catch {
    return { ok: false, error: "Já existe um usuário com esse login ou e-mail." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function updateUsuario(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  await ensureAuthAndUserSchema();

  const parsed = usuarioSchema.safeParse({
    nome: formData.get("nome"),
    username: formData.get("username"),
    email: formData.get("email") || undefined,
    cpf: formData.get("cpf") || undefined,
    role: formData.get("role"),
    empresaId: formData.get("empresaId") || undefined,
    setorId: formData.get("setorId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.user.update({
      where: { id },
      data: {
        nome: parsed.data.nome,
        username: parsed.data.username,
        email: parsed.data.email || null,
        cpf: parsed.data.cpf || null,
        role: parsed.data.role,
        ...escopoPorRole(parsed.data),
      },
    });

    await registrarAuditoria({
      acao: "EDITAR",
      modulo: "USUARIOS",
      detalhes: `Usuário ${parsed.data.username} atualizado por ${admin.name}`,
      metadata: { usuarioId: id, role: parsed.data.role },
    });
  } catch {
    return { ok: false, error: "Já existe um usuário com esse login ou e-mail." };
  }

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function toggleUsuarioAtivo(id: string, ativo: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  await ensureAuthAndUserSchema();

  if (admin.id === id) {
    return { ok: false, error: "Você não pode desativar seu próprio usuário." };
  }

  await prisma.user.update({
    where: { id },
    data: { ativo },
  });

  await registrarAuditoria({
    acao: "EDITAR",
    modulo: "USUARIOS",
    detalhes: `Usuário ID ${id} ${ativo ? "ativado" : "desativado"} por ${admin.name}`,
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function resetSenhaUsuario(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  await ensureAuthAndUserSchema();

  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 8) return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };

  const passwordHash = await bcrypt.hash(senha, 10);
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  await registrarAuditoria({
    acao: "EDITAR",
    modulo: "USUARIOS",
    detalhes: `Senha do usuário ID ${id} redefinida pelo admin ${admin.name}`,
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function deleteUsuario(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await ensureAuthAndUserSchema();

  if (admin.id === id) {
    return { ok: false, error: "Você não pode excluir seu próprio usuário." };
  }
  try {
    await prisma.user.delete({ where: { id } });
    await registrarAuditoria({
      acao: "EXCLUIR",
      modulo: "USUARIOS",
      detalhes: `Usuário ID ${id} excluído por ${admin.name}`,
    });
  } catch {
    return {
      ok: false,
      error: "Não é possível excluir: há lotes de importação ou outros registros vinculados a esse usuário.",
    };
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function trocarMinhaSenha(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const currentUser = await requireUser();
  await ensureAuthAndUserSchema();

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarSenha = String(formData.get("confirmarSenha") ?? "");

  if (!senhaAtual) return { ok: false, error: "Informe sua senha atual." };
  if (novaSenha.length < 8) return { ok: false, error: "A nova senha deve ter pelo menos 8 caracteres." };
  if (novaSenha !== confirmarSenha) return { ok: false, error: "A nova senha e a confirmação não coincidem." };

  const dbUser = await prisma.user.findUnique({ where: { id: currentUser.id } });
  if (!dbUser) return { ok: false, error: "Usuário não encontrado." };

  const senhaValida = await bcrypt.compare(senhaAtual, dbUser.passwordHash);
  if (!senhaValida) return { ok: false, error: "Senha atual incorreta." };

  const passwordHash = await bcrypt.hash(novaSenha, 10);
  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  await registrarAuditoria({
    acao: "EDITAR",
    modulo: "USUARIOS",
    detalhes: `Usuário ${dbUser.username} alterou sua própria senha`,
    metadata: { userId: dbUser.id, username: dbUser.username },
  });

  revalidatePath("/");
  return { ok: true };
}
