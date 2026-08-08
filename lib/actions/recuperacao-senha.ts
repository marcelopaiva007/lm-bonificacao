"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ensureAuthAndUserSchema } from "@/lib/ensure-schema";
import { registrarAuditoria } from "@/lib/auditoria";
import type { ActionResult } from "@/lib/constants";

const solicitarSchema = z.object({
  identificador: z.string().trim().min(3, "Informe seu usuário ou e-mail registrado"),
});

const redefinirSchema = z
  .object({
    token: z.string().min(1, "Token de recuperação inválido"),
    novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
    confirmarSenha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
  });

export async function solicitarRecuperacaoSenha(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult & { resetLink?: string }> {
  await ensureAuthAndUserSchema();

  const parsed = solicitarSchema.safeParse({
    identificador: formData.get("identificador"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const termo = parsed.data.identificador;
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: termo }, { email: termo }],
    },
  });

  // Retornamos mensagem de sucesso genérica para segurança (evitar enumeração de usuários)
  if (!user || user.ativo === false) {
    return {
      ok: true,
    };
  }

  // Gera token seguro base64url (32 bytes)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora de validade

  // Cancela tokens anteriores não utilizados
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  await registrarAuditoria({
    acao: "EDITAR",
    modulo: "USUARIOS",
    detalhes: `Solicitação de recuperação de senha para usuário ${user.username}`,
    metadata: { userId: user.id, username: user.username },
  });

  const resetPath = `/redefinir-senha/${token}`;

  return {
    ok: true,
    resetLink: resetPath,
  };
}

export async function redefinirSenhaComToken(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await ensureAuthAndUserSchema();

  const parsed = redefinirSchema.safeParse({
    token: formData.get("token"),
    novaSenha: formData.get("novaSenha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt) {
    return { ok: false, error: "Link de recuperação inválido ou já utilizado." };
  }

  if (resetToken.expiresAt < new Date()) {
    return { ok: false, error: "Este link de recuperação expirou. Solicite um novo link." };
  }

  if (!resetToken.user.ativo) {
    return { ok: false, error: "Esta conta está inativa." };
  }

  const newHash = await bcrypt.hash(parsed.data.novaSenha, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await registrarAuditoria({
    acao: "EDITAR",
    modulo: "USUARIOS",
    detalhes: `Senha redefinida com sucesso via token para ${resetToken.user.username}`,
    metadata: { userId: resetToken.userId },
  });

  return { ok: true };
}
