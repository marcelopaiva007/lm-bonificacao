// Extração: baixa o CSV do relatório "Pessoas Completo - Analítico" do elleven
// filtrado por Colaborador = Sim (Data de Cadastro 01/01/2000 -> hoje), e salva
// em scripts/elleven-discovery/colaboradores.csv + colaboradores.json.
// As datas usam interação REAL no calendário Flatpickr (dropdown de mês + input
// de ano + clique no dia) — única forma que o estado do formulário reconhece,
// como já comprovado no sync-elleven.
// Uso: npx tsx scripts/extrair-elleven-colaboradores.ts
import { config as dotenvConfig } from "dotenv";
dotenvConfig();
dotenvConfig({ path: ".env.local" });
import { chromium, type Browser, type Frame, type Page } from "playwright-core";
import * as fs from "fs";

const ELLEVEN_BASE = "https://elleven.assinelm.com.br";
const REPORT_PATH = "/ui/legacy/reports/7a310aaf-1599-973e-3610-e4c6bde0e9b9";
const OUT_DIR = "scripts/elleven-discovery";
const login = process.env.ELLEVEN_LOGIN!;
const password = process.env.ELLEVEN_PASSWORD!;

async function launchLocal(): Promise<Browser> {
  for (const channel of ["chrome", "msedge"] as const) {
    try {
      return await chromium.launch({ headless: true, channel });
    } catch {
      /* tenta o próximo */
    }
  }
  return chromium.launch({ headless: true });
}

async function selectMuiOption(frame: Frame, elementId: string, matchRegex: RegExp) {
  const result: { opened: boolean; options: string[]; selected?: string } = { opened: false, options: [] };
  try {
    await frame.locator(`[id="${elementId}"]`).click({ timeout: 5000 });
    result.opened = true;
  } catch {
    return result;
  }
  await frame.page().waitForTimeout(700);
  const options = await frame
    .evaluate(() =>
      Array.from(document.querySelectorAll('li[role="option"], ul[role="listbox"] li')).map((el) =>
        (el.textContent || "").trim(),
      ),
    )
    .catch(() => [] as string[]);
  result.options = options;
  if (options.length > 0) {
    const idx = options.findIndex((o) => matchRegex.test(o));
    if (idx < 0) {
      // fecha o dropdown sem escolher
      await frame.page().keyboard.press("Escape").catch(() => {});
      return result;
    }
    await frame.locator('li[role="option"]').nth(idx).click({ timeout: 5000 });
    result.selected = options[idx];
  }
  return result;
}

// Interação real com o calendário Flatpickr: abre, ajusta ano (input .cur-year),
// mês (dropdown ou setas) e clica no dia — dispara o estado do formulário.
async function pickFlatpickrDate(
  frame: Frame,
  inputSelector: string,
  target: { year: number; month: number; day: number }, // month 1-12
): Promise<{ ok: boolean; value: string; debug: string }> {
  const page = frame.page();
  try {
    await frame.locator(inputSelector).click({ timeout: 5000 });
    const cal = frame.locator(".flatpickr-calendar.open");
    await cal.waitFor({ state: "visible", timeout: 4000 });

    // Ano: input numérico .cur-year — ajusta só com ArrowUp/ArrowDown (com
    // fallback nos botões de spin), interações que o flatpickr sempre reconhece.
    const yearInput = cal.locator("input.cur-year");
    await yearInput.click({ timeout: 3000 });
    for (let i = 0; i < 60; i++) {
      const shownYear = parseInt(await yearInput.inputValue().catch(() => ""), 10);
      if (Number.isNaN(shownYear) || shownYear === target.year) break;
      const goDown = shownYear > target.year;
      const before = shownYear;
      await yearInput.press(goDown ? "ArrowDown" : "ArrowUp");
      await page.waitForTimeout(100);
      const after = parseInt(await yearInput.inputValue().catch(() => ""), 10);
      if (after === before) {
        // teclado não surtiu efeito — usa os botões de spin do numInputWrapper
        await cal
          .locator(`.numInputWrapper span.${goDown ? "arrowDown" : "arrowUp"}`)
          .first()
          .click({ timeout: 2000, force: true });
        await page.waitForTimeout(100);
      }
    }

    // Mês: dropdown (versões novas) ou setas prev/next.
    const monthDropdown = cal.locator("select.flatpickr-monthDropdown-months");
    if ((await monthDropdown.count()) > 0) {
      await monthDropdown.selectOption(String(target.month - 1), { timeout: 3000 });
    } else {
      for (let i = 0; i < 24; i++) {
        const shown = await cal
          .locator(".flatpickr-current-month")
          .innerText({ timeout: 2000 })
          .catch(() => "");
        const monthIdx = [
          "janeiro", "fevereiro", "março", "abril", "maio", "junho",
          "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
        ].findIndex((m) => shown.toLowerCase().includes(m));
        if (monthIdx === target.month - 1) break;
        const goPrev = monthIdx === -1 || monthIdx > target.month - 1;
        await cal
          .locator(goPrev ? ".flatpickr-prev-month" : ".flatpickr-next-month")
          .click({ timeout: 2000 });
        await page.waitForTimeout(200);
      }
    }
    await page.waitForTimeout(400);

    // Dia do mês exibido (ignora células de transbordo).
    await cal
      .locator(".flatpickr-day:not(.prevMonthDay):not(.nextMonthDay)")
      .filter({ hasText: new RegExp(`^${target.day}$`) })
      .first()
      .click({ timeout: 3000 });
    await page.waitForTimeout(400);

    const value = await frame.locator(inputSelector).inputValue().catch(() => "");
    return { ok: value.length > 0, value, debug: "calendario-real" };
  } catch (e) {
    return { ok: false, value: "", debug: String(e).slice(0, 200) };
  }
}

async function downloadCsv(page: Page, frame: Frame, ano: number) {
  const buttons = frame.locator("button.MuiButton-outlined:visible");
  const count = await buttons.count();
  if (count < 2) throw new Error(`etapa Geração com ${count} botões — sem CSV`);
  const csvButton = buttons.nth(count - 2); // [..., CSV, FECHAR]
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 180_000 }),
    csvButton.click({ timeout: 10_000 }),
  ]);
  const csvPath = `${OUT_DIR}/colaboradores-${ano}.csv`;
  await download.saveAs(csvPath);
  return csvPath;
}

function parseCsv(csvPath: string) {
  const raw = fs.readFileSync(csvPath);
  const utf8 = raw.toString("utf-8");
  const text = utf8.includes("ï¿½") || utf8.includes("â€") ? raw.toString("latin1") : utf8;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = (lines[0] ?? "").split(";").map((h) => h.replace(/"/g, "").trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(";").map((c) => c.replace(/"/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
  return { headers, rows };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await launchLocal();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  console.log("1. Login...");
  await page.goto(`${ELLEVEN_BASE}/ui/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector('input[placeholder="Entre com seu CPF"]', { timeout: 45000 });
  await page.fill('input[placeholder="Entre com seu CPF"]', login);
  await page.fill('input[placeholder="Entre com sua senha"]', password);
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(7000);
  if (page.url().includes("/login")) throw new Error("login falhou");

  console.log("2. Abrindo relatório Pessoas Completo - Analítico...");
  await page.goto(`${ELLEVEN_BASE}${REPORT_PATH}`, { waitUntil: "load", timeout: 45000 });
  let frame = page.frames().find((f) => f.url().includes("reports_exec"));
  for (let i = 0; i < 20 && !frame; i++) {
    await page.waitForTimeout(2000);
    frame = page.frames().find((f) => f.url().includes("reports_exec"));
  }
  if (!frame) throw new Error("frame reports_exec não encontrado");
  await page.waitForTimeout(4000);

  // O relatório limita o período a 1 ano — itera janelas anuais e mescla tudo.
  const hoje = new Date();
  const ANO_INICIAL = Number(process.argv[2] || 2008);
  const todas: Record<string, string>[] = [];
  let headersGlobais: string[] = [];

  for (let ano = ANO_INICIAL; ano <= hoje.getFullYear(); ano++) {
    const fimAno =
      ano === hoje.getFullYear()
        ? { year: ano, month: hoje.getMonth() + 1, day: hoje.getDate() }
        : { year: ano, month: 12, day: 31 };
    console.log(`=== Ano ${ano} ===`);
    const de = await pickFlatpickrDate(frame, '[name="InitialDate"]', { year: ano, month: 1, day: 1 });
    const ate = await pickFlatpickrDate(frame, '[name="FinalDate"]', fimAno);
    console.log(`   De: ${de.value} | Até: ${ate.value}`);
    if (!de.ok || !ate.ok || !de.value.includes(String(ano))) {
      await page.screenshot({ path: `${OUT_DIR}/erro-datas-${ano}.png`, fullPage: true });
      throw new Error(`datas do ano ${ano} não aplicadas (De="${de.value}", Até="${ate.value}")`);
    }

    const colab = await selectMuiOption(frame, "mui-component-select-IsCollaborator", /^sim$/i);
    if (!/sim/i.test(colab.selected || "")) throw new Error(`Colaborador=Sim falhou no ano ${ano}`);
    await page.waitForTimeout(600);

    await frame.getByText("AVANÇAR", { exact: false }).first().click({ timeout: 8000 });
    await page.waitForTimeout(4000);
    frame = page.frames().find((f) => f.url().includes("reports_exec")) ?? frame;
    let stageText = await frame.evaluate(() => document.body?.innerText ?? "").catch(() => "");

    if (/- Par[âa]metros/i.test(stageText)) {
      await frame.getByText("AVANÇAR", { exact: false }).first().click({ timeout: 8000 });
      await page.waitForTimeout(4000);
      frame = page.frames().find((f) => f.url().includes("reports_exec")) ?? frame;
      stageText = await frame.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    }

    if (!/- Gera[çc][ãa]o|Escolha o modo de exporta/i.test(stageText)) {
      const erro = stageText.slice(0, 150).replace(/\n+/g, " | ");
      await page.screenshot({ path: `${OUT_DIR}/erro-geracao-${ano}.png`, fullPage: true });
      throw new Error(`ano ${ano}: não cheguei à Geração — "${erro}"`);
    }

    const csvPath = await downloadCsv(page, frame, ano);
    const { headers, rows } = parseCsv(csvPath);
    console.log(`   ${rows.length} linha(s)`);
    if (headers.length > headersGlobais.length) headersGlobais = headers;
    todas.push(...rows);

    // VOLTAR até a etapa Filtros para a próxima janela.
    for (let i = 0; i < 4; i++) {
      const txt = await frame.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      if (/- Filtros/i.test(txt)) break;
      await frame.getByText("VOLTAR", { exact: false }).first().click({ timeout: 8000 });
      await page.waitForTimeout(2500);
      frame = page.frames().find((f) => f.url().includes("reports_exec")) ?? frame;
    }
  }

  console.log(`\nTotal bruto: ${todas.length} linha(s). Colunas: ${headersGlobais.join(" | ")}`);
  fs.writeFileSync(`${OUT_DIR}/colaboradores.json`, JSON.stringify(todas, null, 2));
  console.log("Amostra:", JSON.stringify(todas.slice(0, 2), null, 2).slice(0, 1500));

  await browser.close();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
