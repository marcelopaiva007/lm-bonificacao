"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { CARGOS, type ActionResult } from "@/lib/constants";
import { documentoValido } from "@/lib/documento";

// ---------- Cidade ----------

const cidadeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da cidade"),
});

export async function createCidade(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = cidadeSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.cidade.create({ data: parsed.data });
  } catch {
    return { ok: false, error: "Já existe uma cidade com esse nome." };
  }
  revalidatePath("/cadastros/cidades");
  return { ok: true };
}

export async function updateCidade(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = cidadeSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.cidade.update({ where: { id }, data: parsed.data });
  } catch {
    return { ok: false, error: "Já existe uma cidade com esse nome." };
  }
  revalidatePath("/cadastros/cidades");
  return { ok: true };
}

export async function deleteCidade(id: string): Promise<ActionResult> {
  await requireAdmin();
  const emUso = await prisma.funcionario.count({ where: { cidadeId: id } });
  if (emUso > 0) {
    return { ok: false, error: `Não é possível excluir: ${emUso} funcionário(s) vinculado(s) a essa cidade.` };
  }
  await prisma.cidade.delete({ where: { id } });
  revalidatePath("/cadastros/cidades");
  return { ok: true };
}

// ---------- Equipe ----------

const equipeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da equipe"),
  supervisorId: z.string().trim().optional(),
  tamanhoTier: z.coerce.number().int().optional(),
});

export async function createEquipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = {
    nome: formData.get("nome"),
    supervisorId: formData.get("supervisorId") || undefined,
    tamanhoTier: formData.get("tamanhoTier") || undefined,
  };
  const parsed = equipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.equipe.create({
    data: {
      nome: parsed.data.nome,
      supervisorId: parsed.data.supervisorId || null,
      tamanhoTier: parsed.data.tamanhoTier ?? null,
    },
  });
  revalidatePath("/cadastros/equipes");
  return { ok: true };
}

export async function updateEquipe(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = {
    nome: formData.get("nome"),
    supervisorId: formData.get("supervisorId") || undefined,
    tamanhoTier: formData.get("tamanhoTier") || undefined,
  };
  const parsed = equipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.equipe.update({
    where: { id },
    data: {
      nome: parsed.data.nome,
      supervisorId: parsed.data.supervisorId || null,
      tamanhoTier: parsed.data.tamanhoTier ?? null,
    },
  });
  revalidatePath("/cadastros/equipes");
  return { ok: true };
}

export async function deleteEquipe(id: string): Promise<ActionResult> {
  await requireAdmin();
  const emUso = await prisma.funcionario.count({ where: { equipeId: id } });
  if (emUso > 0) {
    return { ok: false, error: `Não é possível excluir: ${emUso} funcionário(s) vinculado(s) a essa equipe.` };
  }
  await prisma.equipe.delete({ where: { id } });
  revalidatePath("/cadastros/equipes");
  return { ok: true };
}

// ---------- Funcionario ----------

const funcionarioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do funcionário"),
  cpf: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || documentoValido(v), "CPF ou CNPJ inválido — confira os dígitos")
    .optional(),
  // Deriva dos CARGOS (lib/constants) para não voltar a divergir da tela — antes
  // faltavam Técnico/Responsável de Setor/Vendedor Agregado e salvar essas
  // pessoas falhava em silêncio.
  cargo: z.enum(CARGOS.map((c) => c.value) as [string, ...string[]]),
  cidadeId: z.string().trim().optional(),
  equipeId: z.string().trim().optional(),
  // Contato para as cobranças de meta (Telegram/e-mail).
  email: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido")
    .optional(),
  telegramChatId: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d-]/g, ""))
    .optional(),
  ativo: z.coerce.boolean().default(true),
});

// Erro amigável quando o CPF/CNPJ bate no @unique: diz de quem é a ficha que já
// tem esse documento — assim dá para achar a duplicata em vez de só "já existe".
async function erroDocumentoDuplicado(doc: string | undefined): Promise<string> {
  if (doc) {
    const dono = await prisma.funcionario.findUnique({
      where: { cpf: doc },
      select: { nome: true, ativo: true },
    });
    if (dono) {
      return `Esse CPF/CNPJ já está na ficha de "${dono.nome}"${dono.ativo ? "" : " (inativa)"}.`;
    }
  }
  return "Não foi possível salvar. Confira os dados e tente de novo.";
}

export async function createFuncionario(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = {
    nome: formData.get("nome"),
    cpf: formData.get("cpf") || undefined,
    cargo: formData.get("cargo"),
    cidadeId: formData.get("cidadeId") || undefined,
    equipeId: formData.get("equipeId") || undefined,
    email: formData.get("email") || undefined,
    telegramChatId: formData.get("telegramChatId") || undefined,
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
  };
  const parsed = funcionarioSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.funcionario.create({
      data: {
        nome: parsed.data.nome,
        cpf: parsed.data.cpf || null,
        cargo: parsed.data.cargo,
        cidadeId: parsed.data.cidadeId || null,
        equipeId: parsed.data.equipeId || null,
        email: parsed.data.email || null,
        telegramChatId: parsed.data.telegramChatId || null,
        ativo: parsed.data.ativo,
      },
    });
  } catch {
    return { ok: false, error: await erroDocumentoDuplicado(parsed.data.cpf) };
  }
  revalidatePath("/cadastros/funcionarios");
  return { ok: true };
}

export async function updateFuncionario(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const raw = {
    nome: formData.get("nome"),
    cpf: formData.get("cpf") || undefined,
    cargo: formData.get("cargo"),
    cidadeId: formData.get("cidadeId") || undefined,
    equipeId: formData.get("equipeId") || undefined,
    email: formData.get("email") || undefined,
    telegramChatId: formData.get("telegramChatId") || undefined,
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
  };
  const parsed = funcionarioSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.funcionario.update({
      where: { id },
      data: {
        nome: parsed.data.nome,
        cpf: parsed.data.cpf || null,
        cargo: parsed.data.cargo,
        cidadeId: parsed.data.cidadeId || null,
        equipeId: parsed.data.equipeId || null,
        email: parsed.data.email || null,
        telegramChatId: parsed.data.telegramChatId || null,
        ativo: parsed.data.ativo,
      },
    });
  } catch {
    return { ok: false, error: await erroDocumentoDuplicado(parsed.data.cpf) };
  }
  revalidatePath("/cadastros/funcionarios");
  return { ok: true };
}

export async function toggleFuncionarioAtivo(id: string, ativo: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.funcionario.update({ where: { id }, data: { ativo } });
  revalidatePath("/cadastros/funcionarios");
  return { ok: true };
}

// Vincula (ou desvincula, com chatId vazio) o chat_id do Telegram de uma pessoa
// a partir da tela de "Vincular Telegram". Usado para preencher o destino das
// cobranças sem precisar digitar o número à mão.
export async function vincularTelegramChatId(
  funcionarioId: string,
  chatId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const limpo = chatId.replace(/[^\d-]/g, "");
  await prisma.funcionario.update({
    where: { id: funcionarioId },
    data: { telegramChatId: limpo || null },
  });
  revalidatePath("/cadastros/telegram");
  revalidatePath("/cadastros/funcionarios");
  return { ok: true };
}

export async function deleteFuncionario(id: string): Promise<ActionResult> {
  await requireAdmin();
  const [lancamentos, bonificacoes] = await Promise.all([
    prisma.lancamentoVenda.count({ where: { funcionarioId: id } }),
    prisma.bonificacaoCalculada.count({ where: { funcionarioId: id } }),
  ]);
  if (lancamentos > 0 || bonificacoes > 0) {
    return {
      ok: false,
      error: "Não é possível excluir: há lançamentos ou bonificações associados. Desative o funcionário em vez de excluir.",
    };
  }
  await prisma.funcionario.delete({ where: { id } });
  revalidatePath("/cadastros/funcionarios");
  return { ok: true };
}
