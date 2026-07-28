// Importação de relatórios do elleven via API interna, em vez do wizard
// legado (Filtros -> Parâmetros -> Geração -> download CSV) navegado por
// Playwright em app/api/cron/sync-elleven/route.ts.
//
// Descoberta (handoff de 26/07/2026): o botão "CSV" do wizard só dispara
//   POST https://elleven.assinelm.com.br:45703/api/v1/report/generate/csv
// que devolve o CSV de forma síncrona (sem job/polling). O CSV do fetch é
// byte-a-byte igual ao baixado pelo wizard (scripts/prova-elleven-api.ts).
//
// O bloqueio é a autenticação dessa porta: o accessToken emitido por
// POST /api/general/auth/validate/token dá 401 em :45701/:45703. O token que
// funciona (~2138 chars) só existe depois que a sessão do servidor legado
// abre, governada por um cookie (SYNSUITE) cujo mecanismo de emissão não foi
// descoberto. Workaround comprovado: abrir um browser só para logar e
// navegar até a página do relatório — a própria SPA, ao carregar os
// metadados do relatório, chama :45701/:45703 com o Authorization correto.
// Capturamos esse header e fechamos o browser; a geração do CSV em si é um
// fetch puro, sem Playwright.
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

const ELLEVEN_BASE = "https://elleven.assinelm.com.br";
const CSV_ENDPOINT = `${ELLEVEN_BASE}:45703/api/v1/report/generate/csv`;
const TOKEN_CAPTURE_TIMEOUT_MS = 30000;

export type DictionaryEntry = { key: string; value: string };

export type CsvResultado = {
  headers: string[];
  rows: Record<string, string>[];
};

// Loga na UI do elleven e captura, por observação de rede, o Authorization
// que a própria SPA usa para chamar as portas internas 45701/45703 ao abrir
// a página do relatório em `reportPath`. Fecha o browser antes de retornar —
// tudo depois disso (gerarRelatorioCsv) é fetch puro.
export async function capturarBearerToken(
  login: string,
  password: string,
  reportPath: string,
): Promise<string> {
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

    let capturedToken: string | null = null;
    page.on("request", (req) => {
      if (capturedToken) return;
      if (!/:(45701|45703)\//.test(req.url())) return;
      const auth = req.headers()["authorization"];
      if (auth?.startsWith("Bearer ")) capturedToken = auth.slice("Bearer ".length);
    });

    await page.goto(`${ELLEVEN_BASE}/ui/login`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    const CPF_SELECTOR = 'input[placeholder="Entre com seu CPF"]';
    const cpfVisible = await page
      .waitForSelector(CPF_SELECTOR, { timeout: 45000 })
      .then(() => true)
      .catch(() => false);
    if (!cpfVisible) {
      throw new Error(`Campo de CPF não apareceu (URL atual: ${page.url()}).`);
    }

    await page.fill(CPF_SELECTOR, login);
    await page.fill('input[placeholder="Entre com sua senha"]', password);
    await page.click('button:has-text("Entrar")');
    await page.waitForTimeout(4000);

    if (page.url().includes("/login")) {
      throw new Error(
        "Login não avançou — continua na tela de login (credenciais incorretas ou CAPTCHA/MFA).",
      );
    }

    // Basta abrir a página do relatório: a SPA busca os metadados dele nas
    // portas internas e é essa chamada que carrega o Authorization certo.
    await page.goto(`${ELLEVEN_BASE}${reportPath}`, {
      waitUntil: "load",
      timeout: 30000,
    });

    const started = Date.now();
    while (!capturedToken && Date.now() - started < TOKEN_CAPTURE_TIMEOUT_MS) {
      await page.waitForTimeout(500);
    }

    if (!capturedToken) {
      throw new Error(
        "Não foi possível capturar o Authorization das portas 45701/45703 após o login.",
      );
    }
    return capturedToken;
  } finally {
    await browser.close().catch(() => {});
  }
}

// POST síncrono que gera o CSV do relatório. `dictionaries` são os mesmos
// pares chave/valor que a UI manda em "Filtros" — eles carregam SQL cru
// (ex.: "ccss.activation_date::DATE"), então devem ser reproduzidos
// exatamente como a UI manda, não inventados.
export async function gerarRelatorioCsv(
  token: string,
  reportId: string,
  dictionaries: DictionaryEntry[],
): Promise<CsvResultado> {
  const res = await fetch(CSV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reportId,
      dictionaries,
      conditions: dictionaries.map((d) => ({
        field: d.key,
        variable: "REPORT_CONDITIONS",
      })),
      customParameters: dictionaries.map((d) => ({ field: d.key, value: d.value })),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`report/generate/csv HTTP ${res.status}: ${body.slice(0, 500)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const utf8 = buf.toString("utf-8");
  const text = utf8.includes("ï¿½") || utf8.includes("â€") ? buf.toString("latin1") : utf8;

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headers = (lines[0] ?? "").split(";").map((h) => h.replace(/"/g, "").trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(";").map((c) => c.replace(/"/g, "").trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });

  return { headers, rows };
}

// reportId interno da API — diferente do UUID que aparece na URL do wizard
// (/ui/legacy/reports/316e54f3-...). Confirmado em produção
// (scripts/prova-elleven-api.ts): CSV idêntico ao baixado pelo wizard.
export const REPORT_ID_ATIVACAO_CONTRATOS = "7a04cd50-2a75-11ef-b44f-6de8d28ed218";

// Dictionaries do relatório "Ativação Contratos", filtrando por data de
// ativação entre `inicioIso` e `fimIso` (formato AAAA-MM-DD). Valores fixos
// (ContractStatus/Order/Direction) são exatamente os que a UI manda.
export function dictionariesAtivacaoContratos(
  inicioIso: string,
  fimIso: string,
): DictionaryEntry[] {
  return [
    { key: "FilterDate", value: "ccss.activation_date::DATE" },
    { key: "InitialDate", value: inicioIso },
    { key: "FinalDate", value: fimIso },
    { key: "ContractStatus", value: "1,2,3,4,5,6,7,9" },
    { key: "Order", value: 'p."name"' },
    { key: "Direction", value: "ASC" },
  ];
}
