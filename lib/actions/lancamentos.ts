"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { recalcularFechamento } from "@/lib/bonificacao";
import { registrarAlteracao } from "@/lib/auditoria";
import { periodoLabel } from "@/lib/periodo";
import type { ActionResult } from "@/lib/constants";

// Nome de quem sofre a alteração — o registro precisa dizer "de quem" era o
// lançamento ou o ajuste, não só o id.
async function nomeDoFuncionario(funcionarioId: string): Promise<string> {
  const f = await prisma.funcionario.findUnique({
    where: { id: funcionarioId },
    select: { nome: true },
  });
  return f?.nome ?? "funcionário desconhecido";
}

const emReais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

async function assertFechamentoAberto(periodo: string): Promise<string | null> {
  const fechamento = await prisma.fechamentoMensal.findUnique({ where: { periodo } });
  if (fechamento?.status === "FECHADO") {
    return "Este mês já foi fechado e não pode mais ser alterado.";
  }
  return null;
}

export async function createLancamento(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = parseLancamentoForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const bloqueado = await assertFechamentoAberto(parsed.data.periodo);
  if (bloqueado) return { ok: false, error: bloqueado };

  await prisma.lancamentoVenda.create({ data: { ...parsed.data, origem: "MANUAL" } });
  await recalcularFechamento(parsed.data.periodo);

  const nome = await nomeDoFuncionario(parsed.data.funcionarioId);
  await registrarAlteracao({
    acao: "LANCAMENTO_CRIADO",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    alvo: nome,
    periodo: parsed.data.periodo,
    resumo:
      `Lançou à mão ${parsed.data.quantidade} venda(s) para ${nome} em ` +
      `${periodoLabel(parsed.data.periodo)} (${emReais(parsed.data.valorInstalado)}).`,
    depois: parsed.data,
  });

  revalidatePath("/lancamentos");
  revalidatePath("/fechamento");
  return { ok: true };
}

export async function updateLancamento(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = parseLancamentoForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const bloqueado = await assertFechamentoAberto(parsed.data.periodo);
  if (bloqueado) return { ok: false, error: bloqueado };

  const antes = await prisma.lancamentoVenda.findUnique({ where: { id } });

  await prisma.lancamentoVenda.update({ where: { id }, data: parsed.data });
  await recalcularFechamento(parsed.data.periodo);

  const nome = await nomeDoFuncionario(parsed.data.funcionarioId);
  await registrarAlteracao({
    acao: "LANCAMENTO_ALTERADO",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    alvo: nome,
    periodo: parsed.data.periodo,
    resumo:
      `Alterou o lançamento de ${nome} em ${periodoLabel(parsed.data.periodo)}: ` +
      `${antes?.quantidade ?? 0} → ${parsed.data.quantidade} venda(s), ` +
      `${emReais(antes?.valorInstalado ?? 0)} → ${emReais(parsed.data.valorInstalado)}.`,
    antes,
    depois: parsed.data,
  });

  revalidatePath("/lancamentos");
  revalidatePath("/fechamento");
  return { ok: true };
}

export async function deleteLancamento(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const lancamento = await prisma.lancamentoVenda.findUnique({ where: { id } });
  if (!lancamento) return { ok: false, error: "Lançamento não encontrado." };

  const bloqueado = await assertFechamentoAberto(lancamento.periodo);
  if (bloqueado) return { ok: false, error: bloqueado };

  await prisma.lancamentoVenda.delete({ where: { id } });
  await recalcularFechamento(lancamento.periodo);

  const nome = await nomeDoFuncionario(lancamento.funcionarioId);
  await registrarAlteracao({
    acao: "LANCAMENTO_REMOVIDO",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    alvo: nome,
    periodo: lancamento.periodo,
    resumo:
      `Removeu o lançamento de ${nome} em ${periodoLabel(lancamento.periodo)}: ` +
      `${lancamento.quantidade} venda(s), ${emReais(lancamento.valorInstalado)} ` +
      `(origem ${lancamento.origem}).`,
    antes: lancamento,
  });

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
  const user = await requireAdmin();
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

  const nome = await nomeDoFuncionario(parsed.data.funcionarioId);
  await registrarAlteracao({
    acao: "AJUSTE_CRIADO",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    alvo: nome,
    periodo: parsed.data.periodo,
    resumo:
      `Lançou ajuste de ${emReais(parsed.data.valor)} para ${nome} em ` +
      `${periodoLabel(parsed.data.periodo)} — motivo: "${parsed.data.descricao}".`,
    depois: parsed.data,
  });

  revalidatePath("/fechamento");
  return { ok: true };
}

export async function deleteAjuste(id: string): Promise<ActionResult> {
  const user = await requireAdmin();
  const ajuste = await prisma.ajuste.findUnique({ where: { id } });
  if (!ajuste) return { ok: false, error: "Ajuste não encontrado." };

  const bloqueado = await assertFechamentoAberto(ajuste.periodo);
  if (bloqueado) return { ok: false, error: bloqueado };

  await prisma.ajuste.delete({ where: { id } });
  await recalcularFechamento(ajuste.periodo);

  const nome = await nomeDoFuncionario(ajuste.funcionarioId);
  await registrarAlteracao({
    acao: "AJUSTE_REMOVIDO",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    alvo: nome,
    periodo: ajuste.periodo,
    resumo:
      `Removeu o ajuste de ${emReais(ajuste.valor)} de ${nome} em ` +
      `${periodoLabel(ajuste.periodo)} — era: "${ajuste.descricao}".`,
    antes: ajuste,
  });

  revalidatePath("/fechamento");
  return { ok: true };
}
