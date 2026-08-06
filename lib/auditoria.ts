import "server-only";
import { prisma } from "@/lib/prisma";

// Registro de alterações: quem mudou o quê, quando, e como estava antes.
//
// Existe porque o sistema paga dinheiro. Quando um vendedor contestar um valor
// quatro meses depois, é isto que mostra qual regra valia naquela data e quem a
// definiu — sem isso, a palavra de quem calculou fica sozinha. Passou a ser
// obrigatório com a decisão de 06/08/2026, que deu ao gerente tanto a edição da
// regra quanto o fechamento do mês: a mesma pessoa escreve a regra e libera o
// pagamento dela.
//
// A tabela é criada sob demanda (CREATE TABLE IF NOT EXISTS), como cron_run — o
// build não roda migrations neste projeto. E, de propósito, ela NÃO é modelada
// no schema.prisma: leitura e escrita são SQL cru. Assim a ausência da tabela
// nunca derruba outra consulta, que foi exatamente o que aconteceu em 06/08/2026
// quando uma coluna nova no modelo Funcionario quebrou a importação do funil.

// Os nomes das ações vivem num módulo sem "server-only" porque a tela também
// precisa deles; aqui só reexportamos, para quem trabalha no servidor importar
// tudo de um lugar só.
export { ACAO_LABEL, type AcaoAuditada } from "@/lib/auditoria-labels";
import type { AcaoAuditada } from "@/lib/auditoria-labels";

let tabelaGarantida = false;
export async function ensureRegistroAlteracaoTable(): Promise<void> {
  if (tabelaGarantida) return;
  // Schema-qualificado: SQL cru não passa pelo mapeamento @@schema do Prisma e,
  // sem o prefixo, o Postgres criaria a tabela no `public` pelo search_path.
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "bonificacao"."registro_alteracao" (
      "id" SERIAL NOT NULL,
      "acao" TEXT NOT NULL,
      "usuarioId" TEXT,
      "usuarioNome" TEXT NOT NULL,
      "alvo" TEXT,
      "periodo" TEXT,
      "resumo" TEXT NOT NULL,
      "antes" JSONB,
      "depois" JSONB,
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "registro_alteracao_pkey" PRIMARY KEY ("id")
    );`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "registro_alteracao_criadoEm_idx" ON "bonificacao"."registro_alteracao"("criadoEm" DESC);`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "registro_alteracao_periodo_idx" ON "bonificacao"."registro_alteracao"("periodo");`,
  );
  tabelaGarantida = true;
}

export type RegistroInput = {
  acao: AcaoAuditada;
  usuarioId?: string | null;
  usuarioNome: string;
  /** Sobre quem/o quê recaiu a alteração (nome do funcionário, cargo da regra). */
  alvo?: string | null;
  /** Período afetado, quando a alteração mexe em dinheiro de um mês. */
  periodo?: string | null;
  /** Uma frase legível: é o que aparece na tela. */
  resumo: string;
  antes?: unknown;
  depois?: unknown;
};

// Grava uma alteração. Best-effort e blindado: falhar ao registrar NUNCA pode
// impedir a ação em si — um erro de auditoria que bloqueasse o fechamento do mês
// seria pior que a falta do registro. A falha vai para o log do servidor.
export async function registrarAlteracao(input: RegistroInput): Promise<void> {
  try {
    await ensureRegistroAlteracaoTable();
    const antes = input.antes != null ? JSON.stringify(input.antes) : null;
    const depois = input.depois != null ? JSON.stringify(input.depois) : null;
    await prisma.$executeRaw`
      INSERT INTO "bonificacao"."registro_alteracao"
        ("acao", "usuarioId", "usuarioNome", "alvo", "periodo", "resumo", "antes", "depois")
      VALUES (
        ${input.acao},
        ${input.usuarioId ?? null},
        ${input.usuarioNome},
        ${input.alvo ?? null},
        ${input.periodo ?? null},
        ${input.resumo},
        ${antes}::jsonb,
        ${depois}::jsonb
      )
    `;
  } catch (e) {
    console.error(`[auditoria] falha ao registrar ${input.acao}:`, e);
  }
}

export type RegistroAlteracao = {
  id: number;
  acao: string;
  usuarioId: string | null;
  usuarioNome: string;
  alvo: string | null;
  periodo: string | null;
  resumo: string;
  antes: unknown;
  depois: unknown;
  criadoEm: Date;
};

// Histórico mais recente primeiro, opcionalmente filtrado por período.
export async function listarAlteracoes(opcoes?: {
  periodo?: string;
  limite?: number;
}): Promise<RegistroAlteracao[]> {
  await ensureRegistroAlteracaoTable();
  const limite = Math.min(Math.max(opcoes?.limite ?? 200, 1), 1000);

  if (opcoes?.periodo) {
    return prisma.$queryRaw<RegistroAlteracao[]>`
      SELECT * FROM "bonificacao"."registro_alteracao"
      WHERE "periodo" = ${opcoes.periodo}
      ORDER BY "criadoEm" DESC
      LIMIT ${limite}
    `;
  }

  return prisma.$queryRaw<RegistroAlteracao[]>`
    SELECT * FROM "bonificacao"."registro_alteracao"
    ORDER BY "criadoEm" DESC
    LIMIT ${limite}
  `;
}
