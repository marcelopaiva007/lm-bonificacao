import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { Prisma } from "@/app/generated/prisma/client";

export type AcaoAuditoria =
  | "CRIAR"
  | "EDITAR"
  | "EXCLUIR"
  | "FECHAR_MES"
  | "REABRIR_MES"
  | "RECALCULAR"
  | "MESCLAR"
  | "IMPORTAR";

export type ModuloAuditoria =
  | "FUNCIONARIOS"
  | "LANCAMENTOS"
  | "REGRAS"
  | "FECHAMENTO"
  | "IMPORTACAO"
  | "ELLEVEN"
  | "CIDADES"
  | "EQUIPES"
  | "USUARIOS"
  | "AUTENTICACAO";

let auditTableEnsured = true;

async function ensureAuditLogTable(): Promise<void> {
  if (auditTableEnsured) return;
  auditTableEnsured = true;
}

export async function registrarAuditoria(params: {
  acao: AcaoAuditoria;
  modulo: ModuloAuditoria;
  detalhes: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  try {
    await ensureAuditLogTable();
    const session = await auth();

    const usuarioId = session?.user?.id ?? null;
    const usuarioNome = session?.user?.name ?? "Sistema / Automático";
    const usuarioRole = session?.user?.role ?? null;

    await prisma.auditLog.create({
      data: {
        usuarioId,
        usuarioNome,
        usuarioRole,
        acao: params.acao,
        modulo: params.modulo,
        detalhes: params.detalhes,
        metadataJson: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
        ip: params.ip ?? null,
      },
    });
  } catch (err) {
    console.error("Erro ao gravar trilha de auditoria:", err);
  }
}

export type AuditLogFiltros = {
  modulo?: string;
  acao?: string;
  busca?: string;
  periodo?: string; // "AAAA-MM"
};

export async function getAuditLogs(filtros?: AuditLogFiltros) {
  await ensureAuditLogTable();

  const where: Record<string, unknown> = {};

  if (filtros?.modulo && filtros.modulo !== "TODOS") {
    where.modulo = filtros.modulo;
  }

  if (filtros?.acao && filtros.acao !== "TODAS") {
    where.acao = filtros.acao;
  }

  if (filtros?.periodo && /^\d{4}-\d{2}$/.test(filtros.periodo)) {
    const [ano, mes] = filtros.periodo.split("-").map(Number);
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59));
    where.createdAt = { gte: inicio, lte: fim };
  }

  if (filtros?.busca) {
    const b = filtros.busca.trim();
    where.OR = [
      { usuarioNome: { contains: b } },
      { detalhes: { contains: b } },
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return logs.map((l) => ({
    id: l.id,
    usuarioNome: l.usuarioNome,
    usuarioRole: l.usuarioRole ?? "—",
    acao: l.acao,
    modulo: l.modulo,
    detalhes: l.detalhes,
    dataHora: l.createdAt,
    metadata: l.metadataJson,
  }));
}
