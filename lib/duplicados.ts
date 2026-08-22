import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAlteracao } from "@/lib/auditoria";
import { recalcularFechamento } from "@/lib/bonificacao";

// Detecção e unificação de cadastros duplicados de funcionário.
//
// A origem das duplicatas é a importação do Elleven: vendedor cujo nome não
// bate com ninguém do cadastro vira funcionário NOVO, então "MARIA J SILVA" e
// "Maria Jose da Silva" acabam como duas fichas — cada uma recebendo de uma
// fonte, e cada uma somando à meta da equipe em que estiver.
//
// Regras decididas pela diretoria (08/08/2026):
//  - o sistema APONTA a suspeita e só unifica com confirmação humana;
//  - unificar move os lançamentos dos meses ABERTOS para a ficha mantida;
//    mês FECHADO fica exatamente como foi pago — a ficha duplicada é
//    desativada (nunca apagada), e o histórico dela permanece;
//  - tudo registrado na auditoria, com o "antes" completo.

// Mesma chave da auditoria semanal (app/api/cron/auditoria): contador e lista
// precisam ser o mesmo universo, senão o número do alerta não bate com a tela.
export function chaveNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/(DE|DA|DO|DAS|DOS|E)/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export type FichaDuplicada = {
  id: string;
  nome: string;
  cargo: string;
  cpf: string | null;
  cidade: string | null;
  equipe: string | null;
  criadoEm: string;
  lancamentos: number;
  /** Períodos com lançamento e a situação de cada um (ABERTO/FECHADO). */
  periodos: { periodo: string; status: string; vendas: number }[];
};

export type GrupoSuspeito = {
  chave: string;
  /** Por que estas fichas foram agrupadas (ex.: "mesmo CPF", "grafia parecida"). */
  motivo: string;
  fichas: FichaDuplicada[];
};

// --- Similaridade de nomes -------------------------------------------------
// Serve só para SUGERIR grupos ao humano; a unificação continua sendo uma
// decisão manual, uma a uma. Por isso o objetivo é pescar candidatos de mais
// (typo, abreviação, nome parcial, prefixo colado como "(SERASA)"), sem casar
// pessoas obviamente diferentes — o primeiro nome sempre tem que bater.

const PARTICULAS_DEDUP = new Set(["de", "da", "do", "dos", "das", "e"]);

// Tokens já limpos para comparar: sem acento, minúsculo, SEM pontuação (resolve
// "(SERASA)JACIELE" e "V."), sem partículas e sem token que é só número (o "17"
// de "... - VC 17").
function tokensDedup(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !PARTICULAS_DEDUP.has(t) && !/^\d+$/.test(t));
}

// Distância de edição (Levenshtein) — pega erro de digitação.
function distancia(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Dois tokens "parecem o mesmo": iguais, um é abreviação do outro
// ("v" ~ "vitorino", "fern" ~ "fernandes") ou é um erro de digitação.
function tokenParecido(a: string, b: string): boolean {
  if (a === b) return true;
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a];
  if (curto.length >= 1 && curto.length <= 4 && longo.length > curto.length && longo.startsWith(curto)) {
    return true;
  }
  const lim = longo.length <= 4 ? 1 : 2;
  return Math.abs(a.length - b.length) <= 2 && distancia(a, b) <= lim;
}

// Nome curto (>=2 tokens) contido, na ordem, no nome longo — pega "Larissa
// Ferreira" dentro de "Larissa Ferreira dos Santos".
function contidoEmOrdem(menor: string[], maior: string[]): boolean {
  if (menor.length < 2 || maior.length <= menor.length) return false;
  let i = 0;
  for (const t of maior) {
    if (t === menor[i]) i++;
    if (i === menor.length) return true;
  }
  return false;
}

// Mesma quantidade de tokens (>=2) e todos parecidos na mesma posição — pega
// "JEFERSON LIMA MIRANDA" vs "JEFFERSON LIMA MIRANDA" e "CLEBER SOUGLAS V. DA
// SILVA" vs "CLEBER DOUGLAS VITORINO DA SILVA".
function grafiaParecida(a: string[], b: string[]): boolean {
  if (a.length < 2 || a.length !== b.length) return false;
  return a.every((t, i) => tokenParecido(t, b[i]));
}

function cpfDigitos(cpf: string | null): string | null {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? d : null;
}

type IndiceFicha = { chave: string; tokens: string[]; cpf: string | null };

// O motivo (mais forte) pelo qual duas fichas são suspeitas — null se não são.
function motivoSuspeita(a: IndiceFicha, b: IndiceFicha): string | null {
  if (a.cpf && b.cpf && a.cpf === b.cpf) return "mesmo CPF";
  if (a.chave && a.chave === b.chave) return "nome idêntico";
  if (contidoEmOrdem(a.tokens, b.tokens) || contidoEmOrdem(b.tokens, a.tokens)) {
    return "um nome contém o outro";
  }
  if (grafiaParecida(a.tokens, b.tokens)) return "grafia parecida";
  return null;
}

const ORDEM_MOTIVO = [
  "mesmo CPF",
  "nome idêntico",
  "um nome contém o outro",
  "grafia parecida",
];

export async function listarSuspeitasDeDuplicidade(): Promise<GrupoSuspeito[]> {
  const funcionarios = await prisma.funcionario.findMany({
    where: { ativo: true },
    include: {
      cidade: { select: { nome: true } },
      equipe: { select: { nome: true } },
      lancamentos: { select: { periodo: true, quantidade: true } },
    },
  });

  const fechamentos = await prisma.fechamentoMensal.findMany({
    select: { periodo: true, status: true },
  });
  const statusDoPeriodo = new Map(fechamentos.map((f) => [f.periodo, f.status]));

  // Índice de comparação por ficha (calculado uma vez).
  const idx: IndiceFicha[] = funcionarios.map((f) => ({
    chave: chaveNome(f.nome),
    tokens: tokensDedup(f.nome),
    cpf: cpfDigitos(f.cpf),
  }));

  // União de componentes conexos: cada par suspeito é uma aresta; o grupo é o
  // componente. Assim "A~B" e "B~C" caem no mesmo grupo — as três fichas de
  // JACIELE, por exemplo, viram um grupo só.
  const pai = funcionarios.map((_, i) => i);
  const acha = (x: number): number => (pai[x] === x ? x : (pai[x] = acha(pai[x])));
  const arestas: { i: number; motivo: string }[] = [];

  for (let i = 0; i < funcionarios.length; i++) {
    for (let j = i + 1; j < funcionarios.length; j++) {
      const motivo = motivoSuspeita(idx[i], idx[j]);
      if (!motivo) continue;
      arestas.push({ i, motivo });
      const ri = acha(i);
      const rj = acha(j);
      if (ri !== rj) pai[ri] = rj;
    }
  }

  // Motivos por componente (com as uniões já resolvidas).
  const motivosDoGrupo = new Map<number, Set<string>>();
  for (const { i, motivo } of arestas) {
    const r = acha(i);
    const set = motivosDoGrupo.get(r) ?? new Set<string>();
    set.add(motivo);
    motivosDoGrupo.set(r, set);
  }

  const grupos = new Map<number, number[]>();
  for (let i = 0; i < funcionarios.length; i++) {
    const r = acha(i);
    grupos.set(r, [...(grupos.get(r) ?? []), i]);
  }

  const montarFicha = (f: (typeof funcionarios)[number]): FichaDuplicada => {
    const porPeriodo = new Map<string, number>();
    for (const l of f.lancamentos) {
      porPeriodo.set(l.periodo, (porPeriodo.get(l.periodo) ?? 0) + l.quantidade);
    }
    return {
      id: f.id,
      nome: f.nome,
      cargo: f.cargo,
      cpf: f.cpf,
      cidade: f.cidade?.nome ?? null,
      equipe: f.equipe?.nome ?? null,
      criadoEm: f.createdAt.toISOString().slice(0, 10),
      lancamentos: f.lancamentos.length,
      periodos: [...porPeriodo.entries()]
        .map(([periodo, vendas]) => ({
          periodo,
          status: statusDoPeriodo.get(periodo) ?? "ABERTO",
          vendas,
        }))
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    };
  };

  return [...grupos.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([raiz, indices]) => {
      const fichas = indices
        .map((i) => montarFicha(funcionarios[i]))
        // Ficha mais antiga primeiro — normalmente é a "oficial".
        .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
      const motivos = [...(motivosDoGrupo.get(raiz) ?? new Set<string>())];
      const motivo =
        ORDEM_MOTIVO.find((m) => motivos.includes(m)) ?? motivos[0] ?? "possível duplicidade";
      return {
        chave: fichas
          .map((f) => f.id)
          .sort()
          .join("-"),
        motivo,
        fichas,
      };
    })
    .sort((a, b) => a.fichas[0].nome.localeCompare(b.fichas[0].nome, "pt-BR"));
}

export type ResultadoUnificacao = {
  lancamentosMovidos: number;
  periodosRecalculados: string[];
  periodosFechadosPreservados: string[];
};

export async function unificarFuncionarios(params: {
  manterId: string;
  removerId: string;
  usuarioId: string;
  usuarioNome: string;
}): Promise<ResultadoUnificacao> {
  const { manterId, removerId, usuarioId, usuarioNome } = params;
  if (manterId === removerId) {
    throw new Error("As duas fichas selecionadas são a mesma.");
  }

  const [manter, remover] = await Promise.all([
    prisma.funcionario.findUnique({
      where: { id: manterId },
      include: { lancamentos: { select: { periodo: true } } },
    }),
    prisma.funcionario.findUnique({
      where: { id: removerId },
      include: { lancamentos: { select: { id: true, periodo: true } } },
    }),
  ]);
  if (!manter || !remover) throw new Error("Ficha não encontrada.");

  const fechamentos = await prisma.fechamentoMensal.findMany({
    select: { periodo: true, status: true },
  });
  const fechados = new Set(
    fechamentos.filter((f) => f.status === "FECHADO").map((f) => f.periodo),
  );

  const periodosDoRemovido = [...new Set(remover.lancamentos.map((l) => l.periodo))];
  const periodosAbertos = periodosDoRemovido.filter((p) => !fechados.has(p));
  const periodosFechados = periodosDoRemovido.filter((p) => fechados.has(p));

  let lancamentosMovidos = 0;
  await prisma.$transaction(async (tx) => {
    // Lançamentos dos meses ABERTOS passam para a ficha mantida. Os dos meses
    // FECHADOS ficam na ficha desativada: são o documento do que foi pago.
    if (periodosAbertos.length > 0) {
      const movidos = await tx.lancamentoVenda.updateMany({
        where: { funcionarioId: removerId, periodo: { in: periodosAbertos } },
        data: { funcionarioId: manterId },
      });
      lancamentosMovidos = movidos.count;
    }

    // Se a ficha removida supervisiona alguma equipe, a supervisão passa
    // junto — equipe sem responsável quebraria o bônus de equipe em silêncio.
    await tx.equipe.updateMany({
      where: { supervisorId: removerId },
      data: { supervisorId: manterId },
    });

    // CPF e Telegram são únicos: saem PRIMEIRO da ficha removida, para não
    // colidirem quando entrarem na mantida dentro da mesma transação.
    const migraCpf = !manter.cpf && !!remover.cpf;
    await tx.funcionario.update({
      where: { id: removerId },
      data: {
        ativo: false,
        cpf: migraCpf ? null : remover.cpf,
        telegramChatId: null,
        equipeId: null,
      },
    });

    // Dados que a ficha mantida não tem e a removida tem: aproveita — CPF,
    // contato e equipe são difíceis de reconstituir depois.
    await tx.funcionario.update({
      where: { id: manterId },
      data: {
        cpf: migraCpf ? remover.cpf : undefined,
        email: manter.email ?? remover.email,
        telegramChatId: manter.telegramChatId ?? remover.telegramChatId,
        cidadeId: manter.cidadeId ?? remover.cidadeId,
        equipeId: manter.equipeId ?? remover.equipeId,
      },
    });
  });

  await registrarAlteracao({
    acao: "FUNCIONARIO_UNIFICADO",
    usuarioId,
    usuarioNome,
    alvo: manter.nome,
    resumo:
      `Unificou "${remover.nome}" em "${manter.nome}": ${lancamentosMovidos} lançamento(s) ` +
      `movido(s) (${periodosAbertos.join(", ") || "nenhum período aberto"}); ` +
      `ficha duplicada desativada` +
      (periodosFechados.length
        ? `; meses fechados preservados na ficha antiga: ${periodosFechados.join(", ")}.`
        : "."),
    antes: {
      manter: { id: manter.id, nome: manter.nome, cpf: manter.cpf, equipeId: manter.equipeId },
      remover: {
        id: remover.id,
        nome: remover.nome,
        cpf: remover.cpf,
        equipeId: remover.equipeId,
        lancamentosPorPeriodo: periodosDoRemovido,
      },
    },
    depois: { manterId, removidoDesativado: removerId, lancamentosMovidos },
  });

  // Meses abertos que mudaram de dono recalculam na hora — o fechamento
  // aberto sempre reflete o cadastro atual.
  for (const periodo of periodosAbertos) {
    await recalcularFechamento(periodo);
  }

  return {
    lancamentosMovidos,
    periodosRecalculados: periodosAbertos,
    periodosFechadosPreservados: periodosFechados,
  };
}
