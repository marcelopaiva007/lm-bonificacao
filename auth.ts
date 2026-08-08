import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuário ou E-mail", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const loginInput = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!loginInput || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: loginInput },
              { email: loginInput },
            ],
          },
          include: {
            scopes: {
              include: {
                empresa: true,
              },
            },
          },
        });

        if (!user) return null;

        // Bloqueia usuários inativos
        if (user.ativo === false) {
          throw new Error("Sua conta está inativa. Fale com o administrador.");
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Registra data do último login
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch {
          // Ignora erro de timestamp
        }

        const userScopes = (user as any).scopes || [];
        const formattedScopes = userScopes.map((s: any) => ({
          empresaId: s.empresaId,
          nomeEmpresa: s.empresa?.nome ?? "",
          cnpj: s.empresa?.cnpj ?? null,
          marca: s.empresa?.marca ?? null,
          nivelAcesso: s.nivelAcesso,
        }));

        return {
          id: user.id,
          name: user.nome,
          username: user.username,
          email: user.email,
          role: user.role,
          mustChangePassword: !!user.mustChangePassword,
          empresaId: user.empresaId,
          setorId: user.setorId,
          scopes: formattedScopes,
        };
      },
    }),
  ],
});
