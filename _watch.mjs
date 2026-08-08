import pg from "pg";
import fs from "node:fs";
const conn = fs.readFileSync("C:/LM Claude/.env","utf8").match(/^DATABASE_URL="?([^"\n\r]+)"?/m)[1];
const alvo = ["sync-elleven:cancelamentos","sync-elleven:funil-de-vendas","sync-elleven:vendedores-comercial","sync-elleven:pedidos-de-venda","sync-chip"];
const vistos = new Set();
const inicio = Date.now();
while (Date.now() - inicio < 32 * 60_000) {
  const c = new pg.Client({ connectionString: conn });
  try {
    await c.connect();
    const { rows } = await c.query(
      `SELECT id, job, ok, erro, detalhes FROM bonificacao.cron_run
        WHERE "finishedAt" > (now() at time zone 'utc') - interval '40 minutes'
        ORDER BY id ASC`);
    for (const r of rows) {
      if (vistos.has(r.id) || !alvo.includes(r.job)) continue;
      vistos.add(r.id);
      const d = r.detalhes ?? {};
      console.log(`RODOU ${r.job} | ${r.ok ? "ok" : "FALHOU"} | linhas=${d.rowCount ?? "?"} salvas=${d.savedCount ?? "?"}${r.erro ? " | " + String(r.erro).slice(0,110) : ""}`);
    }
    if (vistos.size >= 5) { console.log("FIM: todas as coletas antecipadas rodaram"); break; }
  } catch (e) {
    // falha transitoria de conexao nao derruba o monitor
  } finally { await c.end().catch(() => {}); }
  await new Promise((r) => setTimeout(r, 30_000));
}
