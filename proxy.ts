import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

// Tudo que NÃO casar aqui passa pela checagem de sessão.
//
// A lista de extensões existe porque os arquivos de public/ (o logo da LM,
// ícones) não são servidos por _next/static: eles caem na regra geral, e sem
// sessão o proxy os redirecionava para /login em vez de devolver a imagem — 307
// com corpo de texto no lugar do PNG. O efeito aparecia justamente na TELA DE
// LOGIN, onde ninguém está autenticado ainda: o logo simplesmente não carregava.
//
// Arquivo estático não tem o que proteger com sessão; o que precisa de login são
// as páginas. favicon.ico sai da lista explícita porque já está coberto por .ico.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|login|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|glb|woff|woff2|txt|xml)$).*)",
  ],
};
