"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContabilEditor, requireContabilAccess } from "@/lib/contabil-auth-guard";
import { parseValorBR, dataDeInput, periodosDoAno } from "@/lib/contabil";
import type { ActionResult } from "@/lib/constants";

function revalidarContabil() {
  revalidatePath("/contabil");
  revalidatePath("/contabil/resultado");
  revalidatePath("/contabil/impostos");
  revalidatePath("/contabil/fechamento");
  revalidatePath("/contabil/cadastros");
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

const empresaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da empresa"),
  cnpj: z.string().trim().optional(),
  regime: z.enum(["SIMPLES", "PRESUMIDO", "REAL"]).optional(),
});

export async function createEmpresaContabil(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireContabilEditor();

  const parsed = empresaSchema.safeParse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj") || undefined,
    regime: formData.get("regime") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const existe = await prisma.empresaContabil.findUnique({ where: { nome: parsed.data.nome } });
  if (existe) return { ok: false, error: "Já existe uma empresa com esse nome." };

  await prisma.empresaContabil.create({
    data: {
      nome: parsed.data.nome,
      cnpj: parsed.data.cnpj || null,
      regime: parsed.data.regime ?? null,
    },
  });

  revalidarContabil();
  return { ok: true };
}

export async function updateEmpresaContabil(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireContabilEditor();

  const parsed = empresaSchema.safeParse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj") || undefined,
    regime: formData.get("regime") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const conflito = await prisma.empresaContabil.findFirst({
    where: { nome: parsed.data.nome, NOT: { id } },
  });
  if (conflito) return { ok: false, error: "Já existe outra empresa com esse nome." };

  await prisma.empresaContabil.update({
    where: { id },
    data: {
      nome: parsed.data.nome,
      cnpj: parsed.data.cnpj || null,
      regime: parsed.data.regime ?? null,
      ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    },
  });

  revalidarContabil();
  return { ok: true };
}

export async function deleteEmpresaContabil(id: string): Promise<ActionResult> {
  await requireContabilEditor();

  const competencias = await prisma.competenciaContabil.count({ where: { empresaId: id } });
  if (competencias > 0) {
    return {
      ok: false,
      error:
        "Esta empresa já tem meses lançados. Desative-a em vez de excluir — assim o histórico continua nos relatórios.",
    };
  }

  await prisma.empresaContabil.delete({ where: { id } });
  revalidarContabil();
  return { ok: true };
}

export async function toggleEmpresaContabilAtiva(id: string, ativo: boolean): Promise<ActionResult> {
  await requireContabilEditor();
  await prisma.empresaContabil.update({ where: { id }, data: { ativo } });
  revalidarContabil();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tipos de imposto
// ---------------------------------------------------------------------------

const tipoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do tributo"),
  descricao: z.string().trim().optional(),
  ordem: z.coerce.number().int().min(0).default(0),
});

export async function createTipoImposto(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireContabilEditor();

  const parsed = tipoSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    ordem: formData.get("ordem") || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const existe = await prisma.tipoImposto.findUnique({ where: { nome: parsed.data.nome } });
  if (existe) return { ok: false, error: "Já existe um tributo com esse nome." };

  await prisma.tipoImposto.create({
    data: {
      nome: parsed.data.nome,
      descricao: parsed.data.descricao || null,
      ordem: parsed.data.ordem,
    },
  });

  revalidarContabil();
  return { ok: true };
}

export async function updateTipoImposto(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireContabilEditor();

  const parsed = tipoSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    ordem: formData.get("ordem") || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const conflito = await prisma.tipoImposto.findFirst({
    where: { nome: parsed.data.nome, NOT: { id } },
  });
  if (conflito) return { ok: false, error: "Já existe outro tributo com esse nome." };

  await prisma.tipoImposto.update({
    where: { id },
    data: {
      nome: parsed.data.nome,
      descricao: parsed.data.descricao || null,
      ordem: parsed.data.ordem,
      ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    },
  });

  revalidarContabil();
  return { ok: true };
}

export async function deleteTipoImposto(id: string): Promise<ActionResult> {
  await requireContabilEditor();

  const usos = await prisma.impostoApurado.count({ where: { tipoId: id } });
  if (usos > 0) {
    return {
      ok: false,
      error: "Este tributo já tem valores apurados. Desative-o em vez de excluir.",
    };
  }

  await prisma.tipoImposto.delete({ where: { id } });
  revalidarContabil();
  return { ok: true };
}

export async function toggleTipoImpostoAtivo(id: string, ativo: boolean): Promise<ActionResult> {
  await requireContabilEditor();
  await prisma.tipoImposto.update({ where: { id }, data: { ativo } });
  revalidarContabil();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Resultado (faturamento x despesas) — a grade de 12 meses
// ---------------------------------------------------------------------------

/**
 * Salva o ano inteiro de uma vez, do jeito que o analista trabalha: uma tela com
 * os 12 meses. Meses já FECHADOS são ignorados (a trava é o ponto do fechamento).
 */
export async function salvarResultadoAno(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireContabilEditor();

  const empresaId = String(formData.get("empresaId") ?? "");
  const ano = Number(formData.get("ano"));
  if (!empresaId || !ano) return { ok: false, error: "Empresa e ano são obrigatórios." };

  const empresa = await prisma.empresaContabil.findUnique({ where: { id: empresaId } });
  if (!empresa) return { ok: false, error: "Empresa não encontrada." };

  const periodos = periodosDoAno(ano);
  const existentes = await prisma.competenciaContabil.findMany({
    where: { empresaId, periodo: { in: periodos } },
  });
  const porPeriodo = new Map(existentes.map((c) => [c.periodo, c]));

  const gravar: { periodo: string; faturamento: number; despesas: number }[] = [];
  for (const periodo of periodos) {
    const atual = porPeriodo.get(periodo);
    if (atual?.status === "FECHADA") continue;

    const faturamento = parseValorBR(formData.get(`fat_${periodo}`));
    const despesas = parseValorBR(formData.get(`desp_${periodo}`));

    // Nada a fazer se o mês não existe e continua zerado — evita criar 12 linhas
    // vazias por ano para toda empresa.
    if (!atual && faturamento === 0 && despesas === 0) continue;
    if (atual && atual.faturamento === faturamento && atual.despesas === despesas) continue;

    gravar.push({ periodo, faturamento, despesas });
  }

  if (gravar.length === 0) return { ok: true };

  await prisma.$transaction(
    gravar.map((g) =>
      prisma.competenciaContabil.upsert({
        where: { empresaId_periodo: { empresaId, periodo: g.periodo } },
        create: { empresaId, periodo: g.periodo, faturamento: g.faturamento, despesas: g.despesas },
        update: { faturamento: g.faturamento, despesas: g.despesas },
      }),
    ),
  );

  revalidarContabil();
  return { ok: true };
}

export async function salvarObservacaoCompetencia(
  competenciaId: string,
  observacoes: string,
): Promise<ActionResult> {
  await requireContabilEditor();

  const competencia = await prisma.competenciaContabil.findUnique({ where: { id: competenciaId } });
  if (!competencia) return { ok: false, error: "Competência não encontrada." };
  if (competencia.status === "FECHADA") {
    return { ok: false, error: "Mês fechado. Reabra antes de editar." };
  }

  await prisma.competenciaContabil.update({
    where: { id: competenciaId },
    data: { observacoes: observacoes.trim() || null },
  });

  revalidarContabil();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Impostos
// ---------------------------------------------------------------------------

/** Salva a matriz mês x tributo de um ano (a segunda planilha do analista). */
export async function salvarImpostosAno(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireContabilEditor();

  const empresaId = String(formData.get("empresaId") ?? "");
  const ano = Number(formData.get("ano"));
  if (!empresaId || !ano) return { ok: false, error: "Empresa e ano são obrigatórios." };

  const tipos = await prisma.tipoImposto.findMany({ where: { ativo: true } });
  const periodos = periodosDoAno(ano);

  const competencias = await prisma.competenciaContabil.findMany({
    where: { empresaId, periodo: { in: periodos } },
    include: { impostos: true },
  });
  const porPeriodo = new Map(competencias.map((c) => [c.periodo, c]));

  type Pendente = { periodo: string; tipoId: string; valor: number };
  const pendentes: Pendente[] = [];

  for (const periodo of periodos) {
    const competencia = porPeriodo.get(periodo);
    if (competencia?.status === "FECHADA") continue;

    for (const tipo of tipos) {
      const bruto = formData.get(`imp_${periodo}_${tipo.id}`);
      if (bruto === null) continue;
      const valor = parseValorBR(bruto);
      const atual = competencia?.impostos.find((i) => i.tipoId === tipo.id);

      if (!atual && valor === 0) continue;
      if (atual && atual.valor === valor) continue;

      pendentes.push({ periodo, tipoId: tipo.id, valor });
    }
  }

  if (pendentes.length === 0) return { ok: true };

  await prisma.$transaction(async (tx) => {
    // A competência é criada sob demanda: lançar imposto num mês ainda sem
    // faturamento é normal (retenção, guia de ajuste), e a linha do mês precisa
    // existir para pendurar o imposto.
    const idsPorPeriodo = new Map<string, string>();
    for (const periodo of new Set(pendentes.map((p) => p.periodo))) {
      const competencia = await tx.competenciaContabil.upsert({
        where: { empresaId_periodo: { empresaId, periodo } },
        create: { empresaId, periodo },
        update: {},
      });
      idsPorPeriodo.set(periodo, competencia.id);
    }

    for (const p of pendentes) {
      const competenciaId = idsPorPeriodo.get(p.periodo)!;
      await tx.impostoApurado.upsert({
        where: { competenciaId_tipoId: { competenciaId, tipoId: p.tipoId } },
        create: { competenciaId, tipoId: p.tipoId, valor: p.valor },
        update: { valor: p.valor },
      });
    }
  });

  revalidarContabil();
  return { ok: true };
}

const pagamentoSchema = z.object({
  status: z.enum(["PENDENTE", "PAGO"]),
  vencimento: z.string().optional(),
  dataPagamento: z.string().optional(),
  valorPago: z.string().optional(),
  documento: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
});

/** Controle da guia: vencimento, baixa do pagamento, nº do documento. */
export async function salvarPagamentoImposto(
  impostoId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireContabilEditor();

  const parsed = pagamentoSchema.safeParse({
    status: formData.get("status"),
    vencimento: formData.get("vencimento") || undefined,
    dataPagamento: formData.get("dataPagamento") || undefined,
    valorPago: formData.get("valorPago") || undefined,
    documento: formData.get("documento") || undefined,
    observacoes: formData.get("observacoes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const imposto = await prisma.impostoApurado.findUnique({
    where: { id: impostoId },
    include: { competencia: true },
  });
  if (!imposto) return { ok: false, error: "Imposto não encontrado." };
  if (imposto.competencia.status === "FECHADA") {
    return { ok: false, error: "Mês fechado. Reabra antes de editar." };
  }

  const pago = parsed.data.status === "PAGO";
  const dataPagamento = dataDeInput(parsed.data.dataPagamento);
  if (pago && !dataPagamento) {
    return { ok: false, error: "Informe a data do pagamento para marcar como pago." };
  }

  const valorPagoBruto = parsed.data.valorPago?.trim();

  await prisma.impostoApurado.update({
    where: { id: impostoId },
    data: {
      status: parsed.data.status,
      vencimento: dataDeInput(parsed.data.vencimento),
      // Ao voltar para PENDENTE, a baixa é limpa — não faz sentido guardar data
      // de pagamento de algo que está em aberto.
      dataPagamento: pago ? dataPagamento : null,
      valorPago: pago && valorPagoBruto ? parseValorBR(valorPagoBruto) : null,
      documento: parsed.data.documento || null,
      observacoes: parsed.data.observacoes || null,
    },
  });

  revalidarContabil();
  return { ok: true };
}

export async function baixarImpostoRapido(impostoId: string): Promise<ActionResult> {
  await requireContabilEditor();

  const imposto = await prisma.impostoApurado.findUnique({
    where: { id: impostoId },
    include: { competencia: true },
  });
  if (!imposto) return { ok: false, error: "Imposto não encontrado." };
  if (imposto.competencia.status === "FECHADA") {
    return { ok: false, error: "Mês fechado. Reabra antes de editar." };
  }

  const jaPago = imposto.status === "PAGO";
  await prisma.impostoApurado.update({
    where: { id: impostoId },
    data: jaPago
      ? { status: "PENDENTE", dataPagamento: null, valorPago: null }
      : { status: "PAGO", dataPagamento: new Date() },
  });

  revalidarContabil();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Fechamento
// ---------------------------------------------------------------------------

export async function fecharCompetencia(
  empresaId: string,
  periodo: string,
): Promise<ActionResult> {
  const user = await requireContabilEditor();

  const competencia = await prisma.competenciaContabil.findUnique({
    where: { empresaId_periodo: { empresaId, periodo } },
  });
  if (!competencia) {
    return { ok: false, error: "Não há nada lançado neste mês para fechar." };
  }
  if (competencia.status === "FECHADA") return { ok: true };

  await prisma.competenciaContabil.update({
    where: { id: competencia.id },
    data: {
      status: "FECHADA",
      fechadaEm: new Date(),
      fechadaPorId: user.id,
      fechadaPor: user.name ?? user.username,
    },
  });

  revalidarContabil();
  return { ok: true };
}

export async function reabrirCompetencia(
  empresaId: string,
  periodo: string,
): Promise<ActionResult> {
  const user = await requireContabilEditor();
  // Reabrir desfaz um fechamento já comunicado — fica só com o ADMIN.
  if (user.role !== "ADMIN") {
    return { ok: false, error: "Somente o administrador pode reabrir um mês fechado." };
  }

  const competencia = await prisma.competenciaContabil.findUnique({
    where: { empresaId_periodo: { empresaId, periodo } },
  });
  if (!competencia) return { ok: false, error: "Competência não encontrada." };

  await prisma.competenciaContabil.update({
    where: { id: competencia.id },
    data: { status: "ABERTA", fechadaEm: null, fechadaPorId: null, fechadaPor: null },
  });

  revalidarContabil();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Leitura auxiliar (usada pelas telas cliente que trocam de ano sem recarregar)
// ---------------------------------------------------------------------------

export async function empresasAtivas() {
  await requireContabilAccess();
  return prisma.empresaContabil.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });
}
