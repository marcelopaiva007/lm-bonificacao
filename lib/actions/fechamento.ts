"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { recalcularFechamento } from "@/lib/bonificacao";
import type { ActionResult } from "@/lib/constants";
import { registrarAuditoria } from "@/lib/auditoria";

export async function fecharMes(periodo: string): Promise<ActionResult> {
  const user = await requireAdmin();

  await recalcularFechamento(periodo);

  await prisma.fechamentoMensal.update({
    where: { periodo },
    data: { status: "FECHADO", fechadoPorId: user.id, fechadoEm: new Date() },
  });

  await registrarAuditoria({
    acao: "FECHAR_MES",
    modulo: "FECHAMENTO",
    detalhes: `Fechou o mês de referência ${periodo}`,
    metadata: { periodo },
  });

  revalidatePath("/fechamento");
  revalidatePath(`/fechamento/${periodo}`);
  return { ok: true };
}

export async function reabrirMes(periodo: string): Promise<ActionResult> {
  await requireAdmin();

  await prisma.fechamentoMensal.update({
    where: { periodo },
    data: { status: "ABERTO", fechadoPorId: null, fechadoEm: null },
  });

  await recalcularFechamento(periodo);

  await registrarAuditoria({
    acao: "REABRIR_MES",
    modulo: "FECHAMENTO",
    detalhes: `Reabriu o mês de referência ${periodo} para edições`,
    metadata: { periodo },
  });

  revalidatePath("/fechamento");
  revalidatePath(`/fechamento/${periodo}`);
  return { ok: true };
}

export async function recalcular(periodo: string): Promise<ActionResult> {
  await requireAdmin();
  await recalcularFechamento(periodo);

  await registrarAuditoria({
    acao: "RECALCULAR",
    modulo: "FECHAMENTO",
    detalhes: `Recalculou as bonificações do mês ${periodo}`,
    metadata: { periodo },
  });

  revalidatePath(`/fechamento/${periodo}`);
  return { ok: true };
}
