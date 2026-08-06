import "server-only";
import { prisma } from "@/lib/prisma";
import { garantirEstrutura } from "@/lib/ddl";
import { registrarAlteracao } from "@/lib/auditoria";
import { periodoLabel } from "@/lib/periodo";

// Registro de pagamento da bonificação.
//
// Até aqui o sistema calculava quanto cada pessoa deveria receber e parava. Se
// alguém perguntasse "a comissão de junho da Maria foi paga?", a resposta estava
// fora do sistema — numa planilha, ou na memória de quem pagou.
//
// Agora cada pessoa tem uma situação por período, com quem marcou e quando.
// Três estados, e o terceiro é o que evita discussão: RETIDO é diferente de
// "ainda não paguei" — é uma decisão consciente, com motivo escrito.

export type SituacaoPagamento = "A_PAGAR" | "PAGO" | "RETIDO";

export const SITUACAO_LABEL: Record<SituacaoPagamento, string> = {
  A_PAGAR: "A pagar",
  PAGO: "Pago",
  RETIDO: "Retido",
};

let tabelaGarantida = false;
export async function ensurePagamentoTable(): Promise<void> {
  if (tabelaGarantida) return;
  await garantirEstrutura([`CREATE TABLE IF NOT EXISTS "bonificacao"."pagamento_bonificacao" (
      "id" SERIAL NOT NULL,
      "periodo" TEXT NOT NULL,
      "funcionarioId" TEXT NOT NULL,
      "situacao" TEXT NOT NULL DEFAULT 'A_PAGAR',
      "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "observacao" TEXT,
      "marcadoPorId" TEXT,
      "marcadoPorNome" TEXT,
      "marcadoEm" TIMESTAMP(3),
      CONSTRAINT "pagamento_bonificacao_pkey" PRIMARY KEY ("id")
    );`]);
  await garantirEstrutura([`CREATE UNIQUE INDEX IF NOT EXISTS "pagamento_bonificacao_chave_key"
     ON "bonificacao"."pagamento_bonificacao"("periodo", "funcionarioId");`]);
  tabelaGarantida = true;
}

export type LinhaPagamento = {
  funcionarioId: string;
  funcionarioNome: string;
  valorCalculado: number;
  situacao: SituacaoPagamento;
  observacao: string | null;
  marcadoPorNome: string | null;
  marcadoEm: Date | null;
};

/**
 * Situação de pagamento de todo mundo que tem bonificação no período.
 *
 * A lista sai da bonificação calculada, não da tabela de pagamento: quem nunca
 * foi marcado aparece como "a pagar" em vez de sumir. O contrário deixaria de
 * fora justamente quem ainda não recebeu.
 */
export async function listarPagamentos(periodo: string): Promise<LinhaPagamento[]> {
  await ensurePagamentoTable();

  const [bonificacoes, marcas] = await Promise.all([
    prisma.bonificacaoCalculada.findMany({
      where: { fechamento: { periodo } },
      include: { funcionario: { select: { nome: true } } },
      orderBy: { valorTotal: "desc" },
    }),
    prisma.$queryRaw<
      {
        funcionarioId: string;
        situacao: string;
        observacao: string | null;
        marcadoPorNome: string | null;
        marcadoEm: Date | null;
      }[]
    >`
      SELECT "funcionarioId", "situacao", "observacao", "marcadoPorNome", "marcadoEm"
      FROM "bonificacao"."pagamento_bonificacao"
      WHERE "periodo" = ${periodo}
    `,
  ]);

  const porFuncionario = new Map(marcas.map((m) => [m.funcionarioId, m]));

  return bonificacoes.map((b) => {
    const marca = porFuncionario.get(b.funcionarioId);
    return {
      funcionarioId: b.funcionarioId,
      funcionarioNome: b.funcionario.nome,
      valorCalculado: b.valorTotal,
      situacao: (marca?.situacao as SituacaoPagamento) ?? "A_PAGAR",
      observacao: marca?.observacao ?? null,
      marcadoPorNome: marca?.marcadoPorNome ?? null,
      marcadoEm: marca?.marcadoEm ?? null,
    };
  });
}

/**
 * Marca a situação de pagamento de uma pessoa no período.
 *
 * Grava também o VALOR do momento da marcação: se a bonificação for recalculada
 * depois, dá para saber que o "pago" se referia a outro número — que é
 * exatamente o tipo de divergência que ninguém consegue reconstruir depois.
 */
export async function marcarPagamento(input: {
  periodo: string;
  funcionarioId: string;
  situacao: SituacaoPagamento;
  observacao?: string | null;
  usuarioId: string;
  usuarioNome: string;
}): Promise<void> {
  await ensurePagamentoTable();

  const bonificacao = await prisma.bonificacaoCalculada.findFirst({
    where: { funcionarioId: input.funcionarioId, fechamento: { periodo: input.periodo } },
    include: { funcionario: { select: { nome: true } } },
  });
  const valor = bonificacao?.valorTotal ?? 0;
  const nome = bonificacao?.funcionario.nome ?? "funcionário";

  await prisma.$executeRaw`
    INSERT INTO "bonificacao"."pagamento_bonificacao"
      ("periodo", "funcionarioId", "situacao", "valor", "observacao",
       "marcadoPorId", "marcadoPorNome", "marcadoEm")
    VALUES (
      ${input.periodo}, ${input.funcionarioId}, ${input.situacao}, ${valor},
      ${input.observacao ?? null}, ${input.usuarioId}, ${input.usuarioNome},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("periodo", "funcionarioId") DO UPDATE SET
      "situacao" = EXCLUDED."situacao",
      "valor" = EXCLUDED."valor",
      "observacao" = EXCLUDED."observacao",
      "marcadoPorId" = EXCLUDED."marcadoPorId",
      "marcadoPorNome" = EXCLUDED."marcadoPorNome",
      "marcadoEm" = CURRENT_TIMESTAMP
  `;

  const emReais = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await registrarAlteracao({
    acao: "PAGAMENTO_MARCADO",
    usuarioId: input.usuarioId,
    usuarioNome: input.usuarioNome,
    alvo: nome,
    periodo: input.periodo,
    resumo:
      `Marcou como ${SITUACAO_LABEL[input.situacao].toLowerCase()} a bonificação de ` +
      `${nome} em ${periodoLabel(input.periodo)} (${emReais})` +
      (input.observacao ? ` — "${input.observacao}"` : "."),
    depois: { situacao: input.situacao, valor, observacao: input.observacao ?? null },
  });
}

export type ResumoPagamento = {
  aPagar: { pessoas: number; valor: number };
  pago: { pessoas: number; valor: number };
  retido: { pessoas: number; valor: number };
};

export function resumirPagamentos(linhas: LinhaPagamento[]): ResumoPagamento {
  const zero = () => ({ pessoas: 0, valor: 0 });
  const resumo: ResumoPagamento = { aPagar: zero(), pago: zero(), retido: zero() };
  for (const l of linhas) {
    const alvo =
      l.situacao === "PAGO" ? resumo.pago : l.situacao === "RETIDO" ? resumo.retido : resumo.aPagar;
    alvo.pessoas++;
    alvo.valor += l.valorCalculado;
  }
  return resumo;
}
