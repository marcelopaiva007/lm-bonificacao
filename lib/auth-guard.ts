import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureFuncionarioContato } from "@/lib/ensure-schema";
import { pode, type Capacidade } from "@/lib/permissoes";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // As colunas de contato do Funcionário (email/telegramChatId) são criadas sob
  // demanda — a migração não é aplicada à mão (ver lib/ensure-schema). Como o
  // Prisma passa a selecionar essas colunas em toda leitura de Funcionário,
  // garantimos que existam antes de qualquer página autenticada consultá-las.
  // Best-effort e roda uma vez por processo; nunca bloqueia o acesso.
  try {
    await ensureFuncionarioContato();
  } catch {
    // Se o ALTER falhar (ex.: permissão), seguimos — as telas que usam os
    // campos têm sua própria checagem e o cron roda em modo seguro.
  }
  return session.user;
}

/**
 * Exige uma capacidade específica de escrita.
 *
 * Preferir isto a checar o papel na mão: quando um papel novo aparecer, muda-se
 * a tabela em lib/permissoes.ts e todas as telas acompanham. Checagem espalhada
 * por papel é como nasce a tela que alguém esqueceu de proteger.
 */
export async function requireCapacidade(capacidade: Capacidade) {
  const user = await requireUser();
  if (!pode(user.role, capacidade)) redirect("/");
  return user;
}

/**
 * Continua existindo para o que é genuinamente do administrador do sistema:
 * criar usuário, mexer em integração.
 *
 * Para o trabalho do dia a dia — regra, lançamento, fechamento — use
 * requireCapacidade. O gerente precisa fazer isso sem ser administrador total,
 * que foi a decisão da diretoria em 06/08/2026.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
