// Auditoria dos dados capturados: confere se o que o Elleven e o L&M Móvel
// registraram chegou inteiro ao sistema, e se virou bonificação.
//
// A mesma conferência existe na tela /batimento. Esta rota existe porque nem
// todo mundo que precisa da resposta abre o sistema — e porque o resultado no
// log permite comparar semana a semana sem depender de alguém tirar print.
//
// Roda toda segunda de manhã e pode ser disparada a qualquer momento:
//   vercel crons run /api/cron/auditoria
//
// Variáveis de ambiente:
//   CRON_SECRET — enviado automaticamente pelo Vercel Cron
//   SYNC_ELLEVEN_SECRET — disparo manual via ?secret=...
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFuncionarioContato } from "@/lib/ensure-schema";
import { montarConferencia } from "@/lib/conferencia";
import { levantarPendencias } from "@/lib/pendencias";
import { periodoAtual } from "@/lib/periodo";
import { recordCronRun } from "@/lib/cron-observability";

export const runtime = "nodejs";
export const maxDuration = 120;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  const manual = process.env.SYNC_ELLEVEN_SECRET;
  const informado = req.nextUrl.searchParams.get("secret");
  return !!manual && informado === manual;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureFuncionarioContato();

  const periodo = req.nextUrl.searchParams.get("periodo") ?? periodoAtual();
  const inicio = Date.now();
  const log: string[] = [];
  const registrar = (linha: string) => {
    log.push(linha);
    console.log(`[auditoria] ${linha}`);
  };

  try {
    const [conferencia, pendencias, totais] = await Promise.all([
      montarConferencia(periodo),
      levantarPendencias(periodo),
      Promise.all([
        prisma.elevenRelatorioLinha.count({
          where: { relatorio: "funil-de-vendas", periodo },
        }),
        prisma.vendaChipMovel.count({ where: { periodo } }),
        prisma.vendaChipMovel.count({ where: { periodo, cancelledAt: { not: null } } }),
        prisma.lancamentoVenda.count({ where: { periodo } }),
        prisma.lancamentoVenda.aggregate({
          where: { periodo },
          _sum: { valorInstalado: true, quantidade: true, qtdInternet: true, qtdChip: true },
        }),
        prisma.bonificacaoCalculada.aggregate({
          where: { fechamento: { periodo } },
          _sum: { valorTotal: true },
          _count: true,
        }),
        prisma.funcionario.count({ where: { ativo: true } }),
      ]),
    ]);

    const [
      linhasFunil,
      chipTotal,
      chipCancelado,
      lancamentos,
      somaLanc,
      somaBonif,
      funcionariosAtivos,
    ] = totais;

    registrar(`=== AUDITORIA DE ${periodo} ===`);

    registrar(
      `FONTE: ${linhasFunil} linha(s) do funil · ${chipTotal} venda(s) de chip ` +
        `(${chipCancelado} cancelada(s))`,
    );
    registrar(
      `SISTEMA: ${lancamentos} lançamento(s) · ${somaLanc._sum.quantidade ?? 0} venda(s) · ` +
        `${somaLanc._sum.qtdInternet ?? 0} internet · ${somaLanc._sum.qtdChip ?? 0} chip · ` +
        `R$ ${(somaLanc._sum.valorInstalado ?? 0).toFixed(2)}`,
    );
    registrar(
      `BONIFICAÇÃO: ${somaBonif._count} pessoa(s) · ` +
        `R$ ${(somaBonif._sum.valorTotal ?? 0).toFixed(2)}`,
    );

    const vendido = somaLanc._sum.valorInstalado ?? 0;
    const bonus = somaBonif._sum.valorTotal ?? 0;
    registrar(
      `CUSTO DA COMISSÃO: ${vendido > 0 ? ((bonus / vendido) * 100).toFixed(1) : "—"}% ` +
        `(limite 25%)`,
    );

    registrar(
      `CONFERÊNCIA: ${conferencia.totalFonte} na fonte vs ${conferencia.totalLancado} lançadas ` +
        `(diferença ${conferencia.totalLancado - conferencia.totalFonte})`,
    );

    const porSituacao = new Map<string, number>();
    for (const l of conferencia.linhas) {
      porSituacao.set(l.situacao, (porSituacao.get(l.situacao) ?? 0) + 1);
    }
    for (const [situacao, quantidade] of porSituacao) {
      registrar(`  ${situacao}: ${quantidade} pessoa(s)`);
    }

    // As divergências, com nome — é o que permite agir sem abrir o sistema.
    for (const l of conferencia.linhas) {
      if (l.situacao === "OK") continue;
      registrar(
        `  [${l.situacao}] ${l.nome}: fonte ${l.fonte}, lançado ${l.lancado}, ` +
          `bônus R$ ${l.bonificado.toFixed(2)}`,
      );
    }

    registrar(
      `PENDÊNCIAS: ${pendencias.aproximados.length} nome(s) adivinhado(s) · ` +
        `${pendencias.vendasSemVendedor} venda(s) sem vendedor · ` +
        `${pendencias.semCadastro.length} criado(s) automaticamente`,
    );
    for (const a of pendencias.aproximados) {
      registrar(
        `  [ADIVINHADO] "${a.nomeNaFonte}" → "${a.nomeNoCadastro}" (${a.vendas} venda(s))`,
      );
    }
    if (pendencias.semCadastro.length > 0) {
      registrar(`  [CRIADOS] ${pendencias.semCadastro.join(", ")}`);
    }

    registrar(`CADASTRO: ${funcionariosAtivos} funcionário(s) ativo(s)`);

    const resumo = {
      periodo,
      fonte: { linhasFunil, chipTotal, chipCancelado },
      sistema: {
        lancamentos,
        vendas: somaLanc._sum.quantidade ?? 0,
        internet: somaLanc._sum.qtdInternet ?? 0,
        chip: somaLanc._sum.qtdChip ?? 0,
        valorInstalado: vendido,
      },
      bonificacao: { pessoas: somaBonif._count, valor: bonus },
      conferencia: {
        totalFonte: conferencia.totalFonte,
        totalLancado: conferencia.totalLancado,
        divergencias: conferencia.linhas.filter((l) => l.situacao !== "OK").length,
      },
      pendencias: {
        adivinhados: pendencias.aproximados.length,
        semVendedor: pendencias.vendasSemVendedor,
        criadosAutomaticamente: pendencias.semCadastro.length,
      },
      funcionariosAtivos,
    };

    await recordCronRun({
      job: "auditoria",
      ok: true,
      durationMs: Date.now() - inicio,
      detalhes: resumo,
    });

    return NextResponse.json({ ok: true, resumo, log });
  } catch (e) {
    registrar(`ERRO: ${e}`);
    await recordCronRun({
      job: "auditoria",
      ok: false,
      durationMs: Date.now() - inicio,
      erro: String(e),
    });
    return NextResponse.json({ ok: false, erro: String(e), log }, { status: 500 });
  }
}
