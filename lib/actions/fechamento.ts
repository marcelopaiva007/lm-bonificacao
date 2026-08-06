"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapacidade } from "@/lib/auth-guard";
import { recalcularFechamento } from "@/lib/bonificacao";
import { registrarAlteracao } from "@/lib/auditoria";
import { periodoLabel } from "@/lib/periodo";
import type { ActionResult } from "@/lib/constants";

export async function fecharMes(periodo: string): Promise<ActionResult> {
  const user = await requireCapacidade("FECHAR_MES");

  await recalcularFechamento(periodo);

  const fechamento = await prisma.fechamentoMensal.update({
    where: { periodo },
    data: { status: "FECHADO", fechadoPorId: user.id, fechadoEm: new Date() },
  });

  // O valor congelado vai junto no registro: é o número que a diretoria confere
  // e o que uma contestação futura vai questionar.
  await registrarAlteracao({
    acao: "MES_FECHADO",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    periodo,
    resumo:
      `Fechou ${periodoLabel(periodo)} com bonificação total de ` +
      `${fechamento.valorTotalBonificacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    depois: {
      valorTotalVendido: fechamento.valorTotalVendido,
      valorTotalBonificacao: fechamento.valorTotalBonificacao,
    },
  });

  revalidatePath("/fechamento");
  revalidatePath(`/fechamento/${periodo}`);
  return { ok: true };
}

export async function reabrirMes(periodo: string): Promise<ActionResult> {
  const user = await requireCapacidade("FECHAR_MES");

  // Estado anterior lido ANTES da reabertura: depois do recálculo os valores
  // mudam, e o que interessa auditar é justamente o que estava congelado.
  const antes = await prisma.fechamentoMensal.findUnique({ where: { periodo } });

  await prisma.fechamentoMensal.update({
    where: { periodo },
    data: { status: "ABERTO", fechadoPorId: null, fechadoEm: null },
  });

  await recalcularFechamento(periodo);

  const depois = await prisma.fechamentoMensal.findUnique({ where: { periodo } });

  await registrarAlteracao({
    acao: "MES_REABERTO",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    periodo,
    resumo:
      `Reabriu ${periodoLabel(periodo)}. Bonificação recalculada: ` +
      `${(antes?.valorTotalBonificacao ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} → ` +
      `${(depois?.valorTotalBonificacao ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    antes: antes
      ? {
          valorTotalVendido: antes.valorTotalVendido,
          valorTotalBonificacao: antes.valorTotalBonificacao,
          fechadoEm: antes.fechadoEm,
        }
      : null,
    depois: depois
      ? {
          valorTotalVendido: depois.valorTotalVendido,
          valorTotalBonificacao: depois.valorTotalBonificacao,
        }
      : null,
  });

  revalidatePath("/fechamento");
  revalidatePath(`/fechamento/${periodo}`);
  return { ok: true };
}

export async function recalcular(periodo: string): Promise<ActionResult> {
  const user = await requireCapacidade("FECHAR_MES");

  const antes = await prisma.fechamentoMensal.findUnique({ where: { periodo } });
  await recalcularFechamento(periodo);
  const depois = await prisma.fechamentoMensal.findUnique({ where: { periodo } });

  const valorAntes = antes?.valorTotalBonificacao ?? 0;
  const valorDepois = depois?.valorTotalBonificacao ?? 0;

  // Recálculo que não muda nada é rotina e só polui o histórico. Registramos
  // apenas quando o total se move — que é quando alguém vai querer explicação.
  if (valorAntes !== valorDepois) {
    await registrarAlteracao({
      acao: "RECALCULO_MANUAL",
      usuarioId: user.id,
      usuarioNome: user.name ?? user.username,
      periodo,
      resumo:
        `Recalculou ${periodoLabel(periodo)} e o total mudou: ` +
        `${valorAntes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} → ` +
        `${valorDepois.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      antes: { valorTotalBonificacao: valorAntes },
      depois: { valorTotalBonificacao: valorDepois },
    });
  }

  revalidatePath(`/fechamento/${periodo}`);
  return { ok: true };
}
