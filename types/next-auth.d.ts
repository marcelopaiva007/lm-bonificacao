import type { DefaultSession } from "next-auth";

export type UserScopeSession = {
  empresaId: string;
  nomeEmpresa: string;
  cnpj: string | null;
  marca: string | null;
  nivelAcesso: string;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      username: string;
      email?: string | null;
      mustChangePassword?: boolean;
      empresaId: string | null;
      setorId: string | null;
      scopes?: UserScopeSession[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    username: string;
    email?: string | null;
    mustChangePassword?: boolean;
    empresaId: string | null;
    setorId: string | null;
    scopes?: UserScopeSession[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    username: string;
    email?: string | null;
    mustChangePassword?: boolean;
    empresaId: string | null;
    setorId: string | null;
    scopes?: UserScopeSession[];
  }
}
