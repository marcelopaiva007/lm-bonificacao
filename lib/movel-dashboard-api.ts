import "server-only";

// Cliente da API EXTERNA agregada do dashboard de vendas do L&M Móvel
// (https://movel.assinelm.com/api/v1/vendas/dashboard). É uma API pública para
// consumidores externos, autenticada por um token estático (Bearer), separada
// da API interna login+JWT que o lib/chip-movel.ts usa para puxar as vendas
// linha a linha.
//
// Aqui NÃO calculamos bônus nem gravamos lançamentos: esta API só devolve
// agregados oficiais (KPIs, ranking, planos, metas). Ela é usada pela
// conferência diária (lib/chip-movel-conferencia.ts) para validar que o que a
// bonificação apurou a partir do snapshot linha-a-linha bate com o painel
// oficial do L&M Móvel, e para expor KPIs que o caminho linha-a-linha não tem
// (churn, base inicial, revenue churn).
//
// Variáveis de ambiente:
//   MOVEL_DASHBOARD_TOKEN — token Bearer da API externa (segredo forte; NÃO é
//     o MOVEL_LOGIN/MOVEL_PASSWORD, e não deve ser commitado)
//   MOVEL_API_BASE — opcional, mesmo default do chip-movel
//     (https://movel.assinelm.com/api); a rota externa fica em /v1/vendas/dashboard

const MOVEL_API_BASE_DEFAULT = "https://movel.assinelm.com/api";

// ---- Envelope de resposta (idêntico em todas as rotas) ----------------------

export type DashboardKpis = {
  linhas_vendidas: number;
  receita_recorrente: number;
  comissoes: number;
  churn: { quantidade: number; percentual: number };
  revenue_churn: number;
  base_inicial: number;
};

export type DashboardVendaDia = { data: string; quantidade: number };

export type DashboardRankingVendedor = {
  posicao: number;
  vendedor: string;
  linhas: number;
  valor: number;
};

export type DashboardPlano = {
  plano: string;
  quantidade: number;
  percentual: number;
};

export type DashboardMeta = {
  meta: string;
  escopo: string;
  realizado: number;
  alvo: number;
  atingimento: number;
};

export type DashboardData = {
  kpis: DashboardKpis;
  vendas_por_dia: DashboardVendaDia[];
  ranking_vendedores: DashboardRankingVendedor[];
  planos_vendidos: DashboardPlano[];
  atingimento_metas: DashboardMeta[];
};

export type DashboardMetaEnvelope = {
  mes: number;
  ano: number;
  gerado_em: string;
};

type SucessoEnvelope<T> = {
  success: true;
  data: T;
  meta: DashboardMetaEnvelope;
};

type ErroEnvelope = {
  success: false;
  error: { code: string; message: string; details: unknown };
};

// Erro tipado da API externa: preserva o código de negócio (VALIDATION_ERROR,
// UNAUTHORIZED, RATE_LIMITED, INTERNAL_ERROR) e o HTTP status, para a
// conferência distinguir "token errado" de "mês inválido" de "instabilidade".
export class MovelDashboardApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "MovelDashboardApiError";
  }
}

function baseUrl(): string {
  const base = process.env.MOVEL_API_BASE || MOVEL_API_BASE_DEFAULT;
  return `${base}/v1/vendas/dashboard`;
}

async function getBloco<T>(path: string, mes: number, ano: number): Promise<T> {
  const token = process.env.MOVEL_DASHBOARD_TOKEN;
  if (!token) {
    throw new MovelDashboardApiError(
      0,
      "CONFIG",
      "MOVEL_DASHBOARD_TOKEN não configurado nas env vars.",
    );
  }
  const url = `${baseUrl()}${path}?mes=${mes}&ano=${ano}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // resposta sem corpo JSON (ex.: 502 do proxy) — tratada abaixo pelo status
  }

  if (!res.ok || (body as ErroEnvelope)?.success === false) {
    const err = (body as ErroEnvelope)?.error;
    throw new MovelDashboardApiError(
      res.status,
      err?.code ?? "HTTP_ERROR",
      err?.message ?? `Falha na API externa do L&M Móvel (HTTP ${res.status}).`,
      err?.details ?? null,
    );
  }

  return (body as SucessoEnvelope<T>).data;
}

// Rota agregada completa. Uma única chamada traz tudo — preferível ao invés de
// bater nas 5 rotas de bloco quando se quer o dashboard inteiro (economiza no
// rate limit de 60 req/min por IP).
export function fetchDashboard(
  mes: number,
  ano: number,
): Promise<DashboardData> {
  return getBloco<DashboardData>("", mes, ano);
}

// Rotas de bloco — úteis quando só se precisa de uma fatia.
export const fetchKpis = (mes: number, ano: number) =>
  getBloco<DashboardKpis>("/kpis", mes, ano);
export const fetchVendasPorDia = (mes: number, ano: number) =>
  getBloco<DashboardVendaDia[]>("/vendas-por-dia", mes, ano);
export const fetchRankingVendedores = (mes: number, ano: number) =>
  getBloco<DashboardRankingVendedor[]>("/ranking-vendedores", mes, ano);
export const fetchPlanosVendidos = (mes: number, ano: number) =>
  getBloco<DashboardPlano[]>("/planos-vendidos", mes, ano);
export const fetchAtingimentoMetas = (mes: number, ano: number) =>
  getBloco<DashboardMeta[]>("/atingimento-metas", mes, ano);

// Converte um período "AAAA-MM" nos parâmetros mes/ano da API.
export function periodoParaMesAno(periodo: string): { mes: number; ano: number } {
  const [ano, mes] = periodo.split("-").map(Number);
  return { mes, ano };
}
