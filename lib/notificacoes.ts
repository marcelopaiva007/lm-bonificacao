import "server-only";

// Enviadores de cobrança. Ficam inertes (retornam erro amigável) enquanto as
// credenciais não estiverem configuradas — nada quebra por falta delas.
//   TELEGRAM_BOT_TOKEN  — token do bot (@BotFather)
//   RESEND_API_KEY      — chave do provedor de e-mail (Resend)
//   COBRANCA_EMAIL_FROM — remetente; opcional, o default já usa o domínio
//                         envios.assinelm.com.br (verificado no Resend)

export type EnvioResultado = {
  canal: "telegram" | "email";
  destino: string;
  ok: boolean;
  erro?: string;
};

export function telegramConfigurado(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export function emailConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// --- Rate limit do Resend ---------------------------------------------------
// O Resend aceita no máximo 2 requisições por segundo (e 100 e-mails/dia no free
// tier, 50k/mês no Pro). 500ms entre envios mantém a cadência exatamente no teto
// de 2 req/s. Quem faz o loop de envio (o cron) é responsável por respeitar este
// intervalo; aqui só publicamos o número para não haver duas versões dele.
export const RESEND_INTERVALO_MS = 500;

// Se ainda assim tomarmos 429, tentamos de novo com espera exponencial
// (1s, 2s) — 3 tentativas no total, no pior caso ~3s por e-mail.
const EMAIL_MAX_TENTATIVAS = 3;
const EMAIL_BACKOFF_BASE_MS = 1000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type TelegramContato = {
  chatId: string;
  nome: string;
  username: string | null;
};

// Lê os últimos updates do bot (getUpdates) e devolve os chats privados
// distintos de quem já mandou mensagem — a forma de descobrir o chat_id de
// cada pessoa para vincular no cadastro. O Telegram guarda os updates por ~24h.
export async function buscarUpdatesTelegram(): Promise<
  { ok: true; contatos: TelegramContato[] } | { ok: false; erro: string }
> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, erro: "TELEGRAM_BOT_TOKEN não configurado" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, erro: `HTTP ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      ok: boolean;
      result?: Array<{
        message?: {
          chat?: {
            id?: number;
            type?: string;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
      }>;
    };
    const porChat = new Map<string, TelegramContato>();
    for (const up of data.result ?? []) {
      const chat = up.message?.chat;
      if (!chat?.id || chat.type !== "private") continue;
      const nome = [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim();
      porChat.set(String(chat.id), {
        chatId: String(chat.id),
        nome: nome || chat.username || String(chat.id),
        username: chat.username ?? null,
      });
    }
    return { ok: true, contatos: [...porChat.values()] };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

export async function enviarTelegram(
  chatId: string,
  texto: string,
): Promise<EnvioResultado> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      canal: "telegram",
      destino: chatId,
      ok: false,
      erro: "TELEGRAM_BOT_TOKEN não configurado",
    };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
    });
    if (!res.ok) {
      const t = await res.text();
      return {
        canal: "telegram",
        destino: chatId,
        ok: false,
        erro: `HTTP ${res.status}: ${t.slice(0, 200)}`,
      };
    }
    return { canal: "telegram", destino: chatId, ok: true };
  } catch (e) {
    return { canal: "telegram", destino: chatId, ok: false, erro: String(e) };
  }
}

export async function enviarEmail(
  to: string,
  assunto: string,
  texto: string,
): Promise<EnvioResultado> {
  const key = process.env.RESEND_API_KEY;
  // onboarding@resend.dev (remetente compartilhado do Resend) só entrega no
  // e-mail dono da conta — por isso o default é o domínio próprio verificado.
  const from =
    process.env.COBRANCA_EMAIL_FROM ||
    "LM Bonificação <metas@envios.assinelm.com.br>";
  if (!key) {
    return {
      canal: "email",
      destino: to,
      ok: false,
      erro: "RESEND_API_KEY não configurado",
    };
  }
  // 429 (Too Many Requests) é o único status que vale reenviar: significa só que
  // passamos da cadência, não que o e-mail está errado. Qualquer outro erro HTTP
  // (400, 403, 422…) volta na hora — insistir não muda o resultado.
  let ultimoErro = "erro desconhecido";
  for (let tentativa = 1; tentativa <= EMAIL_MAX_TENTATIVAS; tentativa++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from, to, subject: assunto, text: texto }),
      });
      if (res.status === 429) {
        const t = await res.text();
        ultimoErro = `HTTP 429: ${t.slice(0, 200)}`;
        if (tentativa === EMAIL_MAX_TENTATIVAS) break;
        // Quando o Resend manda Retry-After (em segundos), ele é a fonte da
        // verdade — com um teto de 10s para não estourar o maxDuration.
        // Sem o header, backoff exponencial a partir de 1s.
        const retryAfter = Number(res.headers.get("retry-after"));
        const espera =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 10_000)
            : EMAIL_BACKOFF_BASE_MS * 2 ** (tentativa - 1);
        await sleep(espera);
        continue;
      }
      if (!res.ok) {
        const t = await res.text();
        return {
          canal: "email",
          destino: to,
          ok: false,
          erro: `HTTP ${res.status}: ${t.slice(0, 200)}`,
        };
      }
      return { canal: "email", destino: to, ok: true };
    } catch (e) {
      // Falha de rede: também vale uma nova tentativa.
      ultimoErro = String(e);
      if (tentativa === EMAIL_MAX_TENTATIVAS) break;
      await sleep(EMAIL_BACKOFF_BASE_MS * 2 ** (tentativa - 1));
    }
  }
  return {
    canal: "email",
    destino: to,
    ok: false,
    erro: `${ultimoErro} (após ${EMAIL_MAX_TENTATIVAS} tentativas)`,
  };
}
