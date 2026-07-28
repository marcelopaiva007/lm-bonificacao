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
      if (isOnLogin) {
        return isLoggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          role: string;
          username: string;
          empresasIds: string[];
          setorId: string | null;
        };
        token.id = u.id;
        token.role = u.role;
        token.username = u.username;
        token.empresasIds = u.empresasIds;
        token.setorId = u.setorId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
        session.user.empresasIds = (token.empresasIds as string[]) ?? [];
        session.user.setorId = token.setorId as string | null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
