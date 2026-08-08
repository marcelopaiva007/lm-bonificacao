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
import { CARGOS } from "@/lib/constants";

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

  const lancamentos = await prisma.lancamentoVenda.findMany({ where: { periodo } });
  const lancamentosPorFuncionario = new Map<string, LancamentoAgregado[]>();
  for (const l of lancamentos) {
    const lista = lancamentosPorFuncionario.get(l.funcionarioId) ?? [];
    lista.push(l);
    lancamentosPorFuncionario.set(l.funcionarioId, lista);
  }

  // Entram no cálculo os funcionários ATIVOS mais qualquer um com lançamento no
  // período, mesmo já desativado. Decisão da diretoria (05/08/2026): quem vendeu
  // e foi desligado no meio do mês recebe o bônus daquele mês — a venda
  // aconteceu. Antes, o filtro `ativo: true` sozinho tirava essa pessoa do
  // cálculo E do total, mas a linha de um recálculo anterior continuava no banco
  // aparecendo na lista do fechamento: ela era exibida para pagamento e ao mesmo
  // tempo ficava fora do total. Mês já FECHADO não passa por aqui (return acima),
  // então nada é recalculado retroativamente.
  const idsComLancamento = [...new Set(lancamentos.map((l) => l.funcionarioId))];
  const funcionarios = await prisma.funcionario.findMany({
    where: { OR: [{ ativo: true }, { id: { in: idsComLancamento } }] },
    include: { equipe: true },
  });

  // Total de vendas de INTERNET por equipe (base do bônus de supervisor, OS §3.2).
  // Inclui a internet de quem foi desligado no meio do mês, pela mesma decisão
  // acima — a venda foi da equipe. Já o TAMANHO da equipe (que escala a meta,
  // mais abaixo) continua contando só membros ativos: mudar isso é uma segunda
  // decisão, ainda não tomada.
  const internetPorEquipe = new Map<string, number>();
  for (const f of funcionarios) {
    if (!f.equipeId) continue;
    const agregado = somaLancamentos(lancamentosPorFuncionario.get(f.id) ?? []);
    internetPorEquipe.set(
      f.equipeId,
      (internetPorEquipe.get(f.equipeId) ?? 0) + agregado.qtdInternet
    );
  }

  // A lista de cargos vem de CARGOS (fonte única) — quando um cargo novo entra
  // no cadastro, ele entra no cálculo junto, em vez de ficar silenciosamente
  // sem regra (era uma lista duplicada aqui até 08/08/2026).
  const configPorCargo = new Map<string, RegraConfig | null>();
  for (const { value: cargo } of CARGOS) {
    const regra = await getRegraVigente(cargo, periodo);
    configPorCargo.set(cargo, asRegraConfig(regra?.config));
  }

  // Equipes de cada supervisor carregadas de uma vez, ANTES da transação: antes
  // isso era um findMany por supervisor dentro do loop transacional (N+1), o que
  // estourava o timeout padrão de 5s do Prisma conforme o quadro crescia e
  // abortava o recálculo inteiro (P2028).
  const equipesPorSupervisor = new Map<string, EquipeComMembros[]>();
  // Quem tem bônus de equipe é quem tem a seção `supervisor` na regra do
  // cargo — não só o cargo SUPERVISOR. O RESPONSAVEL_SETOR (R$ 10 por venda
  // de internet dos técnicos, 08/08/2026) entra por aqui: mesma mecânica,
  // meta zero.
  const temBonusDeEquipe = (cargo: string) =>
    configPorCargo.get(cargo)?.supervisor != null;
  const supervisorIds = funcionarios.filter((f) => temBonusDeEquipe(f.cargo)).map((f) => f.id);
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
  // Quem realmente recebeu linha nesta rodada — base da limpeza no fim da
  // transação (ver comentário lá embaixo).
  const idsCalculados = new Set<string>();

  await prisma.$transaction(
    async (tx) => {
      for (const f of funcionarios) {
        const agregado = somaLancamentos(lancamentosPorFuncionario.get(f.id) ?? []);
        const config = configPorCargo.get(f.cargo) ?? null;
        const individual = calcularBonificacaoIndividual(agregado, config);

        let valorSupervisor = 0;
        const detalhes: Record<string, unknown> = { servicos: individual.detalhes };

        if (config?.supervisor) {
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
        idsCalculados.add(f.id);
      }

      // Limpa linha de bonificação que sobrou de um recálculo anterior. O loop
      // acima só faz upsert: quem tinha bônus e deixou de ter (o sync do
      // Elleven REGRAVA os lançamentos do mês inteiro a cada rodada, então uma
      // venda pode simplesmente sumir do relatório) caía no `continue` e a
      // linha ANTIGA continuava no banco — aparecendo na lista e no CSV do
      // fechamento, que é a planilha usada para pagar, sem entrar no
      // valorTotalBonificacao recalculado. Resultado: soma da lista ≠ total, a
      // favor de um bônus que não existe mais.
      //
      // Vale para TODA linha não recalculada agora, sem exceção para funcionário
      // desativado: com a regra da diretoria (05/08/2026) quem tem venda no
      // período é calculado mesmo inativo, então sobrar aqui significa que não
      // há mais venda nenhuma sustentando aquele valor.
      await tx.bonificacaoCalculada.deleteMany({
        where: {
          fechamentoId: fechamento.id,
          // Set vazio = ninguém pontuou no mês; nesse caso a limpeza é do
          // fechamento inteiro (sem `notIn`, que com lista vazia é ambíguo).
          ...(idsCalculados.size > 0
            ? { funcionarioId: { notIn: [...idsCalculados] } }
            : {}),
        },
      });

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
