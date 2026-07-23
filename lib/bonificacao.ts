import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  asRegraConfig,
  calcularBonificacaoIndividual,
  calcularBonificacaoSupervisor,
  periodoParaIntervalo,
  somaLancamentos,
  type BonificacaoSupervisor,
  type LancamentoAgregado,
  type RegraConfig,
} from "@/lib/bonificacao-calc";

// Reexporta a API de cálculo puro para que os consumidores continuem importando
// tudo de "@/lib/bonificacao".
export * from "@/lib/bonificacao-calc";

// Equipe com os ids dos membros ativos — formato usado no cálculo do bônus de
// supervisor, pré-carregado fora da transação.
type EquipeComMembros = Prisma.EquipeGetPayload<{
  include: { membros: { select: { id: true } } };
}>;

export async function getRegraVigente(cargo: string, periodo: string) {
  const { fim } = periodoParaIntervalo(periodo);
  return prisma.regraBonificacao.findFirst({
    where: {
      cargo,
      vigenciaInicio: { lte: fim },
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: fim } }],
    },
    orderBy: { vigenciaInicio: "desc" },
  });
}

export async function recalcularFechamento(periodo: string) {
  const fechamento = await prisma.fechamentoMensal.upsert({
    where: { periodo },
    update: {},
    create: { periodo, status: "ABERTO" },
  });

  if (fechamento.status === "FECHADO") {
    return fechamento;
  }

  const funcionarios = await prisma.funcionario.findMany({
    where: { ativo: true },
    include: { equipe: true },
  });

  const lancamentos = await prisma.lancamentoVenda.findMany({ where: { periodo } });
  const lancamentosPorFuncionario = new Map<string, LancamentoAgregado[]>();
  for (const l of lancamentos) {
    const lista = lancamentosPorFuncionario.get(l.funcionarioId) ?? [];
    lista.push(l);
    lancamentosPorFuncionario.set(l.funcionarioId, lista);
  }

  // Total de vendas de INTERNET por equipe (base do bônus de supervisor, OS §3.2).
  const internetPorEquipe = new Map<string, number>();
  for (const f of funcionarios) {
    if (!f.equipeId) continue;
    const agregado = somaLancamentos(lancamentosPorFuncionario.get(f.id) ?? []);
    internetPorEquipe.set(
      f.equipeId,
      (internetPorEquipe.get(f.equipeId) ?? 0) + agregado.qtdInternet
    );
  }

  const configPorCargo = new Map<string, RegraConfig | null>();
  for (const cargo of ["VENDEDOR_EXTERNO", "ATENDIMENTO_ADM", "SUPERVISOR", "OUTRO_SETOR"]) {
    const regra = await getRegraVigente(cargo, periodo);
    configPorCargo.set(cargo, asRegraConfig(regra?.config));
  }

  // Equipes de cada supervisor carregadas de uma vez, ANTES da transação: antes
  // isso era um findMany por supervisor dentro do loop transacional (N+1), o que
  // estourava o timeout padrão de 5s do Prisma conforme o quadro crescia e
  // abortava o recálculo inteiro (P2028).
  const equipesPorSupervisor = new Map<string, EquipeComMembros[]>();
  const supervisorIds = funcionarios.filter((f) => f.cargo === "SUPERVISOR").map((f) => f.id);
  if (supervisorIds.length > 0) {
    const equipes = await prisma.equipe.findMany({
      where: { supervisorId: { in: supervisorIds } },
      include: { membros: { where: { ativo: true }, select: { id: true } } },
    });
    for (const equipe of equipes) {
      if (!equipe.supervisorId) continue;
      const lista = equipesPorSupervisor.get(equipe.supervisorId) ?? [];
      lista.push(equipe);
      equipesPorSupervisor.set(equipe.supervisorId, lista);
    }
  }

  let valorTotalVendido = 0;
  let valorTotalBonificacao = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const f of funcionarios) {
        const agregado = somaLancamentos(lancamentosPorFuncionario.get(f.id) ?? []);
        const config = configPorCargo.get(f.cargo) ?? null;
        const individual = calcularBonificacaoIndividual(agregado, config);

        let valorSupervisor = 0;
        const detalhes: Record<string, unknown> = { servicos: individual.detalhes };

        if (f.cargo === "SUPERVISOR" && config?.supervisor) {
          const equipesSupervisionadas = equipesPorSupervisor.get(f.id) ?? [];
          const detalhesEquipes: BonificacaoSupervisor[] = [];
          for (const equipe of equipesSupervisionadas) {
            // Conjunto único de ids: membros ativos + o próprio supervisor.
            const ids = new Set(equipe.membros.map((m) => m.id));
            ids.add(f.id);
            const tamanhoEquipe = ids.size;

            // Total de internet do time = internet dos membros vinculados +
            // internet do próprio supervisor (que pode não estar em `membros`).
            let totalInternet = internetPorEquipe.get(equipe.id) ?? 0;
            if (!equipe.membros.some((m) => m.id === f.id)) {
              totalInternet += agregado.qtdInternet;
            }

            const bonus = calcularBonificacaoSupervisor(
              config.supervisor,
              totalInternet,
              tamanhoEquipe
            );
            valorSupervisor += bonus.valor;
            detalhesEquipes.push(bonus);
          }
          detalhes.supervisor = detalhesEquipes;
        }

        const valorTotal =
          individual.valorInternet +
          individual.valorChip +
          individual.valorDemais +
          valorSupervisor;
        if (valorTotal === 0 && agregado.quantidade === 0) continue;

        valorTotalVendido += agregado.valorInstalado;
        valorTotalBonificacao += valorTotal;

        await tx.bonificacaoCalculada.upsert({
          where: { fechamentoId_funcionarioId: { fechamentoId: fechamento.id, funcionarioId: f.id } },
          update: {
            valorInternet: individual.valorInternet,
            valorChip: individual.valorChip,
            valorDemais: individual.valorDemais,
            valorSupervisor,
            valorTotal,
            detalhesJson: detalhes as Prisma.InputJsonValue,
          },
          create: {
            fechamentoId: fechamento.id,
            funcionarioId: f.id,
            valorInternet: individual.valorInternet,
            valorChip: individual.valorChip,
            valorDemais: individual.valorDemais,
            valorSupervisor,
            valorTotal,
            detalhesJson: detalhes as Prisma.InputJsonValue,
          },
        });
      }

      const ajustes = await tx.ajuste.findMany({ where: { periodo } });
      const totalAjustes = ajustes.reduce((acc, a) => acc + a.valor, 0);

      await tx.fechamentoMensal.update({
        where: { id: fechamento.id },
        data: {
          valorTotalVendido,
          valorTotalBonificacao: valorTotalBonificacao + totalAjustes,
        },
      });
    },
    // Margem folgada sobre os 5s padrão: o recálculo grava uma linha por
    // funcionário e roda também pelo cron, onde a latência até o banco é maior.
    { timeout: 120_000, maxWait: 20_000 }
  );

  return fechamento;
}
