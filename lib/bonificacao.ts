import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma";
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
  await Promise.all(
    todosCargos.map(async (cargo) => {
      const regra = await getRegraVigente(cargo, periodo);
      configPorCargo.set(cargo, asRegraConfig(regra?.config));
    })
  );

  const todasEquipes = await prisma.equipe.findMany({
    include: { membros: { where: { ativo: true }, select: { id: true, cargo: true } } },
  });
  const equipesPorSupervisor = new Map<string, typeof todasEquipes>();
  for (const eq of todasEquipes) {
    if (!eq.supervisorId) continue;
    const lista = equipesPorSupervisor.get(eq.supervisorId) ?? [];
    lista.push(eq);
    equipesPorSupervisor.set(eq.supervisorId, lista);
  }

  let valorTotalVendido = 0;
  let valorTotalBonificacao = 0;

  // As linhas são montadas em memória primeiro: o cálculo não toca o banco, então
  // manter isso fora da transação deixa dentro dela apenas as 3 escritas abaixo.
  // Antes havia um upsert por funcionário dentro da transação — em meses com venda
  // real isso passava dos 5s de timeout default do Prisma e estourava P2028.
  const linhas: Prisma.BonificacaoCalculadaCreateManyInput[] = [];

  for (const f of funcionarios) {
    const agregado = somaLancamentos(lancamentosPorFuncionario.get(f.id) ?? []);
    const config = configPorCargo.get(f.cargo) ?? null;
    const individual = calcularBonificacaoIndividual(agregado, config);

    let valorSupervisor = 0;
    const detalhes: Record<string, unknown> = {
      servicos: individual.detalhes,
      pagamento: config?.pagamento ?? (f.cargo === "TECNICO" ? "SEMANAL" : "MENSAL"),
    };

    // Cálculo de bônus de supervisor/responsável de equipe (usando o mapa pré-carregado)
    const equipesSupervisionadas = equipesPorSupervisor.get(f.id) ?? [];

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

    linhas.push({
      fechamentoId: fechamento.id,
      funcionarioId: f.id,
      valorInternet: individual.valorInternet,
      valorChip: individual.valorChip,
      valorDemais: individual.valorDemais,
      valorSupervisor,
      valorTotal,
      detalhesJson: detalhes as Prisma.InputJsonValue,
    });
  }

  const ajustes = await prisma.ajuste.findMany({ where: { periodo } });
  const totalAjustes = ajustes.reduce((acc, a) => acc + a.valor, 0);

  await prisma.$transaction(
    async (tx) => {
      // Recalcular substitui o resultado do período por inteiro. Apagar antes de
      // reinserir também elimina linhas de funcionários que zeraram no recálculo —
      // com o upsert anterior elas ficavam para trás com o valor antigo.
      await tx.bonificacaoCalculada.deleteMany({ where: { fechamentoId: fechamento.id } });

      if (linhas.length > 0) {
        await tx.bonificacaoCalculada.createMany({ data: linhas });
      }

      await tx.fechamentoMensal.update({
        where: { id: fechamento.id },
        data: {
          valorTotalVendido,
          valorTotalBonificacao: valorTotalBonificacao + totalAjustes,
        },
      });
    },
    { timeout: 30_000, maxWait: 10_000 }
  );

  return fechamento;
}
