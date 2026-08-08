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
  fichas: FichaDuplicada[];
};

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

  const porChave = new Map<string, typeof funcionarios>();
  for (const f of funcionarios) {
    const k = chaveNome(f.nome);
    porChave.set(k, [...(porChave.get(k) ?? []), f]);
  }

  return [...porChave.entries()]
    .filter(([, grupo]) => grupo.length > 1)
    .map(([chave, grupo]) => ({
      chave,
      fichas: grupo
        .map((f) => {
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
        })
        // Ficha mais antiga primeiro — normalmente é a "oficial".
        .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    }))
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
