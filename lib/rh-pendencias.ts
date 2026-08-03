import { prisma } from "@/lib/prisma";

export type PendenciaItem = {
  id: string;
  nome: string;
  cpf: string | null;
};

export type Pendencia = {
  tipo: string;
  descricao: string;
  total: number;
  percentual: number;
  colaboradores: PendenciaItem[];
};

export async function buscarPendenciasEmpresa(empresaId: string) {
  const colaboradores = await prisma.colaborador.findMany({
    where: { empresaId, ativo: true },
    select: { id: true, nome: true, cpf: true, telegramChatId: true, salarioFicha: true, dataAdmissao: true, setorId: true },
  });

  const total = colaboradores.length;

  const pendencias: Pendencia[] = [];

  // Pendência: sem Telegram vinculado
  const semTelegram = colaboradores.filter((c) => !c.telegramChatId);
  if (semTelegram.length > 0) {
    pendencias.push({
      tipo: "sem_telegram",
      descricao: "sem Telegram vinculado",
      total: semTelegram.length,
      percentual: Math.round((semTelegram.length / total) * 100),
      colaboradores: semTelegram.map((c) => ({ id: c.id, nome: c.nome, cpf: c.cpf })),
    });
  }

  // Pendência: sem salário na ficha
  const semSalario = colaboradores.filter((c) => c.salarioFicha === null || c.salarioFicha === 0);
  if (semSalario.length > 0) {
    pendencias.push({
      tipo: "sem_salario",
      descricao: "sem salário na ficha",
      total: semSalario.length,
      percentual: Math.round((semSalario.length / total) * 100),
      colaboradores: semSalario.map((c) => ({ id: c.id, nome: c.nome, cpf: c.cpf })),
    });
  }

  // Pendência: sem data de admissão
  const semDataAdmissao = colaboradores.filter((c) => !c.dataAdmissao);
  if (semDataAdmissao.length > 0) {
    pendencias.push({
      tipo: "sem_data_admissao",
      descricao: "sem data de admissão",
      total: semDataAdmissao.length,
      percentual: Math.round((semDataAdmissao.length / total) * 100),
      colaboradores: semDataAdmissao.map((c) => ({ id: c.id, nome: c.nome, cpf: c.cpf })),
    });
  }

  // Pendência: sem setor definido
  const semSetor = colaboradores.filter((c) => !c.setorId);
  if (semSetor.length > 0) {
    pendencias.push({
      tipo: "sem_setor",
      descricao: "sem setor definido",
      total: semSetor.length,
      percentual: Math.round((semSetor.length / total) * 100),
      colaboradores: semSetor.map((c) => ({ id: c.id, nome: c.nome, cpf: c.cpf })),
    });
  }

  return {
    totalColaboradores: total,
    pendencias: pendencias.sort((a, b) => b.total - a.total),
  };
}
