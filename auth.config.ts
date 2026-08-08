import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      const isOnReset = request.nextUrl.pathname.startsWith("/recuperar-senha") ||
                        request.nextUrl.pathname.startsWith("/redefinir-senha");
      if (isOnLogin || isOnReset) {
        return isLoggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      if (!isLoggedIn) return false;

      const mustChange = (auth.user as { mustChangePassword?: boolean })?.mustChangePassword;
      const isOnTrocarSenha = request.nextUrl.pathname.startsWith("/trocar-senha");
      if (mustChange && !isOnTrocarSenha) {
        return Response.redirect(new URL("/trocar-senha", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          role: string;
          username: string;
          email?: string | null;
          mustChangePassword?: boolean;
          empresaId: string | null;
          setorId: string | null;
          scopes?: Array<{
            empresaId: string;
            nomeEmpresa: string;
            cnpj: string | null;
            marca: string | null;
            nivelAcesso: string;
          }>;
        };
        token.id = u.id;
        token.role = u.role;
        token.username = u.username;
        token.email = u.email;
        token.mustChangePassword = u.mustChangePassword;
        token.empresaId = u.empresaId;
        token.setorId = u.setorId;
        token.scopes = u.scopes || [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.email = (token.email as string) || "";
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.empresaId = token.empresaId as string | null;
        session.user.setorId = token.setorId as string | null;
        session.user.scopes = (token.scopes as any) || [];
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
