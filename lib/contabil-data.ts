import { prisma } from "@/lib/prisma";
import { periodoAtual } from "@/lib/periodo";
import {
  periodosDoAno,
  mesDoPeriodo,
  type LinhaMes,
  type StatusCompetencia,
} from "@/lib/contabil";

export type ImpostoCelula = {
  id: string;
  tipoId: string;
  valor: number;
  status: "PENDENTE" | "PAGO";
  vencimento: Date | null;
  dataPagamento: Date | null;
  valorPago: number | null;
  documento: string | null;
  observacoes: string | null;
};

export type MesContabil = {
  periodo: string;
  mes: number;
  competenciaId: string | null;
  faturamento: number;
  despesas: number;
  status: StatusCompetencia;
  fechadaEm: Date | null;
  fechadaPor: string | null;
  observacoes: string | null;
  impostos: ImpostoCelula[];
};

export type TipoImpostoLista = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
};

export type DadosAno = {
  meses: MesContabil[];
  linhas: LinhaMes[];
  tipos: TipoImpostoLista[];
};

/**
 * Carrega o ano completo de uma empresa já normalizado em 12 meses — os meses
 * sem lançamento vêm zerados, não ausentes. As telas então nunca precisam
 * tratar "buraco no meio do ano", que é a origem clássica de erro nessas
 * planilhas.
 */
export async function carregarAno(empresaId: string, ano: number): Promise<DadosAno> {
  const periodos = periodosDoAno(ano);

  const [competencias, tipos] = await Promise.all([
    prisma.competenciaContabil.findMany({
      where: { empresaId, periodo: { in: periodos } },
      include: { impostos: true },
    }),
    prisma.tipoImposto.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
  ]);

  const porPeriodo = new Map(competencias.map((c) => [c.periodo, c]));

  const meses: MesContabil[] = periodos.map((periodo) => {
    const c = porPeriodo.get(periodo);
    return {
      periodo,
      mes: mesDoPeriodo(periodo),
      competenciaId: c?.id ?? null,
      faturamento: c?.faturamento ?? 0,
      despesas: c?.despesas ?? 0,
      status: (c?.status as StatusCompetencia) ?? "ABERTA",
      fechadaEm: c?.fechadaEm ?? null,
      fechadaPor: c?.fechadaPor ?? null,
      observacoes: c?.observacoes ?? null,
      impostos:
        c?.impostos.map((i) => ({
          id: i.id,
          tipoId: i.tipoId,
          valor: i.valor,
          status: i.status as "PENDENTE" | "PAGO",
          vencimento: i.vencimento,
          dataPagamento: i.dataPagamento,
          valorPago: i.valorPago,
          documento: i.documento,
          observacoes: i.observacoes,
        })) ?? [],
    };
  });

  const linhas: LinhaMes[] = meses.map((m) => {
    const impostos = m.impostos.reduce((s, i) => s + i.valor, 0);
    const impostosPagos = m.impostos
      .filter((i) => i.status === "PAGO")
      .reduce((s, i) => s + (i.valorPago ?? i.valor), 0);
    const lucro = m.faturamento - m.despesas;
    return {
      periodo: m.periodo,
      mes: m.mes,
      faturamento: m.faturamento,
      despesas: m.despesas,
      lucro,
      impostos,
      impostosPagos,
      impostosPendentes: m.impostos
        .filter((i) => i.status === "PENDENTE")
        .reduce((s, i) => s + i.valor, 0),
      lucroAposImpostos: lucro - impostos,
      status: m.status,
    };
  });

  return { meses, linhas, tipos };
}

/** Anos que já têm lançamento (para o seletor), sempre incluindo o ano corrente. */
export async function anosDisponiveis(anoCorrente: number): Promise<number[]> {
  const registros = await prisma.competenciaContabil.findMany({
    select: { periodo: true },
    distinct: ["periodo"],
    orderBy: { periodo: "asc" },
  });

  const anos = new Set(registros.map((r) => Number(r.periodo.slice(0, 4))));
  anos.add(anoCorrente);
  return Array.from(anos).sort((a, b) => b - a);
}

/**
 * Resolve o par (empresa, ano) que todas as telas do módulo compartilham via
 * query string. Sem empresa na URL, cai na primeira ativa; sem ano, no corrente.
 */
export async function contextoContabil(params: { empresa?: string; ano?: string }) {
  const empresas = await prisma.empresaContabil.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  const anoCorrente = Number(periodoAtual().slice(0, 4));
  const anos = await anosDisponiveis(anoCorrente);

  const empresaId = empresas.some((e) => e.id === params.empresa)
    ? params.empresa!
    : (empresas[0]?.id ?? null);

  const anoParam = Number(params.ano);
  const ano = Number.isInteger(anoParam) && anoParam > 2000 ? anoParam : anoCorrente;

  return { empresas, empresaId, anos, ano };
}

/** Guias em aberto de todas as empresas — alimenta o alerta do painel. */
export async function guiasEmAberto(limite = 20) {
  const impostos = await prisma.impostoApurado.findMany({
    where: { status: "PENDENTE", valor: { gt: 0 } },
    include: { tipo: true, competencia: { include: { empresa: true } } },
    orderBy: [{ vencimento: "asc" }, { competencia: { periodo: "asc" } }],
    take: limite,
  });

  return impostos.map((i) => ({
    id: i.id,
    empresa: i.competencia.empresa.nome,
    periodo: i.competencia.periodo,
    tipo: i.tipo.nome,
    valor: i.valor,
    vencimento: i.vencimento,
  }));
}
