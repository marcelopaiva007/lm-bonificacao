// Carga inicial do módulo contábil.
//
//   npx tsx scripts/seed-contabil.ts
//
// Idempotente: pode rodar de novo sem duplicar nada. Traz para dentro do sistema
// as duas planilhas que o analista mantinha à mão (resultado e impostos da VAPT,
// jan–jun/2026) e deixa as demais empresas cadastradas e vazias.
import "dotenv/config";
import { prisma } from "../lib/prisma";

const ANO = 2026;

const TRIBUTOS = [
  { nome: "ISS", descricao: "Imposto Sobre Serviços", ordem: 1 },
  { nome: "PIS", descricao: "PIS sobre faturamento", ordem: 2 },
  { nome: "COFINS", descricao: "COFINS sobre faturamento", ordem: 3 },
  { nome: "RET. ENTRADA IRRF E CRF", descricao: "Retenções na entrada (IRRF e CRF)", ordem: 4 },
];

const EMPRESAS = [
  { nome: "VAPT", regime: "PRESUMIDO" },
  { nome: "LM Telecom", regime: null },
  { nome: "Centrysol", regime: null },
];

// Planilha 1 — faturamento x despesas (VAPT, 2026).
const RESULTADO_VAPT: Record<string, { faturamento: number; despesas: number }> = {
  "2026-01": { faturamento: 0, despesas: 6494.3 },
  "2026-02": { faturamento: 81804.16, despesas: 54620.33 },
  "2026-03": { faturamento: 117063.28, despesas: 149197.09 },
  "2026-04": { faturamento: 118068.4, despesas: 136340.65 },
  "2026-05": { faturamento: 126700.82, despesas: 133796.1 },
  "2026-06": { faturamento: 133479.23, despesas: 114561.2 },
};

// Planilha 2 — impostos VAPT, 2026. Meses/tributos ausentes = sem valor.
const IMPOSTOS_VAPT: Record<string, Record<string, number>> = {
  "2026-02": { ISS: 1925.59, PIS: 1119.94, COFINS: 5158.56 },
  "2026-03": { ISS: 2341.27, PIS: 1121.9, COFINS: 5167.55 },
  "2026-04": { ISS: 2362.17 },
  "2026-05": { ISS: 2534.02, "RET. ENTRADA IRRF E CRF": 606.13 },
  "2026-06": { ISS: 2669.58, PIS: 904.23, COFINS: 4164.96, "RET. ENTRADA IRRF E CRF": 567.39 },
};

async function main() {
  // ---- Tributos ----
  const tipos = new Map<string, string>();
  for (const t of TRIBUTOS) {
    const tipo = await prisma.tipoImposto.upsert({
      where: { nome: t.nome },
      create: t,
      update: { descricao: t.descricao, ordem: t.ordem },
    });
    tipos.set(tipo.nome, tipo.id);
  }
  console.log(`Tributos: ${tipos.size}`);

  // ---- Empresas ----
  for (const e of EMPRESAS) {
    await prisma.empresaContabil.upsert({
      where: { nome: e.nome },
      create: { nome: e.nome, regime: e.regime },
      update: {},
    });
  }
  const vapt = await prisma.empresaContabil.findUniqueOrThrow({ where: { nome: "VAPT" } });
  console.log(`Empresas: ${EMPRESAS.length}`);

  // ---- Resultado mensal da VAPT ----
  for (const [periodo, valores] of Object.entries(RESULTADO_VAPT)) {
    await prisma.competenciaContabil.upsert({
      where: { empresaId_periodo: { empresaId: vapt.id, periodo } },
      create: { empresaId: vapt.id, periodo, ...valores },
      update: valores,
    });
  }
  console.log(`Competências VAPT ${ANO}: ${Object.keys(RESULTADO_VAPT).length}`);

  // ---- Impostos da VAPT ----
  let lancados = 0;
  for (const [periodo, porTributo] of Object.entries(IMPOSTOS_VAPT)) {
    const competencia = await prisma.competenciaContabil.upsert({
      where: { empresaId_periodo: { empresaId: vapt.id, periodo } },
      create: { empresaId: vapt.id, periodo },
      update: {},
    });

    for (const [nomeTributo, valor] of Object.entries(porTributo)) {
      const tipoId = tipos.get(nomeTributo);
      if (!tipoId) throw new Error(`Tributo não cadastrado: ${nomeTributo}`);

      await prisma.impostoApurado.upsert({
        where: { competenciaId_tipoId: { competenciaId: competencia.id, tipoId } },
        create: { competenciaId: competencia.id, tipoId, valor },
        update: { valor },
      });
      lancados++;
    }
  }
  console.log(`Impostos lançados: ${lancados}`);

  // ---- Conferência contra a planilha ----
  const competencias = await prisma.competenciaContabil.findMany({
    where: { empresaId: vapt.id, periodo: { startsWith: String(ANO) } },
    include: { impostos: true },
  });
  const fat = competencias.reduce((s, c) => s + c.faturamento, 0);
  const desp = competencias.reduce((s, c) => s + c.despesas, 0);
  const imp = competencias.reduce((s, c) => s + c.impostos.reduce((si, i) => si + i.valor, 0), 0);
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  console.log(`\nVAPT ${ANO} (jan–jun)`);
  console.log(`  Faturamento: ${brl(fat)}   (planilha: R$ 577.115,89)`);
  console.log(`  Despesas:    ${brl(desp)}   (planilha: R$ 595.009,67)`);
  console.log(`  Lucro:       ${brl(fat - desp)}   (planilha: -R$ 17.893,78)`);
  console.log(`  Impostos:    ${brl(imp)}   (planilha: R$ 30.643,29)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
