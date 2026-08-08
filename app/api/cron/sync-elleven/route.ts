// Sincronização diária com o elleven (Voalle/EVO).
//
// "Funil de Vendas - Gerencial" é o relatório de vendas que alimenta a
// bonificação (trocado de "Ativação Contratos" — OS de 30/07/2026: os dados
// de Ativação Contratos não refletiam os números reais da empresa). O cron de
// "ativacao-contratos" foi desligado; a tabela ContratoAtivacaoElleven e o
// caminho de importação via API direta (lib/elleven-api.ts,
// lib/importar-elleven-auto.ts) continuam no repo só para a tela de
// importação manual (app/(app)/importar/elleven).
//
// Os relatórios ("genéricos": vendedores-comercial, funil-de-vendas,
// pedidos-de-venda) ainda não tiveram reportId/dictionaries confirmados
// contra a API, então continuam no wizard legado (Filtros -> [Parâmetros] ->
// Geração -> download CSV). "funil-de-vendas" gera LancamentoVenda ao final
// do sync (ver lib/importar-elleven-funil.ts); os demais só guardam as linhas
// cruas em ElevenRelatorioLinha.
//
// CONFIRMADO (scripts/test-elleven-scraping.ts): a etapa "Geração" tem 3
// botões (button.MuiButton-outlined) — índice 0 = PDF, índice 1 = CSV,
// índice 2 = FECHAR (fecha o wizard, não é modo de exportação). Não existe
// botão de "visualização em tela" para este relatório.
//
// Variáveis de ambiente necessárias:
//   ELLEVEN_LOGIN, ELLEVEN_PASSWORD — credenciais do elleven (CPF + senha)
//   SYNC_ELLEVEN_SECRET — protege o endpoint (?secret=... ou header x-sync-secret)
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import {
  chromium as playwrightChromium,
  type Browser,
  type Frame,
  type Page,
  type Locator,
} from "playwright-core";
import { prisma } from "@/lib/prisma";
import { garantirEstrutura } from "@/lib/ddl";
import { importarLancamentosEllevenFunil } from "@/lib/importar-elleven-funil";
import { recordCronRun } from "@/lib/cron-observability";
import { ensureFuncionarioContato } from "@/lib/ensure-schema";

export const runtime = "nodejs";
export const maxDuration = 300;

// Vários frame.evaluate() abaixo não tinham timeout algum — se a página travasse
// no meio de um evaluate, ficava pendurado até o watchdog/maxDuration (mesma causa
// já corrigida para Locator.screenshot() no passo de Geração). withTimeout()
// generaliza essa proteção para qualquer Promise do Playwright.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout-${label}-${ms}ms`)), ms),
    ),
  ]);
}
const EVAL_TIMEOUT_MS = 8000;

const ELLEVEN_BASE = "https://elleven.assinelm.com.br";

// Relatórios de venda do elleven que sincronizamos. Cada um é uma tela/assistente
// legado (mesmo fluxo: Filtros -> [Parâmetros] -> Geração -> download CSV). IDs
// vieram do menu (general/me/menus). Nenhum tem reportId/dictionaries
// confirmados contra a API interna, então todos passam pelo wizard.
// generico = guarda cada linha do CSV como JSONB em elleven_relatorio_linha.
//            "funil-de-vendas" também gera LancamentoVenda a partir dessas
//            linhas (ver lib/importar-elleven-funil.ts) — é o único que
//            alimenta a bonificação.
const REPORTS: Record<
  string,
  { path: string; nome: string; generico?: boolean; viaMenu?: string[] }
> = {
  "vendedores-comercial": {
    path: "/ui/legacy/reports/fc792c4f-d4cf-572a-361b-3502c29ede8c",
    nome: "Vendedores - Comercial",
    generico: true,
  },
  "funil-de-vendas": {
    path: "/ui/legacy/reports/9f47af3b-785a-cd9f-c1b6-c0aec822e2e3",
    nome: "Funil de Vendas - Gerencial",
    generico: true,
  },
  "pedidos-de-venda": {
    path: "/ui/legacy/reports/e2e1a318-bdfb-ae98-1510-957558e4b02e",
    nome: "Listagem Pedidos de Venda",
    generico: true,
  },
  // "Cancelamentos por Mês - Claude", do Exportador de Dados. É a fonte que
  // falta para o sistema saber que uma venda Ganha foi cancelada depois — hoje
  // importar-elleven-funil grava cancelado: 0 fixo, porque o Funil de Vendas
  // não tem esse conceito, e venda cancelada segue contando para bonificação.
  //
  // O endereço é "legacy/utilities" (Exportador de Dados), não "legacy/reports"
  // como os três acima. As duas primeiras tentativas voltaram vazias por causa
  // disso: a tela monta o iframe do legado em "/restricted/gv?hash=...", e a
  // busca do frame só aceitava "reports_exec". Ver acharFrameDoLegado.
  cancelamentos: {
    path: "/ui/04a36939-b7cb-4e54-83e1-6d92444f98c8/legacy/utilities/9cd32fd1-d070-1569-453a-c8cba6505d66",
    nome: "Cancelamentos por Mês - Claude",
    generico: true,
    // Caminho informado pela diretoria: o relatório vive no Exportador de
    // Dados. A entrada direta pela URL abre a aba mas o conteúdo nunca monta.
    viaMenu: ["Utilitários", "Exportador de Dados", "Cancelamentos por Mês - Claude"],
  },
  // Vendas fechadas que ainda não foram instaladas ("Solicitações - Em
  // andamento", filtrando ativação e pré-contrato). A diretoria descartou tirar
  // isso das negociações em Andamento do Funil de Vendas — aquela lista não
  // representa o que está em campo esperando instalação.
  //
  // Terceiro formato de endereço do elleven: "legacy/analytics". Se ele montar
  // o wizard num iframe ainda diferente dos dois conhecidos, a rodada falha com
  // a lista de frames da página no erro — que foi como o caminho do Exportador
  // de Dados apareceu.
  "solicitacoes-andamento": {
    path: "/ui/565d5331-e2d6-4724-b2ba-b227b07abe38/legacy/analytics/a05fd286-4750-353f-0e2c-4baf97fcf60a",
    nome: "Solicitações - Em andamento",
    generico: true,
    // Caminho descrito pela diretoria: "Solicitações - Em andamento > por
    // tipo". O menu exato entre a raiz e a tela ainda não é conhecido — a
    // primeira rodada com viaMenu registra o que cada clique encontrou, e é
    // por esses registros que o caminho se ajusta.
    viaMenu: ["Análises", "Solicitações - Em Andamento"],
  },
  // Faturamento por Vendedor (modal JS legado, sem iframe de relatório) e
  // CRE - Títulos Recebidos (exige campo obrigatório extra) NÃO são usados para
  // comissão — removidos da sincronização a pedido do usuário.
};
const DEFAULT_REPORT = "funil-de-vendas";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// O wizard legado do elleven roda dentro de um iframe, e o endereço dele muda
// conforme por onde se entra:
//
//  - pelos relatórios (/ui/legacy/reports/...), a URL contém "reports_exec";
//  - pelo Exportador de Dados (/ui/<workspace>/legacy/utilities/...), ela é
//    "/restricted/gv?hash=..." — descoberto em 08/08/2026, quando o sync de
//    "Cancelamentos por Mês" falhou procurando só por reports_exec e o
//    diagnóstico gravado mostrou qual iframe a página realmente monta.
//
// Ficam de fora frames de terceiros que a página carrega junto (o widget de
// ajuda Stonly, por exemplo) e o próprio frame principal.
//
// A ORDEM importa: uma página de relatório pode ter os dois frames ao mesmo
// tempo — a casca do legado em /restricted/gv e o relatório em si em
// reports_exec. Pegar o primeiro que casasse fez o sync do Funil de Vendas
// voltar com zero linha às 11:30 de 08/08/2026 (nada foi perdido: sem CSV, o
// bloco de gravação nem chega a rodar). Por isso reports_exec vem sempre
// primeiro, e /restricted/gv só quando ele não existe — que é o caso das telas
// abertas pelo Exportador de Dados.
function acharFrameDoLegado(page: Page): Frame | undefined {
  const doElleven = page
    .frames()
    .filter((f: Frame) => f.url().includes("elleven.assinelm.com.br"));
  return (
    doElleven.find((f: Frame) => f.url().includes("reports_exec")) ??
    doElleven.find((f: Frame) => f.url().includes("/restricted/gv"))
  );
}

// Clica no primeiro elemento clicável visível cujo texto contenha `texto`
// (sem acento, sem caixa). Entre vários candidatos, o de texto mais curto — o
// item de menu "Utilitários" ganha de um contêiner que também contém a palavra.
// É a peça da navegação via menu (ver report.viaMenu): cliques do jeito que uma
// pessoa faria, porque a entrada direta pela URL não monta essas telas.
async function clicarPorTexto(
  frame: Frame,
  texto: string,
): Promise<{ ok: boolean; achados: number; usado?: string }> {
  return withTimeout(
    frame.evaluate((alvo) => {
      const norm = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
      const alvoN = norm(alvo);
      const sel =
        'button, a, li, [role="button"], [role="tab"], [role="menuitem"], [role="option"]';
      const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      const candidatos = els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((e) => ({ e, t: norm(e.innerText || "") }))
        .filter((x) => x.t.includes(alvoN))
        .sort((a, b) => a.t.length - b.t.length);
      if (candidatos.length === 0) return { ok: false, achados: 0 };
      const escolhido = candidatos[0].e;
      escolhido.scrollIntoView({ block: "center" });
      escolhido.click();
      return {
        ok: true,
        achados: candidatos.length,
        usado: (escolhido.innerText || "").replace(/\s+/g, " ").slice(0, 80),
      };
    }, texto),
    EVAL_TIMEOUT_MS,
    `clicar-${texto}`,
  ).catch((e: unknown) => ({ ok: false, achados: -1, usado: `ERRO: ${e}` }));
}

// Garante que a tabela genérica exista antes de gravar, criando-a sob demanda
// (idempotente, IF NOT EXISTS — mesmo padrão da migração do CPF). Assim o save
// dos relatórios genéricos funciona sem depender de aplicar a migração à mão.
let relatorioTableEnsured = false;
async function ensureRelatorioTable(): Promise<void> {
  if (relatorioTableEnsured) return;
  // Schema-qualificado desde o cutover de 24/07/2026: sem o prefixo, o
  // IF NOT EXISTS checaria só o search_path (public) e criaria uma tabela
  // duplicada vazia lá, ignorando a real em "bonificacao".
  await garantirEstrutura([`CREATE TABLE IF NOT EXISTS "bonificacao"."elleven_relatorio_linha" (
      "id" SERIAL NOT NULL,
      "relatorio" TEXT NOT NULL,
      "periodo" TEXT NOT NULL,
      "chave" TEXT NOT NULL,
      "dados" JSONB NOT NULL,
      "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "elleven_relatorio_linha_pkey" PRIMARY KEY ("id")
    );`]);
  await garantirEstrutura([`CREATE INDEX IF NOT EXISTS "elleven_relatorio_linha_relatorio_periodo_idx" ON "bonificacao"."elleven_relatorio_linha"("relatorio", "periodo");`]);
  await garantirEstrutura([`CREATE UNIQUE INDEX IF NOT EXISTS "elleven_relatorio_linha_relatorio_periodo_chave_key" ON "bonificacao"."elleven_relatorio_linha"("relatorio", "periodo", "chave");`]);
  relatorioTableEnsured = true;
}

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron envia "Authorization: Bearer $CRON_SECRET" automaticamente
  // quando CRON_SECRET está definido nas env vars.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`)
    return true;

  // Para disparo manual/diagnóstico: ?secret=... ou header x-sync-secret.
  const manualSecret = process.env.SYNC_ELLEVEN_SECRET;
  const provided =
    req.nextUrl.searchParams.get("secret") || req.headers.get("x-sync-secret");
  if (manualSecret && provided === manualSecret) return true;

  return false;
}

// Descreve, de forma compacta, todos os elementos interativos visíveis do
// frame — usado para descobrir seletores reais sem precisar de um dump
// gigante de HTML (a UI é React/MUI + DevExtreme com classes geradas).
const DESCRIBE_INTERACTIVE_ELEMENTS_SRC = `
  function describe(el) {
    function closestLabelText(el) {
      const byFor = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null;
      if (byFor && byFor.innerText) return byFor.innerText.trim();
      const wrapLabel = el.closest('label');
      if (wrapLabel && wrapLabel.innerText) return wrapLabel.innerText.trim();
      const fieldWrap = el.closest('.MuiFormControl-root, .dx-field, .dx-fieldset-item, [class*="field" i]');
      if (fieldWrap) {
        const lbl = fieldWrap.querySelector('label, .dx-field-label, .MuiFormLabel-root, .MuiInputLabel-root');
        if (lbl && lbl.innerText) return lbl.innerText.trim();
      }
      return '';
    }
    const rect = el.getBoundingClientRect();
    const svgTestId = el.querySelector('[data-testid]') ? el.querySelector('[data-testid]').getAttribute('data-testid') : '';
    const svgTitle = el.querySelector('title') ? el.querySelector('title').textContent : '';
    return {
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      id: el.id || '',
      name: el.getAttribute('name') || '',
      role: el.getAttribute('role') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      className: (el.className || '').toString().slice(0, 100),
      text: (el.innerText || el.textContent || '').trim().slice(0, 60),
      value: el.value !== undefined ? String(el.value).slice(0, 60) : '',
      label: closestLabelText(el),
      titleAttr: el.getAttribute('title') || '',
      iconTestId: svgTestId || '',
      svgTitle: svgTitle || '',
      visible: rect.width > 0 && rect.height > 0,
    };
  }
  const sel = 'input, select, textarea, button, [role="button"], [role="combobox"], [role="checkbox"], [role="textbox"], .dx-texteditor-input, .dx-selectbox, .dx-checkbox, .dx-button';
  return Array.from(document.querySelectorAll(sel)).map(describe).filter(function (d) { return d.visible; });
`;

async function describeInteractiveElements(frame: Frame) {
  return withTimeout(
    frame.evaluate(new Function(DESCRIBE_INTERACTIVE_ELEMENTS_SRC) as () => unknown),
    EVAL_TIMEOUT_MS,
    "describeInteractiveElements",
  ).catch((e: unknown) => `ERRO: ${e}`);
}

// Clica no botão de export CSV e captura o download via page.waitForEvent.
// IMPORTANTE: o índice do botão CSV varia por relatório — "Ativação Contratos"
// tem 3 botões (PDF, CSV, FECHAR) e outros têm 2 (CSV, FECHAR). Por isso
// localizamos o botão pelo texto "CSV", não por índice. A geração do CSV no
// servidor do elleven pode ser lenta, por isso o timeout generoso de 180s.
// Depois de baixado, detecta o encoding (UTF-8 ou Latin-1) e faz o parse do
// CSV (separador ';', padrão BR) em headers + linhas.
async function downloadAndParseCsv(
  page: Page,
  csvButton: Locator,
): Promise<{
  ok: boolean;
  error?: string;
  csvHeaders: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  rows: Record<string, string>[];
}> {
  let download;
  try {
    [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 180_000 }),
      csvButton.click({ timeout: 10_000 }),
    ]);
  } catch (e) {
    return {
      ok: false,
      error: `Timeout/erro esperando download do CSV: ${e}`,
      csvHeaders: [],
      rowCount: 0,
      sampleRows: [],
      rows: [],
    };
  }

  try {
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    const raw = Buffer.concat(chunks);

    // Detecta encoding: se o UTF-8 tiver os artefatos típicos de um Latin-1
    // mal interpretado, refaz a decodificação como Latin-1.
    const utf8 = raw.toString("utf-8");
    const text =
      utf8.includes("ï¿½") || utf8.includes("â€") ? raw.toString("latin1") : utf8;

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const csvHeaders = (lines[0] ?? "")
      .split(";")
      .map((h) => h.replace(/"/g, "").trim());
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(";").map((c) => c.replace(/"/g, "").trim());
      return Object.fromEntries(csvHeaders.map((h, i) => [h, cells[i] ?? ""]));
    });

    return {
      ok: true,
      csvHeaders,
      rowCount: rows.length,
      sampleRows: rows.slice(0, 3),
      rows,
    };
  } catch (e) {
    return {
      ok: false,
      error: `Erro lendo/parseando CSV: ${e}`,
      csvHeaders: [],
      rowCount: 0,
      sampleRows: [],
      rows: [],
    };
  }
}

async function clickByText(frame: Frame, text: string): Promise<boolean> {
  try {
    const locator = frame.getByText(text, { exact: false }).first();
    await locator.waitFor({ state: "visible", timeout: 5000 });
    await locator.click();
    return true;
  } catch {
    return false;
  }
}

// Abre um MUI Select pelo id (ids costumam começar com dígito/UUID, por isso
// usamos o seletor de atributo [id="..."] em vez de "#id") e escolhe a opção
// cujo texto bate com `matchRegex`, ou a primeira disponível como fallback.
async function selectMuiOption(
  frame: Frame,
  elementId: string,
  matchRegex: RegExp,
) {
  const result: { opened: boolean; options: string[]; selected?: string } = {
    opened: false,
    options: [],
  };
  try {
    await frame.locator(`[id="${elementId}"]`).click({ timeout: 5000 });
    result.opened = true;
  } catch {
    return result;
  }
  await frame.page().waitForTimeout(600);
  const options = await withTimeout(
    frame.evaluate(() =>
      Array.from(
        document.querySelectorAll('li[role="option"], ul[role="listbox"] li'),
      ).map((el) => (el.textContent || "").trim()),
    ),
    EVAL_TIMEOUT_MS,
    "selectMuiOption-options",
  ).catch(() => [] as string[]);
  result.options = options as string[];
  if (result.options.length > 0) {
    const idx = result.options.findIndex((o) => matchRegex.test(o));
    const target = idx >= 0 ? idx : 0;
    try {
      await frame
        .locator('li[role="option"]')
        .nth(target)
        .click({ timeout: 5000 });
      result.selected = result.options[target];
    } catch {
      /* ignore */
    }
  }
  return result;
}

// Data "hoje"/"mês corrente" SEMPRE no fuso de Brasília (America/Sao_Paulo), e
// não no relógio do servidor: em produção (Vercel) o servidor é UTC, então a
// partir das ~21h do último dia do mês o UTC já virou o mês seguinte e o sync
// puxaria o relatório do Elleven do mês errado na virada. Intl garante o dia/mês
// corretos no Brasil sem depender de ajuste manual a cada mês.
function saoPauloParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { dd: get("day"), mm: get("month"), yyyy: get("year") };
}

function dateFormats({ dd, mm, yyyy }: { dd: string; mm: string; yyyy: string }) {
  return { br: `${dd}/${mm}/${yyyy}`, iso: `${yyyy}-${mm}-${dd}` };
}

function todayFormats() {
  return dateFormats(saoPauloParts(new Date()));
}

// Primeiro dia do mês corrente — usado como "Data Inicial" para puxar o relatório
// do mês inteiro (a cada rodada, do dia 1º até hoje). O upsert por número de
// contrato garante que reprocessar os mesmos dias não gera duplicata.
function firstOfMonthFormats() {
  const { mm, yyyy } = saoPauloParts(new Date());
  return dateFormats({ dd: "01", mm, yyyy });
}

// Intervalo de datas de um período "AAAA-MM" qualquer — o que permite
// reprocessar um mês passado (?periodo=2026-07). Existe por causa do bug do
// identificador de linhas (corrigido em 1.3.0): as linhas descartadas nunca
// chegaram ao banco, então recuperar julho exige extrair o CSV daquele mês de
// novo — e o wizard só filtrava o mês corrente.
//
// `usarInteracao` é o detalhe que importa: o Flatpickr abre SEMPRE mostrando o
// mês corrente, então o caminho de clique (clickFlatpickrDay/Today) escolheria
// o dia certo do MÊS ERRADO para qualquer período passado. Para período
// passado, só a API JS (setFlatpickrDate) serve.
function rangeDoPeriodo(periodo: string) {
  const [yyyy, mm] = periodo.split("-");
  const hoje = saoPauloParts(new Date());
  const ehCorrente = `${hoje.yyyy}-${hoje.mm}` === periodo;
  const ultimoDia = new Date(Date.UTC(Number(yyyy), Number(mm), 0)).getUTCDate();
  return {
    inicio: dateFormats({ dd: "01", mm, yyyy }),
    fim: dateFormats({ dd: String(ultimoDia).padStart(2, "0"), mm, yyyy }),
    usarInteracao: ehCorrente,
  };
}
type RangePeriodo = ReturnType<typeof rangeDoPeriodo>;

// Define a data num input controlado pela biblioteca Flatpickr usando a API JS dela
// (window/elemento expõe `_flatpickr`), em vez de digitar — o input costuma ser
// somente leitura ou interceptar o teclado para navegação do calendário, então
// `.fill()`/digitação simulada não funciona de forma confiável.
async function setFlatpickrDate(
  frame: Frame,
  selector: string,
  isoDate: string,
): Promise<{ ok: boolean; valueAfter: string; debug: string }> {
  return withTimeout(
    frame.evaluate(
      ({ selector, isoDate }) => {
        const el = document.querySelector(selector) as HTMLInputElement | null;
        if (!el)
          return {
            ok: false,
            valueAfter: "",
            debug: "elemento-nao-encontrado",
          };
        const anyEl = el as unknown as Record<string, unknown>;
        const fp = anyEl._flatpickr as
          { setDate: (d: string, triggerChange: boolean) => void } | undefined;
        if (fp) {
          fp.setDate(isoDate, true);
          return {
            ok: true,
            valueAfter: el.value || "",
            debug: "usou-_flatpickr",
          };
        }
        // fallback: algumas versões só registram a instância no array global window.flatpickr.instances
        const globalFp = (
          window as unknown as {
            flatpickr?: {
              instances?: Array<{
                _input?: HTMLElement;
                setDate: (d: string, triggerChange: boolean) => void;
              }>;
            };
          }
        ).flatpickr;
        const inst = globalFp?.instances?.find((i) => i._input === el);
        if (inst) {
          inst.setDate(isoDate, true);
          return {
            ok: true,
            valueAfter: el.value || "",
            debug: "usou-registro-global",
          };
        }
        // fallback: react-flatpickr guarda a instância em `this.flatpickr` no componente
        // React (não no DOM) — sobe a árvore de fiber a partir do nó procurando isso.
        const fiberKey = Object.keys(anyEl).find(
          (k) =>
            k.startsWith("__reactFiber$") ||
            k.startsWith("__reactInternalInstance$"),
        );
        if (fiberKey) {
          type FiberNode = { stateNode?: unknown; return?: FiberNode | null };
          let fiber = anyEl[fiberKey] as FiberNode | undefined;
          for (
            let depth = 0;
            fiber && depth < 25;
            depth++, fiber = fiber.return ?? undefined
          ) {
            const sn = fiber.stateNode as
              Record<string, unknown> | null | undefined;
            const fpInst =
              sn &&
              (sn.flatpickr as
                | { setDate: (d: string, triggerChange: boolean) => void }
                | undefined);
            if (fpInst && typeof fpInst.setDate === "function") {
              fpInst.setDate(isoDate, true);
              return {
                ok: true,
                valueAfter: el.value || "",
                debug: `usou-react-fiber-flatpickr (depth=${depth})`,
              };
            }
          }
        }
        const underscoreKeys = Object.keys(anyEl).filter((k) =>
          k.startsWith("_"),
        );
        return {
          ok: false,
          valueAfter: el.value || "",
          debug: `sem-instancia-flatpickr; chaves-underscore=${underscoreKeys.join(",")}`,
        };
      },
      { selector, isoDate },
    ),
    EVAL_TIMEOUT_MS,
    "setFlatpickrDate",
  ).catch((e: unknown) => ({
    ok: false,
    valueAfter: "",
    debug: `erro-evaluate: ${e}`,
  }));
}

// Abre o calendário do Flatpickr clicando no input (comportamento padrão da lib:
// `clickOpens`) e clica na célula do dia de hoje — simula a interação real do
// usuário, que é o único caminho confiável até agora para o estado do formulário
// (fora do DOM) reconhecer a mudança de valor.
async function clickFlatpickrToday(
  frame: Frame,
  selector: string,
): Promise<{ ok: boolean; valueAfter: string; debug: string }> {
  try {
    const locator = frame.locator(selector);
    await locator.click({ timeout: 3000 });
    const todayCell = frame
      .locator(".flatpickr-calendar.open .flatpickr-day.today")
      .first();
    await todayCell.waitFor({ state: "visible", timeout: 3000 });
    await todayCell.click({ timeout: 3000 });
    await frame.page().waitForTimeout(300);
    const valueAfter = await locator.inputValue().catch(() => "");
    return {
      ok: valueAfter.length > 0,
      valueAfter,
      debug: "clicou-dia-today-no-calendario",
    };
  } catch (e) {
    return { ok: false, valueAfter: "", debug: `erro-click-calendario: ${e}` };
  }
}

// Abre o calendário e clica na célula de um dia específico DO MÊS ATUALMENTE
// EXIBIDO (ao abrir, o Flatpickr mostra o mês da data corrente por padrão),
// ignorando as células de transbordo do mês anterior/seguinte. Usado para
// selecionar o dia 1º como "Data Inicial". Mesma interação real do
// clickFlatpickrToday, que é a única que o estado do formulário reconhece.
async function clickFlatpickrDay(
  frame: Frame,
  selector: string,
  dayNumber: number,
): Promise<{ ok: boolean; valueAfter: string; debug: string }> {
  try {
    const locator = frame.locator(selector);
    await locator.click({ timeout: 3000 });
    const dayCell = frame
      .locator(
        ".flatpickr-calendar.open .flatpickr-day:not(.prevMonthDay):not(.nextMonthDay):not(.flatpickr-disabled)",
      )
      .filter({ hasText: new RegExp(`^${dayNumber}$`) })
      .first();
    await dayCell.waitFor({ state: "visible", timeout: 3000 });
    await dayCell.click({ timeout: 3000 });
    await frame.page().waitForTimeout(300);
    const valueAfter = await locator.inputValue().catch(() => "");
    return {
      ok: valueAfter.length > 0,
      valueAfter,
      debug: `clicou-dia-${dayNumber}-no-calendario`,
    };
  } catch (e) {
    return {
      ok: false,
      valueAfter: "",
      debug: `erro-click-dia-${dayNumber}: ${e}`,
    };
  }
}

// Abre o calendário e NAVEGA até o mês da data alvo pelas setas de mês
// (‹ ›), depois clica na célula do dia — a mesma sequência de uma pessoa.
//
// Existe porque a via de API (setFlatpickrDate) falhou em produção para mês
// passado (extração de julho, 08/08/2026): o formulário não reconheceu o valor
// e o relatório saiu com o filtro em branco, trazendo linhas de junho. Clique
// real é o único caminho que o estado do wizard comprovadamente enxerga — o
// que já valia para o mês corrente (clickFlatpickrDay/Today) e agora vale para
// qualquer mês. A célula certa é achada pelo `dateObj` que o Flatpickr guarda
// em cada dia — independe de idioma e de célula de transbordo.
async function clickFlatpickrDate(
  frame: Frame,
  selector: string,
  isoDate: string,
): Promise<{ ok: boolean; valueAfter: string; debug: string }> {
  try {
    const locator = frame.locator(selector);
    await locator.click({ timeout: 3000 });
    await frame
      .locator(".flatpickr-calendar.open")
      .first()
      .waitFor({ state: "visible", timeout: 3000 });

    // Até 30 passos de navegação: cobre 2,5 anos de distância — folga larga
    // sobre o caso real (1 mês) sem risco de loop infinito.
    for (let i = 0; i < 30; i++) {
      const passo = await withTimeout(
        frame.evaluate((alvoIso) => {
          const cal = document.querySelector(".flatpickr-calendar.open");
          if (!cal) return "sem-calendario";
          const [yyyy, mm, dd] = alvoIso.split("-").map(Number);
          const alvo = yyyy * 10000 + (mm - 1) * 100 + dd;
          const chave = (d: Date) =>
            d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
          const dias = Array.from(
            cal.querySelectorAll<HTMLElement & { dateObj?: Date }>(".flatpickr-day"),
          );
          if (dias.length === 0 || !(dias[0].dateObj instanceof Date))
            return "sem-dateObj";
          const celula = dias.find(
            (d) =>
              d.dateObj &&
              chave(d.dateObj) === alvo &&
              !d.classList.contains("flatpickr-disabled"),
          );
          if (celula) {
            celula.click();
            return "clicou";
          }
          const primeiro = chave(dias[0].dateObj as Date);
          const seta = cal.querySelector<HTMLElement>(
            alvo < primeiro ? ".flatpickr-prev-month" : ".flatpickr-next-month",
          );
          if (!seta) return "sem-seta";
          seta.click();
          return "navegou";
        }, isoDate),
        EVAL_TIMEOUT_MS,
        "clickFlatpickrDate",
      );

      if (passo === "clicou") {
        await frame.page().waitForTimeout(300);
        const valueAfter = await locator.inputValue().catch(() => "");
        return {
          ok: valueAfter.length > 0,
          valueAfter,
          debug: `navegou-e-clicou-${isoDate}`,
        };
      }
      if (passo !== "navegou") {
        return { ok: false, valueAfter: "", debug: `parou-em-${passo}` };
      }
      await frame.page().waitForTimeout(150);
    }
    return { ok: false, valueAfter: "", debug: "nao-alcancou-o-mes-em-30-passos" };
  } catch (e) {
    return { ok: false, valueAfter: "", debug: `erro-navegacao: ${e}` };
  }
}

// Tenta preencher, de forma best-effort, qualquer input cujo rótulo/placeholder/name
// sugira ser um campo de data (ex.: "Data Inicial", "Data Final") com o intervalo
// do período pedido — mês corrente por padrão, mês passado via ?periodo=.
async function fillDateLikeInputs(
  frame: Frame,
  range: RangePeriodo,
): Promise<
  Array<{
    selector: string;
    ok: boolean;
    label: string;
    valueAfter: string;
    debug?: string;
  }>
> {
  const results: Array<{
    selector: string;
    ok: boolean;
    label: string;
    valueAfter: string;
    debug?: string;
  }> = [];
  const inicioMes = range.inicio;
  const fimMes = range.fim;
  const candidates = (await describeInteractiveElements(frame)) as Array<
    Record<string, unknown>
  >;
  if (!Array.isArray(candidates)) return results;
  for (const el of candidates) {
    if (el.tag !== "input") continue;
    const name = String(el.name || "");
    if (name === "FilterDate") continue; // já tratado por selectMuiOption, não é um campo de data digitável
    const label = String(el.label || "");
    const placeholder = String(el.placeholder || "");
    const id = String(el.id || "");
    const className = String(el.className || "");
    const haystack = `${label} ${placeholder} ${name}`.toLowerCase();
    const looksLikeDate = /data|date|inicial|final|início|inicio|fim/.test(
      haystack,
    );
    if (!looksLikeDate) continue;
    const selector = name ? `[name="${name}"]` : id ? `[id="${id}"]` : "";
    if (!selector) continue;

    // Classifica o campo: "Data Inicial" recebe o dia 1º do mês; "Data Final"
    // (e qualquer campo de data não classificável) recebe hoje. Assim cada
    // rodada do cron puxa o relatório do mês inteiro (dia 1º -> hoje).
    const isFinal = /final|fim/i.test(haystack); const isInicial = !isFinal && /inicial|início|inicio|\bde\b|from/.test(haystack);
    const alvo = isInicial ? inicioMes : fimMes;

    if (className.includes("flatpickr")) {
      // 1ª tentativa: interação real (abrir o calendário e clicar na célula do
      // dia certo) — é o único caminho que dispara corretamente o estado do
      // formulário. Para período passado, a interação NAVEGA até o mês alvo
      // (clickFlatpickrDate) — a via de API direta comprovadamente não pega
      // neste wizard (extração de julho, 08/08/2026). 2ª tentativa (fallback):
      // API JS via fiber do React.
      let attempt = range.usarInteracao
        ? isInicial
          ? await clickFlatpickrDay(frame, selector, 1)
          : await clickFlatpickrToday(frame, selector)
        : await clickFlatpickrDate(frame, selector, alvo.iso);
      if (!attempt.ok) {
        let apiAttempt = await setFlatpickrDate(frame, selector, alvo.iso);
        for (let i = 0; i < 5 && !apiAttempt.ok; i++) {
          await frame.page().waitForTimeout(400);
          apiAttempt = await setFlatpickrDate(frame, selector, alvo.iso);
        }
        attempt = apiAttempt;
      }
      results.push({
        selector,
        ok: attempt.ok,
        label: label || placeholder || name,
        valueAfter: attempt.valueAfter,
        debug: `${isInicial ? "inicial" : "final"}: ${attempt.debug}`,
      });
      continue;
    }

    let ok = false;
    const digitsOnly = alvo.br.replace(/\D/g, "");
    try {
      const locator = frame.locator(selector);
      await locator.click({ timeout: 3000, clickCount: 3 });
      await locator.press("Delete").catch(() => {});
      await locator.pressSequentially(digitsOnly, { delay: 80, timeout: 5000 });
      await locator.press("Escape").catch(() => {});
      ok = true;
    } catch {
      /* ignore */
    }
    const valueAfter = await frame
      .locator(selector)
      .inputValue()
      .catch(() => "");
    results.push({
      selector,
      ok,
      label: `${isInicial ? "inicial" : "final"}: ${label || placeholder || name}`,
      valueAfter,
    });
  }
  return results;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();

  // Cron não passa pelo requireUser, que é quem cria as colunas extras do
  // Funcionario sob demanda. Sem isto, qualquer leitura de Funcionario aqui
  // dentro falha inteira quando o schema tem uma coluna que o banco ainda não
  // tem (ver lib/ensure-schema.ts).
  await ensureFuncionarioContato();

  const login = process.env.ELLEVEN_LOGIN;
  const password = process.env.ELLEVEN_PASSWORD;
  if (!login || !password) {
    return NextResponse.json(
      {
        error: "ELLEVEN_LOGIN/ELLEVEN_PASSWORD não configurados nas env vars.",
      },
      { status: 500 },
    );
  }

  const slug = req.nextUrl.searchParams.get("report") || DEFAULT_REPORT;
  const report = REPORTS[slug];
  if (!report) {
    return NextResponse.json(
      {
        error: `Relatório desconhecido: "${slug}". Válidos: ${Object.keys(REPORTS).join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Período a extrair: mês corrente por padrão; ?periodo=AAAA-MM para
  // reprocessar um mês passado (recuperação das linhas perdidas pelo bug do
  // identificador — 1.3.0). Futuro não existe no Elleven, então é erro.
  const periodoCorrente = firstOfMonthFormats().iso.slice(0, 7);
  const periodoAlvo =
    req.nextUrl.searchParams.get("periodo") ?? periodoCorrente;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoAlvo)) {
    return NextResponse.json(
      { error: `Período inválido: "${periodoAlvo}". Formato: AAAA-MM.` },
      { status: 400 },
    );
  }
  if (periodoAlvo > periodoCorrente) {
    return NextResponse.json(
      { error: `Período no futuro: "${periodoAlvo}".` },
      { status: 400 },
    );
  }

  // O cabeçalho de cada etapa do assistente é "<Nome do Relatório> - <Etapa>"
  // (ex.: "Ativação Contratos - Geração"). Ancoramos no nome do relatório para
  // não confundir com um eventual breadcrump/stepper que liste as etapas.
  const headingBase = escapeRegex(report.nome).replace(/\s+/g, "\\s+");
  const reParametros = new RegExp(`${headingBase}\\s*-\\s*Par[âa]metros`, "i");
  const reGeracao = new RegExp(`${headingBase}\\s*-\\s*Gera[çc][ãa]o`, "i");

  const started = Date.now();
  const log: string[] = [];
  const step = (s: string) => {
    const line = `[${new Date().toISOString()}] ${s}`;
    log.push(line);
    console.log(line);
  };

  const wizardSteps: Array<Record<string, unknown>> = [];
  let browser: Browser | undefined;

  // Já tivemos execuções que travaram por mais de 300s sem retornar erro (o
  // maxDuration do Vercel mata a function, mas a conexão HTTP não fecha de
  // forma limpa e o fetch do cliente fica pendurado esperando para sempre).
  // Esse watchdog garante que SEMPRE devolvemos alguma resposta — com o log
  // e os wizardSteps coletados até então — bem antes desse limite.
  const WATCHDOG_MS = 260000;
  const watchdog = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      step(
        `WATCHDOG: excedeu ${WATCHDOG_MS}ms — retornando estado parcial antes do timeout do servidor.`,
      );
      resolve(
        NextResponse.json(
          { ok: false, error: "watchdog-timeout", log, wizardSteps },
          { status: 200 },
        ),
      );
    }, WATCHDOG_MS);
  });

  const runWizard = async (): Promise<NextResponse> => {
    try {
      step("Iniciando Chromium serverless...");
      browser = await playwrightChromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
      });

      // Diagnóstico do carregamento da SPA de login: se o #root não montar, esses
      // arrays revelam a causa (erro de JS na página, bundle bloqueado, etc.).
      const pageConsoleErrors: string[] = [];
      const pageFailedRequests: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") pageConsoleErrors.push(m.text().slice(0, 300));
      });
      page.on("pageerror", (e) =>
        pageConsoleErrors.push(`PAGEERROR: ${e.message.slice(0, 300)}`),
      );
      page.on("requestfailed", (r) =>
        pageFailedRequests.push(
          `${r.url().slice(0, 200)} :: ${r.failure()?.errorText ?? ""}`,
        ),
      );

      step("Abrindo tela de login do elleven...");
      await page.goto(`${ELLEVEN_BASE}/ui/login`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      const CPF_SELECTOR = 'input[placeholder="Entre com seu CPF"]';
      let cpfVisible = await page
        .waitForSelector(CPF_SELECTOR, { timeout: 45000 })
        .then(() => true)
        .catch(() => false);

      // A hidratação do React às vezes não conclui a tempo em Chromium serverless
      // (CPU limitada / cold start) — recarrega e tenta de novo, até 2 reloads.
      for (let tentativa = 1; !cpfVisible && tentativa <= 2; tentativa++) {
        step(`Campo de CPF não apareceu — reload ${tentativa}/2...`);
        await page
          .reload({ waitUntil: "domcontentloaded", timeout: 45000 })
          .catch(() => {});
        cpfVisible = await page
          .waitForSelector(CPF_SELECTOR, { timeout: 45000 })
          .then(() => true)
          .catch(() => false);
      }

      if (!cpfVisible) {
        const failScreenshot = await page
          .screenshot({ timeout: 10000 })
          .catch(() => null);
        const rootDump = await withTimeout(
          page.evaluate(() => ({
            bodyLen: (document.body?.innerText || "").length,
            rootHtml: (
              document.getElementById("root")?.innerHTML || "NO_ROOT"
            ).slice(0, 400),
            scripts: Array.from(document.scripts)
              .map((s) => s.src)
              .filter(Boolean),
          })),
          EVAL_TIMEOUT_MS,
          "login-fail-rootDump",
        ).catch((e) => ({ erro: String(e) }));
        wizardSteps.push({
          name: "login-cpf-nao-encontrado",
          url: page.url(),
          title: await page.title().catch(() => "?"),
          rootDump,
          consoleErrors: pageConsoleErrors.slice(0, 20),
          failedRequests: pageFailedRequests.slice(0, 20),
          screenshotBase64: failScreenshot
            ? failScreenshot.toString("base64")
            : null,
        });
        throw new Error(
          `Campo de CPF não apareceu após reloads (URL atual: ${page.url()}).`,
        );
      }

      await page.fill(CPF_SELECTOR, login);
      await page.fill('input[placeholder="Entre com sua senha"]', password);
      await page.click('button:has-text("Entrar")');
      await page.waitForTimeout(6000);
      step(`Login concluído. URL atual: ${page.url()}`);

      if (page.url().includes("/login")) {
        throw new Error(
          "Login não avançou — continua na tela de login (credenciais incorretas ou CAPTCHA/MFA apareceu).",
        );
      }

      if (report.viaMenu) {
        // As telas do Exportador de Dados e de analytics não montam o conteúdo
        // quando se entra direto pela URL: a aba abre, fica selecionada, e a
        // área de conteúdo nunca carrega (capturas de 08/08/2026 — 21 elementos
        // na página, todos menu e moldura). O caminho que uma pessoa faz — pelo
        // menu — é o que dispara a montagem. Cada clique registra o que a tela
        // ofereceu, então uma etapa que não for encontrada diz exatamente o que
        // havia no lugar dela.
        step(`Navegando pelo menu: ${report.viaMenu.join(" → ")}...`);
        await page.goto(`${ELLEVEN_BASE}/ui/`, {
          waitUntil: "load",
          timeout: 45000,
        });
        await page.waitForTimeout(5000);
        for (const texto of report.viaMenu) {
          const clique = await clicarPorTexto(page.mainFrame(), texto);
          wizardSteps.push({
            name: `menu-${texto}`,
            ...clique,
            elementosDepois: await describeInteractiveElements(page.mainFrame()),
          });
          step(
            `Menu "${texto}": ${clique.ok ? `cliquei em "${clique.usado}"` : "NÃO ENCONTRADO"} (${clique.achados} candidato(s))`,
          );
          if (!clique.ok) break;
          await page.waitForTimeout(4000);
        }
      } else {
        step(`Navegando até o relatório ${report.nome}...`);
        await page.goto(`${ELLEVEN_BASE}${report.path}`, {
          waitUntil: "load",
          timeout: 30000,
        });
      }

      // ESPERAR o reports_exec antes de aceitar a casca é o ponto todo.
      //
      // Preferir reports_exec quando os dois frames já existem não bastava: no
      // carregamento, a casca (/restricted/gv) aparece ANTES, e aceitá-la
      // encerrava a espera. O wizard então rodava contra um frame sem
      // formulário nenhum — "Filtrar por: opções []", "AVANÇAR: false", zero
      // linha. Foi o que derrubou o Funil das 11:30 e os Pedidos das 11:40 em
      // 08/08/2026.
      //
      // Então: gasta-se toda a janela de espera procurando o relatório de
      // verdade e, só se ele nunca aparecer, cai-se para a casca — que é o
      // único frame das telas abertas pelo Exportador de Dados e por analytics.
      const ehReportsExec = (f: Frame) =>
        f.url().includes("elleven.assinelm.com.br") &&
        f.url().includes("reports_exec");

      let reportFrame = page.frames().find(ehReportsExec);
      for (let i = 0; i < 20 && !reportFrame; i++) {
        await page.waitForTimeout(2000);
        reportFrame = page.frames().find(ehReportsExec);
      }
      if (!reportFrame) {
        reportFrame = acharFrameDoLegado(page);
        if (reportFrame) {
          step(
            "Sem iframe reports_exec após a espera — seguindo pela casca do " +
              "legado (tela de Exportador de Dados / analytics).",
          );
        }
      }
      step(
        `Frame do sistema legado encontrado: ${!!reportFrame}` +
          (reportFrame ? ` (${reportFrame.url().slice(0, 80)})` : ""),
      );

      if (reportFrame) {
        for (let i = 0; i < 10; i++) {
          const hasText = await withTimeout(
            reportFrame.evaluate(
              () => (document.body?.innerText ?? "").trim().length > 0,
            ),
            EVAL_TIMEOUT_MS,
            "hasText",
          ).catch(() => false);
          if (hasText) break;
          await page.waitForTimeout(1500);
        }
      }

      const allFrameUrls = page.frames().map((f: Frame) => f.url());
      let modeResult: Awaited<ReturnType<typeof downloadAndParseCsv>> | null = null;
      let savedCount = 0;
      let errorCount = 0;
      // Mensagem do erro de gravação, para a rodada aparecer vermelha em
      // /api/health/crons. Antes, falha ao salvar só somava em errorCount e o
      // recordCronRun ainda registrava ok:true — o CSV vinha, nada era gravado,
      // e o monitor de saúde dizia que estava tudo bem.
      let erroSalvando: string | null = null;
      // Resultado do preenchimento de datas, gravado nos detalhes da rodada:
      // sem isso, diagnosticar filtro errado exigia repetir a rodada (a
      // resposta HTTP com wizardSteps é descartada pelo cron).
      let dateFill: unknown = null;
      // Só "funil-de-vendas" gera lançamentos automáticos (ver bloco de save
      // genérico abaixo); os demais relatórios ficam null aqui.
      let importacaoAuto: Awaited<
        ReturnType<typeof importarLancamentosEllevenFunil>
      > | null = null;

      if (reportFrame) {
        // Etapa 1: Filtros
        const step1Text = await withTimeout(
          reportFrame.evaluate(() => document.body?.innerText ?? ""),
          EVAL_TIMEOUT_MS,
          "step1Text",
        ).catch((e: unknown) => `ERRO: ${e}`);
        const step1Elements = await describeInteractiveElements(reportFrame);
        wizardSteps.push({
          name: "1-filtros",
          url: reportFrame.url(),
          textPreview: (step1Text as string).slice(0, 2000),
          elements: step1Elements,
        });

        // "Filtrar por *" (id mui-component-select-FilterDate) é obrigatório e define
        // qual campo de data será usado para filtrar (ex.: Data de Ativação).
        step("Selecionando campo de data em 'Filtrar por'...");
        const filterDateSelection = await selectMuiOption(
          reportFrame,
          "mui-component-select-FilterDate",
          /ativa/i,
        );
        step(
          `Filtrar por -> aberto: ${filterDateSelection.opened}, opções: ${JSON.stringify(filterDateSelection.options)}, selecionado: ${filterDateSelection.selected}`,
        );
        await page.waitForTimeout(1000);

        const step1AfterFilterDateElements =
          await describeInteractiveElements(reportFrame);
        wizardSteps.push({
          name: "1-filtros-apos-filterdate",
          url: reportFrame.url(),
          filterDateSelection,
          elements: step1AfterFilterDateElements,
        });

        step(
          "Tentando preencher campos de data (hoje) que tenham aparecido...",
        );
        const rangeAlvo = rangeDoPeriodo(periodoAlvo);
        const dateFillResults = await fillDateLikeInputs(reportFrame, rangeAlvo);
        dateFill = dateFillResults;
        step(`Preenchimento de datas: ${JSON.stringify(dateFillResults)}`);

        // Extração de mês passado com QUALQUER campo de data sem preencher é
        // abortada aqui, antes de gerar o relatório: sem o filtro aplicado, o
        // wizard devolve outro mês, e foi exatamente assim que julho perdeu as
        // 894 linhas em 08/08/2026. A guarda de conteúdo (mais abaixo) pegaria
        // de novo, mas falhar já com o diagnóstico do campo é meia hora de
        // rodada a menos para descobrir o motivo.
        if (
          !rangeAlvo.usarInteracao &&
          (dateFillResults.length === 0 || dateFillResults.some((r) => !r.ok))
        ) {
          throw new Error(
            `Filtro de data do período ${periodoAlvo} não foi aplicado — ` +
              `abortando antes de gerar o relatório. Campos: ${JSON.stringify(dateFillResults)}`,
          );
        }

        const step1AfterDateFillElements =
          await describeInteractiveElements(reportFrame);
        wizardSteps.push({
          name: "1-filtros-apos-preencher-datas",
          url: reportFrame.url(),
          dateFillResults,
          elements: step1AfterDateFillElements,
        });

        step("Tentando avançar da etapa Filtros...");
        const advanced1 = await clickByText(reportFrame, "AVANÇAR");
        step(`Clique em AVANÇAR (etapa 1): ${advanced1}`);
        await page.waitForTimeout(4000);

        // Playwright pode ter trocado a referência do frame após navegação interna do SPA.
        reportFrame = acharFrameDoLegado(page) ?? reportFrame;

        // Etapa 2: pode ser "Parâmetros" (se o relatório tiver parâmetros extras) ou
        // pular direto para "Geração" (quando não há parâmetros configuráveis).
        let stageText = await withTimeout(
          reportFrame.evaluate(() => document.body?.innerText ?? ""),
          EVAL_TIMEOUT_MS,
          "stageText-1",
        ).catch((e: unknown) => `ERRO: ${e}`);
        let stageElements = await describeInteractiveElements(reportFrame);
        wizardSteps.push({
          name: "2-apos-avancar-filtros",
          url: reportFrame.url(),
          textPreview: (stageText as string).slice(0, 2000),
          elements: stageElements,
        });

        if (reParametros.test(stageText as string)) {
          step("Etapa Parâmetros detectada, tentando avançar...");
          const advancedParams =
            (await clickByText(reportFrame, "AVANÇAR")) ||
            (await clickByText(reportFrame, "EXECUTAR")) ||
            (await clickByText(reportFrame, "GERAR"));
          step(
            `Clique em AVANÇAR/EXECUTAR/GERAR (Parâmetros): ${advancedParams}`,
          );
          await page.waitForTimeout(3000);

          reportFrame = acharFrameDoLegado(page) ?? reportFrame;
          stageText = await withTimeout(
            reportFrame.evaluate(() => document.body?.innerText ?? ""),
            EVAL_TIMEOUT_MS,
            "stageText-2",
          ).catch((e: unknown) => `ERRO: ${e}`);
          stageElements = await describeInteractiveElements(reportFrame);
          wizardSteps.push({
            name: "3-apos-avancar-parametros",
            url: reportFrame.url(),
            textPreview: (stageText as string).slice(0, 2000),
            elements: stageElements,
          });
        }

        // Etapa "Geração": escolher o modo de exportação (botões só com ícone, sem
        // texto). CONFIRMADO (scripts/test-elleven-scraping.ts): este relatório só
        // tem 3 botões — 0=PDF, 1=CSV, 2=FECHAR (fecha o wizard, não exporta nada).
        // Não há visualização em tela. Por isso baixamos o CSV (índice 1) via
        // page.waitForEvent('download') em vez de procurar uma tabela na página.
        if (
          reGeracao.test(stageText as string) ||
          /Escolha o modo de exporta/i.test(stageText as string)
        ) {
          step(
            "Etapa Geração detectada — capturando screenshots dos botões de modo antes de clicar...",
          );
          const buttonLocators = reportFrame.locator(
            "button.MuiButton-outlined",
          );
          const count = await buttonLocators.count().catch(() => 0);
          const buttonScreenshots: string[] = [];
          for (let i = 0; i < count; i++) {
            try {
              // Locator.screenshot() não tem timeout padrão (fica esperando o elemento
              // "estabilizar" indefinidamente) — isso já travou a função até o
              // maxDuration do servidor sem retornar erro. Timeout explícito evita isso.
              const buf = await buttonLocators
                .nth(i)
                .screenshot({ timeout: 5000 });
              buttonScreenshots.push(buf.toString("base64"));
            } catch {
              buttonScreenshots.push("");
            }
          }
          step(`Total de botões de modo capturados: ${count}`);
          stageElements = await describeInteractiveElements(reportFrame);
          wizardSteps.push({
            name: "3-modo-botoes-screenshots",
            url: reportFrame.url(),
            count,
            buttonScreenshots,
            elements: stageElements,
          });

          // O "CSV" do botão é um ícone/SVG, não texto do DOM — hasText não
          // acha. Mas o layout é consistente: os botões de modo são sempre
          // [..., CSV, FECHAR], ou seja, o CSV é o PENÚLTIMO (3 botões
          // PDF/CSV/FECHAR -> índice 1; 2 botões CSV/FECHAR -> índice 0). Logo
          // o índice do CSV é sempre count-2.
          const csvIndex = count - 2;
          const hasCsv = count >= 2;
          const csvButton = buttonLocators.nth(Math.max(0, csvIndex));

          if (hasCsv) {
            step(`Botão CSV = índice ${csvIndex} de ${count} — clicando e aguardando download...`);
            modeResult = await downloadAndParseCsv(page, csvButton);
            step(
              `Resultado do download do CSV: ok=${modeResult.ok}, colunas=${modeResult.csvHeaders.length}, linhas=${modeResult.rowCount}` +
                (modeResult.error ? `, error=${modeResult.error}` : ""),
            );
            wizardSteps.push({
              name: "3-csv-resultado",
              url: reportFrame.url(),
              count,
              ...modeResult,
            });

            // Relatórios sem tabela modelada própria: guardamos cada linha do
            // CSV como JSONB em elleven_relatorio_linha. Snapshot mensal: apaga
            // o período e recria, mais rápido e simples que upsert linha a linha.
            //
            // A chave era só a 1ª coluna do CSV — no Funil de Vendas, o nome da
            // negociação ("39718 - Negociação com FULANO"). Uma negociação com
            // mais de um produto (internet + GPS no mesmo carrinho) gera VÁRIAS
            // linhas com esse mesmo nome; elas colidiam no índice único e o
            // `skipDuplicates` descartava todas menos a primeira, sem erro e sem
            // aviso. Enquanto o relatório só ficava armazenado isso era inócuo;
            // desde que ele virou a fonte oficial da bonificação (30/07/2026),
            // cada linha descartada é uma venda real que não é paga a ninguém.
            // Levantamento de 08/08/2026: 4 vendas (R$ 319,60) perdidas só entre
            // 01 e 08/08.
            //
            // Agora a chave carrega também o produto e a posição da linha no
            // CSV. A posição sozinha já garantiria unicidade (o período é
            // apagado e regravado inteiro a cada sync); produto e negociação
            // ficam junto porque a chave é lida por gente ao investigar.
            if (modeResult.ok && report.generico) {
              const periodo = periodoAlvo;
              const linhas = modeResult.rows.map((row, i) => {
                const primeira = String(Object.values(row)[0] ?? "").trim();
                const produto = String(row["Servico Carrinho"] ?? "").trim();
                return {
                  relatorio: slug,
                  periodo,
                  chave: [primeira || `linha-${i}`, produto, `#${i}`]
                    .filter(Boolean)
                    .join(" | "),
                  dados: row,
                };
              });
              try {
                await ensureRelatorioTable();

                // O CONTEÚDO precisa ser do período pedido. Em 08/08/2026 a
                // extração de julho voltou com 17 linhas DE JUNHO (o filtro de
                // data não pegou), passou pela trava de "não vazio" e o snapshot
                // substituiu as 894 linhas reais de julho — que só puderam ser
                // recuperadas reextraindo do Elleven. Contar linha não basta;
                // aqui a data das linhas é conferida contra o período, e um
                // descompasso aborta ANTES do apaga-e-regrava.
                {
                  const mesDe = (row: Record<string, string>): string | null => {
                    for (const valor of Object.values(row)) {
                      const m = String(valor ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
                      if (m) return `${m[3]}-${m[2]}`;
                    }
                    return null;
                  };
                  const meses = modeResult.rows
                    .map(mesDe)
                    .filter((m): m is string => m != null);
                  const noPeriodo = meses.filter((m) => m === periodo).length;
                  if (meses.length >= 5 && noPeriodo / meses.length < 0.6) {
                    throw new Error(
                      `O CSV não é do período pedido: ${noPeriodo} de ${meses.length} ` +
                        `linha(s) datada(s) pertencem a ${periodo} — o filtro de data do ` +
                        `wizard não foi aplicado. Nada foi gravado; o que está no banco ` +
                        `permanece. Datas encontradas: ${[...new Set(meses)].sort().join(", ")}.`,
                    );
                  }
                }

                // Snapshot vazio NÃO substitui snapshot cheio. O fluxo aqui é
                // "apaga o período e regrava"; se o CSV vier sem linha nenhuma
                // por um tropeço na coleta (tela mudou, sessão caiu, wizard
                // parou no meio), o apaga aconteceria e o regrava não — levando
                // junto os lançamentos do mês, já que o funil regera
                // LancamentoVenda a partir daqui. Um mês legitimamente sem
                // venda não se distingue de uma coleta que falhou, e entre as
                // duas leituras a segura é manter o que já está no banco.
                if (linhas.length === 0) {
                  throw new Error(
                    `CSV de ${slug}/${periodo} voltou sem nenhuma linha — ` +
                      `mantendo o que já está gravado e abortando, para não ` +
                      `apagar o período por causa de uma coleta falha.`,
                  );
                }

                await prisma.elevenRelatorioLinha.deleteMany({
                  where: { relatorio: slug, periodo },
                });
                const res = await prisma.elevenRelatorioLinha.createMany({
                  data: linhas,
                  skipDuplicates: true,
                });
                savedCount = res.count;
                step(
                  `Genérico (${slug}): ${savedCount} linha(s) salvas em elleven_relatorio_linha (período ${periodo}).`,
                );

                // Cinto de segurança para o bug de chave colidida não voltar
                // calado: se sobrou linha do CSV pelo caminho, isso agora
                // aparece no passo e derruba a rodada em vez de virar venda
                // que ninguém recebe.
                if (savedCount !== linhas.length) {
                  throw new Error(
                    `Perda silenciosa de linhas em ${slug}/${periodo}: o CSV trouxe ` +
                      `${linhas.length} linha(s) e só ${savedCount} foram gravadas ` +
                      `(${linhas.length - savedCount} descartada(s) por colisão de chave). ` +
                      `Abortando para não gerar bonificação com venda faltando.`,
                  );
                }

                // Único relatório que alimenta a bonificação (ver OS de
                // 30/07/2026) — gera/atualiza LancamentoVenda do período logo
                // após salvar as linhas cruas.
                if (slug === "funil-de-vendas") {
                  try {
                    step(`Importando lançamentos do Funil de Vendas para ${periodo}...`);
                    importacaoAuto = await importarLancamentosEllevenFunil(periodo);
                    step(
                      `Importação automática: ${importacaoAuto.lancamentosGerados} lançamento(s) ` +
                        `(${importacaoAuto.matchExato} exato, ${importacaoAuto.matchFuzzy} fuzzy, ` +
                        `${importacaoAuto.funcionariosCriados} vendedor(es) criado(s)) ` +
                        `de ${importacaoAuto.negociacoesFiltradas} negociação(ões) Ganha(s).`,
                    );
                  } catch (e) {
                    step(`Erro na importação automática do Funil de Vendas: ${e}`);
                  }
                }
              } catch (e) {
                errorCount++;
                erroSalvando = e instanceof Error ? e.message : String(e);
                step(`Erro salvando genérico (${slug}): ${e}`);
              }
            }
          } else {
            step(
              `Menos de 2 botões de export encontrados (${count}) — sem botão CSV para clicar.`,
            );
          }
        }
      }

      // Coleta que achou o frame mas não trouxe CSV: guarda o que a tela
      // realmente oferece. É o caso do Exportador de Dados, cujo frame é o do
      // legado mas cujo conteúdo não é o wizard de Filtros/Geração — o log só
      // dizia "Filtrar por: opções []", que não diz o que ESTÁ lá. Sem isto, a
      // única saída é tentar de novo às cegas.
      const textoDe = (f: Frame, label: string) =>
        withTimeout(
          f.evaluate(() =>
            (document.body?.innerText ?? "").replace(/\s+/g, " ").slice(0, 1200),
          ),
          EVAL_TIMEOUT_MS,
          label,
        ).catch(() => null);

      let telaDoFrame: unknown = null;
      if (!modeResult || (modeResult.rowCount ?? 0) === 0) {
        // A primeira captura olhou só o iframe do legado e voltou vazia — nem
        // texto, nem um elemento interativo. Ou seja: as telas do Exportador de
        // Dados e de analytics NÃO montam a interface lá dentro; a casca
        // /restricted/gv é só um invólucro. O que sobra é a própria página
        // React, que é onde a interface deve estar. Capturamos as duas para não
        // gastar mais uma rodada descobrindo de qual lado olhar.
        telaDoFrame = {
          frame: reportFrame
            ? {
                url: reportFrame.url(),
                elementos: await describeInteractiveElements(reportFrame),
                texto: await textoDe(reportFrame, "texto-do-frame"),
              }
            : null,
          pagina: {
            url: page.url(),
            elementos: await describeInteractiveElements(page.mainFrame()),
            texto: await textoDe(page.mainFrame(), "texto-da-pagina"),
          },
          frames: allFrameUrls,
        };
      }

      const screenshot = await page.screenshot({
        fullPage: true,
        timeout: 15000,
      });
      step(`Screenshot capturado (${screenshot.length} bytes).`);

      await recordCronRun({
        job: `sync-elleven:${slug}`,
        // Uma rodada só é verde se REALMENTE trouxe o relatório. Antes,
        // `modeResult?.ok ?? true` dava ok quando a exportação sequer chegava a
        // ser tentada — foi assim que o primeiro sync de "Cancelamentos por
        // Mês" (sem iframe) e o do Funil às 11:30 (frame errado, zero linha)
        // apareceram verdes no monitor com o banco vazio do outro lado.
        ok:
          modeResult?.ok === true &&
          erroSalvando == null &&
          !!reportFrame &&
          (modeResult.rowCount ?? 0) > 0,
        durationMs: Date.now() - started,
        erro:
          modeResult?.ok === false
            ? modeResult.error
            : (erroSalvando ??
              (!reportFrame
                ? `A tela do relatório não montou o iframe do sistema legado — ` +
                  `nada foi extraído. URL final: ${page.url()}. ` +
                  `Frames encontrados: ${allFrameUrls.join(" , ") || "nenhum"}.`
                : !modeResult
                  ? `O wizard abriu, mas a exportação do CSV não chegou a rodar. ` +
                    `Últimos passos: ${log.slice(-6).join(" › ")}`
                  : (modeResult.rowCount ?? 0) === 0
                    ? `O CSV voltou sem nenhuma linha — nada foi gravado e o que ` +
                      `já estava no banco foi mantido.`
                    : null)),
        detalhes: {
          reportNome: report.nome,
          periodoAlvo,
          rowCount: modeResult?.rowCount ?? 0,
          savedCount,
          errorCount,
          reportFrameFound: !!reportFrame,
          importacaoAuto,
          dateFill,
          // Sem iframe de relatório não há o que extrair, e o diagnóstico só
          // existia na resposta HTTP — que o cron descarta. Guardando aqui, dá
          // para descobrir o que a tela realmente tem sem precisar de mais uma
          // rodada. É o caso do "Cancelamentos por Mês", que fica em
          // legacy/utilities e não no wizard de relatórios.
          ...(reportFrame
            ? {}
            : {
                urlFinal: page.url(),
                framesEncontrados: allFrameUrls,
                passos: log.slice(-25),
              }),
          ...(telaDoFrame ? { telaDoFrame, passos: log.slice(-25) } : {}),
        },
      });

      return NextResponse.json({
        ok: modeResult?.ok ?? true,
        report: slug,
        reportNome: report.nome,
        modeError: modeResult?.ok === false ? modeResult.error : undefined,
        csvHeaders: modeResult?.csvHeaders ?? [],
        rowCount: modeResult?.rowCount ?? 0,
        sampleRows: modeResult?.sampleRows ?? [],
        savedCount,
        errorCount,
        importacaoAuto,
        log,
        currentUrl: page.url(),
        allFrameUrls,
        reportFrameFound: !!reportFrame,
        wizardSteps,
        screenshotBase64: screenshot.toString("base64"),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      step(`ERRO: ${message}`);
      await recordCronRun({
        job: `sync-elleven:${slug}`,
        ok: false,
        durationMs: Date.now() - started,
        erro: message,
      });
      return NextResponse.json(
        { ok: false, error: message, log, wizardSteps },
        { status: 500 },
      );
    } finally {
      await browser?.close().catch(() => {});
    }
  };

  return Promise.race([runWizard(), watchdog]);
}
