import "server-only";

// Enviadores de cobrança. Ficam inertes (retornam erro amigável) enquanto as
// credenciais não estiverem configuradas — nada quebra por falta delas.
//   TELEGRAM_BOT_TOKEN  — token do bot (@BotFather)
//   RESEND_API_KEY      — chave do provedor de e-mail (Resend)
//   COBRANCA_EMAIL_FROM — remetente (ex.: "LM Telecom <metas@seudominio.com>")

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
  const from =
    process.env.COBRANCA_EMAIL_FROM || "LM Bonificação <onboarding@resend.dev>";
  if (!key) {
    return {
      canal: "email",
      destino: to,
      ok: false,
      erro: "RESEND_API_KEY não configurado",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject: assunto, text: texto }),
    });
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
    return { canal: "email", destino: to, ok: false, erro: String(e) };
  }
}
