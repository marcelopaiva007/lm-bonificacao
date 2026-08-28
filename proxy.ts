import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Ignora as rotas de API, os assets internos do Next, o /login e QUALQUER
  // arquivo estático com extensão (png/svg/glb…). Sem excluir os estáticos, o
  // middleware de auth redirecionava as imagens do /public (ex.: o logo) para
  // /login quando o usuário não está logado — por isso o logo sumia na própria
  // tela de login.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb)).*)",
  ],
};
