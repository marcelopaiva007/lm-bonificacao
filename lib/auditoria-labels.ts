// Nomes das ações auditadas, num módulo SEM "server-only" para a tela poder
// importar. lib/auditoria.ts (que toca o banco) reexporta daqui, então existe um
// lugar só onde o nome de cada ação é decidido.
//
// O nome descreve o efeito no negócio, não a operação técnica: quem abre o
// histórico quer ler "Mês fechado", não "UPDATE em FechamentoMensal".

export type AcaoAuditada =
  | "REGRA_CRIADA"
  | "AJUSTE_CRIADO"
  | "AJUSTE_REMOVIDO"
  | "LANCAMENTO_CRIADO"
  | "LANCAMENTO_ALTERADO"
  | "LANCAMENTO_REMOVIDO"
  | "MES_FECHADO"
  | "MES_REABERTO"
  | "RECALCULO_MANUAL"
  | "PAGAMENTO_MARCADO";

export const ACAO_LABEL: Record<AcaoAuditada, string> = {
  REGRA_CRIADA: "Regra de bonificação alterada",
  AJUSTE_CRIADO: "Ajuste lançado",
  AJUSTE_REMOVIDO: "Ajuste removido",
  LANCAMENTO_CRIADO: "Lançamento criado à mão",
  LANCAMENTO_ALTERADO: "Lançamento alterado",
  LANCAMENTO_REMOVIDO: "Lançamento removido",
  MES_FECHADO: "Mês fechado",
  MES_REABERTO: "Mês reaberto",
  RECALCULO_MANUAL: "Recálculo disparado à mão",
  PAGAMENTO_MARCADO: "Pagamento marcado",
};
