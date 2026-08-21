import pacote from "../package.json";
import { FUSO_BR } from "@/lib/periodo";

/**
 * Versão exibida na tela — no rodapé do menu lateral e na tela de entrada.
 *
 * Serve para uma pergunta prática do dia a dia: "o que estou vendo já é a
 * versão nova?". Por isso não basta o número do package.json — ele só muda
 * quando alguém lembra de mudar. O commit vem junto, e esse não mente: é
 * exatamente o código que a Vercel publicou.
 *
 * O número existe para a conversa ("estou na 0.4.0") porque ninguém decora
 * sha; o commit existe para a conferência técnica. Os dois juntos respondem
 * sem precisar abrir o GitHub.
 *
 * `VERCEL_GIT_COMMIT_SHA` só existe no servidor da Vercel. Em desenvolvimento
 * não existe, e aí a etiqueta diz "local" — que é a informação certa nesse caso.
 */
export function versaoDoSistema(): {
  numero: string;
  commit: string | null;
  /** Data em que este build subiu, no formato dd/mm/aaaa (fuso de Brasília). */
  data: string | null;
  /** "v1.0.0 · 06/08/2026" — o que se lê em voz alta. */
  rotulo: string;
  /** O sha, para conferência técnica. Fica em segundo plano na tela. */
  detalhe: string;
} {
  const numero = pacote.version;
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const commit = sha ? sha.slice(0, 7) : null;

  // DATA_DO_BUILD é congelada em next.config.ts durante a compilação.
  const bruta = process.env.DATA_DO_BUILD;
  const data = bruta
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: FUSO_BR,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(bruta))
    : null;

  return {
    numero,
    commit,
    data,
    rotulo: data ? `v${numero} · ${data}` : `v${numero}`,
    detalhe: commit ?? "local",
  };
}
