"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAdmin } from "@/lib/auth-guard";
import { recalcularFechamento } from "@/lib/bonificacao";
import type { ActionResult } from "@/lib/constants";

const periodoRegex = /^\d{4}-\d{2}$/;

const lancamentoSchema = z.object({
  funcionarioId: z.string().trim().min(1, "Selecione um funcionário"),
  periodo: z.string().regex(periodoRegex, "Período inválido"),
  quantidade: z.coerce.number().int().default(0),
  aprovado: z.coerce.number().int().default(0),
  cancelado: z.coerce.number().int().default(0),
  valorInstalado: z.coerce.number().default(0),
  valorDemaisServicos: z.coerce.number().default(0),
  qtdInternet: z.coerce.number().int().default(0),
  qtdChip: z.coerce.number().int().default(0),
  qtdGps: z.coerce.number().int().default(0),
  qtdTv: z.coerce.number().int().default(0),
  qtdStreaming: z.coerce.number().int().default(0),
  qtdTelefoniaFixa: z.coerce.number().int().default(0),
});

function parseLancamentoForm(formData: FormData) {
  return lancamentoSchema.safeParse({
    funcionarioId: formData.get("funcionarioId"),
    periodo: formData.get("periodo"),
    quantidade: formData.get("quantidade") || 0,
    aprovado: formData.get("aprovado") || 0,
    cancelado: formData.get("cancelado") || 0,
    valorInstalado: formData.get("valorInstalado") || 0,
    valorDemaisServicos: formData.get("valorDemaisServicos") || 0,
    qtdInternet: formData.get("qtdInternet") || 0,
    qtdChip: formData.get("qtdChip") || 0,
    qtdGps: formData.get("qtdGps") || 0,
    qtdTv: formData.get("qtdTv") || 0,
    qtdStreaming: formData.get("qtdStreaming") || 0,
    qtdTelefoniaFixa: formData.get("qtdTelefoniaFixa") || 0,
  });
}

async function assertFechamentoAberto(periodo: string, tx: Prisma.TransactionClient = prisma): Promise<string | null> {
  const fechamento = await tx.fechamentoMensal.findUnique({ where: { periodo } });
  if (fechamento?.status === "FECHADO") {
    return "Este mês já foi fechado e não pode mais ser alterado.";
  }
  return null;
}

export async function createLancamento(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseLancamentoForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.$transaction(async (tx) => {
      const bloqueado = await assertFechamentoAberto(parsed.data.periodo, tx);
      if (bloqueado) throw new Error(bloqueado);

      await tx.lancamentoVenda.create({ data: { ...parsed.data, origem: "MANUAL" } });
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erro ao criar lançamento.";
    return { ok: false, error };
  }

  await recalcularFechamento(parsed.data.periodo);
  revalidatePath("/lancamentos");
  revalidatePath("/fechamento");
  return { ok: true };
}

export async function updateLancamento(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parseLancamentoForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await prisma.$transaction(async (tx) => {
      const bloqueado = await assertFechamentoAberto(parsed.data.periodo, tx);
      if (bloqueado) throw new Error(bloqueado);

      await tx.lancamentoVenda.update({ where: { id }, data: parsed.data });
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erro ao atualizar lançamento.";
    return { ok: false, error };
  }

  await recalcularFechamento(parsed.data.periodo);
  revalidatePath("/lancamentos");
  revalidatePath("/fechamento");
  return { ok: true };
}

export async function deleteLancamento(id: string): Promise<ActionResult> {
  await requireAdmin();

  let periodo = "";
  try {
    await prisma.$transaction(async (tx) => {
      const lancamento = await tx.lancamentoVenda.findUnique({ where: { id } });
      if (!lancamento) throw new Error("Lançamento não encontrado.");
      periodo = lancamento.periodo;

      const bloqueado = await assertFechamentoAberto(periodo, tx);
      if (bloqueado) throw new Error(bloqueado);

      await tx.lancamentoVenda.delete({ where: { id } });
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erro ao excluir lançamento.";
    return { ok: false, error };
  }

  await recalcularFechamento(periodo);
  revalidatePath("/lancamentos");
  revalidatePath("/fechamento");
  return { ok: true };
}

// ---------- Ajustes ----------

const ajusteSchema = z.object({
  funcionarioId: z.string().trim().min(1, "Selecione um funcionário"),
  periodo: z.string().regex(periodoRegex, "Período inválido"),
  descricao: z.string().trim().min(2, "Descreva o motivo do ajuste"),
  valor: z.coerce.number(),
});

export async function createAjuste(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ajusteSchema.safeParse({
    funcionarioId: formData.get("funcionarioId"),
    periodo: formData.get("periodo"),
    descricao: formData.get("descricao"),
    valor: formData.get("valor"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const bloqueado = await assertFechamentoAberto(parsed.data.periodo);
  if (bloqueado) return { ok: false, error: bloqueado };

  const fechamento = await prisma.fechamentoMensal.upsert({
    where: { periodo: parsed.data.periodo },
    update: {},
    create: { periodo: parsed.data.periodo, status: "ABERTO" },
  });

  await prisma.ajuste.create({ data: { ...parsed.data, fechamentoId: fechamento.id } });
  await recalcularFechamento(parsed.data.periodo);
  revalidatePath("/fechamento");
  return { ok: true };
}

export async function deleteAjuste(id: string): Promise<ActionResult> {
  await requireAdmin();
  const ajuste = await prisma.ajuste.findUnique({ where: { id } });
  if (!ajuste) return { ok: false, error: "Ajuste não encontrado." };

  const bloqueado = await assertFechamentoAberto(ajuste.periodo);
  if (bloqueado) return { ok: false, error: bloqueado };

  await prisma.ajuste.delete({ where: { id } });
  await recalcularFechamento(ajuste.periodo);
  revalidatePath("/fechamento");
  return { ok: true };
}
