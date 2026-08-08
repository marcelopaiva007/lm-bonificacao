"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import type { ActionResult } from "@/lib/constants";
import { normalizarTexto } from "@/lib/text";
import { tokensNome, tokensContidosEmOrdem } from "@/lib/vendedor-match";
import { registrarAuditoria } from "@/lib/auditoria";

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
    .refine((v) => v === "" || v.length === 11, "CPF deve ter 11 dígitos")
    .optional(),
  cargo: z.enum([
    "VENDEDOR_EXTERNO",
    "ATENDIMENTO_ADM",
    "SUPERVISOR",
    "TECNICO",
    "VENDEDOR_AGREGADO",
    "GESTOR",
    "OUTRO_SETOR",
  ]),
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

  const f = await prisma.funcionario.create({
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

  await registrarAuditoria({
    acao: "CRIAR",
    modulo: "FUNCIONARIOS",
    detalhes: `Cadastrou o funcionário "${parsed.data.nome}" (Cargo: ${parsed.data.cargo})`,
    metadata: { funcionarioId: f.id, nome: f.nome, cargo: f.cargo },
  });

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

  await registrarAuditoria({
    acao: "EDITAR",
    modulo: "FUNCIONARIOS",
    detalhes: `Atualizou os dados do funcionário "${parsed.data.nome}"`,
    metadata: { funcionarioId: id, nome: parsed.data.nome },
  });
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

// ---------- Detecção e Fusão de Funcionários Duplicados ----------

export async function detectarFuncionariosDuplicados() {
  await requireAdmin();
  const funcionarios = await prisma.funcionario.findMany({
    where: { ativo: true },
    include: { cidade: true },
  });

  const grupos: {
    motivo: string;
    principal: (typeof funcionarios)[0];
    duplicados: (typeof funcionarios)[0][];
  }[] = [];

  const visitados = new Set<string>();

  for (let i = 0; i < funcionarios.length; i++) {
    const f1 = funcionarios[i];
    if (visitados.has(f1.id)) continue;

    const dupes: (typeof funcionarios)[0][] = [];
    let motivo = "";

    for (let j = i + 1; j < funcionarios.length; j++) {
      const f2 = funcionarios[j];
      if (visitados.has(f2.id)) continue;

      const cpf1 = f1.cpf?.replace(/\D/g, "");
      const cpf2 = f2.cpf?.replace(/\D/g, "");

      if (cpf1 && cpf2 && cpf1.length === 11 && cpf1 === cpf2) {
        dupes.push(f2);
        motivo = "CPF Idêntico";
        visitados.add(f2.id);
        continue;
      }

      const n1 = normalizarTexto(f1.nome);
      const n2 = normalizarTexto(f2.nome);

      if (n1 === n2) {
        dupes.push(f2);
        motivo = "Nome Idêntico";
        visitados.add(f2.id);
        continue;
      }

      const t1 = tokensNome(f1.nome);
      const t2 = tokensNome(f2.nome);
      const [menor, maior] = t1.length <= t2.length ? [t1, t2] : [t2, t1];
      if (tokensContidosEmOrdem(menor, maior)) {
        dupes.push(f2);
        motivo = "Nome Semelhante";
        visitados.add(f2.id);
      }
    }

    if (dupes.length > 0) {
      visitados.add(f1.id);
      grupos.push({
        motivo: motivo || "Semelhança",
        principal: f1,
        duplicados: dupes,
      });
    }
  }

  return grupos.map((g) => ({
    motivo: g.motivo,
    principal: {
      id: g.principal.id,
      nome: g.principal.nome,
      cpf: g.principal.cpf,
      cargo: g.principal.cargo,
      cidade: g.principal.cidade?.nome ?? null,
    },
    duplicados: g.duplicados.map((d) => ({
      id: d.id,
      nome: d.nome,
      cpf: d.cpf,
      cargo: d.cargo,
      cidade: d.cidade?.nome ?? null,
    })),
  }));
}

export async function mesclarFuncionarios(
  idPrincipal: string,
  idDuplicado: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (idPrincipal === idDuplicado) {
    return { ok: false, error: "Selecione dois funcionários diferentes para mesclar." };
  }

  const [principal, duplicado] = await Promise.all([
    prisma.funcionario.findUnique({ where: { id: idPrincipal } }),
    prisma.funcionario.findUnique({ where: { id: idDuplicado } }),
  ]);

  if (!principal || !duplicado) {
    return { ok: false, error: "Um dos funcionários selecionados não foi encontrado." };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Reatribuir lançamentos de venda
    await tx.lancamentoVenda.updateMany({
      where: { funcionarioId: idDuplicado },
      data: { funcionarioId: idPrincipal },
    });

    // 2. Tratar bonificações calculadas
    const bonifDuplicado = await tx.bonificacaoCalculada.findMany({
      where: { funcionarioId: idDuplicado },
    });
    for (const b of bonifDuplicado) {
      const existePrincipal = await tx.bonificacaoCalculada.findUnique({
        where: {
          fechamentoId_funcionarioId: {
            fechamentoId: b.fechamentoId,
            funcionarioId: idPrincipal,
          },
        },
      });
      if (existePrincipal) {
        await tx.bonificacaoCalculada.delete({ where: { id: b.id } });
      } else {
        await tx.bonificacaoCalculada.update({
          where: { id: b.id },
          data: { funcionarioId: idPrincipal },
        });
      }
    }

    // 3. Reatribuir ajustes
    await tx.ajuste.updateMany({
      where: { funcionarioId: idDuplicado },
      data: { funcionarioId: idPrincipal },
    });

    // 4. Reatribuir supervisão de equipe
    await tx.equipe.updateMany({
      where: { supervisorId: idDuplicado },
      data: { supervisorId: idPrincipal },
    });

    // 5. Atualizar campos nulos do principal com valores do duplicado
    const updateData: Record<string, string> = {};
    if (!principal.cpf && duplicado.cpf) updateData.cpf = duplicado.cpf;
    if (!principal.email && duplicado.email) updateData.email = duplicado.email;
    if (!principal.telegramChatId && duplicado.telegramChatId) updateData.telegramChatId = duplicado.telegramChatId;
    if (!principal.cidadeId && duplicado.cidadeId) updateData.cidadeId = duplicado.cidadeId;
    if (!principal.equipeId && duplicado.equipeId) updateData.equipeId = duplicado.equipeId;

    if (Object.keys(updateData).length > 0) {
      await tx.funcionario.update({
        where: { id: idPrincipal },
        data: updateData,
      });
    }

    // 6. Excluir ou desativar duplicado
    try {
      await tx.funcionario.delete({ where: { id: idDuplicado } });
    } catch {
      await tx.funcionario.update({ where: { id: idDuplicado }, data: { ativo: false } });
    }
  });

  await registrarAuditoria({
    acao: "MESCLAR",
    modulo: "FUNCIONARIOS",
    detalhes: `Mesclou o cadastro duplicado de "${duplicado.nome}" no cadastro principal de "${principal.nome}"`,
    metadata: { idPrincipal, nomePrincipal: principal.nome, idDuplicado, nomeDuplicado: duplicado.nome },
  });

  revalidatePath("/cadastros/funcionarios");
  revalidatePath("/fechamento");
  return { ok: true };
}
