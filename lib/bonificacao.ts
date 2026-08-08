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
  const todosCargos = [
    "VENDEDOR_EXTERNO",
    "ATENDIMENTO_ADM",
    "SUPERVISOR",
    "TECNICO",
    "VENDEDOR_AGREGADO",
    "GESTOR",
    "OUTRO_SETOR",
  ];
  for (const cargo of todosCargos) {
    const regra = await getRegraVigente(cargo, periodo);
    configPorCargo.set(cargo, asRegraConfig(regra?.config));
  }

  let valorTotalVendido = 0;
  let valorTotalBonificacao = 0;

  await prisma.$transaction(async (tx) => {
    for (const f of funcionarios) {
      const agregado = somaLancamentos(lancamentosPorFuncionario.get(f.id) ?? []);
      const config = configPorCargo.get(f.cargo) ?? null;
      const individual = calcularBonificacaoIndividual(agregado, config);

      let valorSupervisor = 0;
      const detalhes: Record<string, unknown> = {
        servicos: individual.detalhes,
        pagamento: config?.pagamento ?? (f.cargo === "TECNICO" ? "SEMANAL" : "MENSAL"),
      };

      // Cálculo de bônus de supervisor/responsável de equipe
      const equipesSupervisionadas = await tx.equipe.findMany({
        where: { supervisorId: f.id },
        include: { membros: { where: { ativo: true }, select: { id: true, cargo: true } } },
      });

      if (equipesSupervisionadas.length > 0) {
        const detalhesEquipes: BonificacaoSupervisor[] = [];
        let totalBonusTecnicos = 0;

        for (const equipe of equipesSupervisionadas) {
          // Bônus padrão de supervisor comercial (OS §3.2) se configurado
          if (config?.supervisor) {
            const ids = new Set(equipe.membros.map((m) => m.id));
            ids.add(f.id);
            const tamanhoEquipe = ids.size;

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

          // Bônus do responsável de técnicos: R$ 10 por cada venda de internet dos técnicos da equipe
          const membrosTecnicos = equipe.membros.filter((m) => m.cargo === "TECNICO");
          if (membrosTecnicos.length > 0) {
            const valorPorVendaTecnico = config?.bonusPorVendaTecnicoEquipe ?? 10;
            for (const tec of membrosTecnicos) {
              const agTec = somaLancamentos(lancamentosPorFuncionario.get(tec.id) ?? []);
              const bonusTec = agTec.qtdInternet * valorPorVendaTecnico;
              totalBonusTecnicos += bonusTec;
            }
          }
        }

        if (detalhesEquipes.length > 0) {
          detalhes.supervisor = detalhesEquipes;
        }
        if (totalBonusTecnicos > 0) {
          valorSupervisor += totalBonusTecnicos;
          detalhes.bonusSupervisaoTecnica = totalBonusTecnicos;
        }
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
  });

  return fechamento;
}
