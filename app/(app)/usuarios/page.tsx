import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ensureAuthAndUserSchema } from "@/lib/ensure-schema";
import { UsuariosTable } from "./usuarios-table";
import { UserCheck } from "lucide-react";

export default async function UsuariosPage() {
  await requireAdmin();
  await ensureAuthAndUserSchema();

  const [usuarios, empresas, setores] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { nome: "asc" }],
      include: {
        empresa: true,
        setor: true,
        scopes: {
          include: {
            empresa: true,
          },
        },
      },
    }),
    prisma.empresa.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.setor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
            Gestão de Usuários
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Gerenciamento de contas de acesso ao sistema e atribuição de perfis de usuário.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1.5 backdrop-blur-md">
            <UserCheck className="size-4 text-emerald-400" />
            <div className="text-xs font-medium text-slate-300">
              <span className="font-bold text-slate-100">{usuarios.length}</span> Usuários Cadastrados
            </div>
          </div>
        </div>
      </div>

      <UsuariosTable usuarios={usuarios as any} empresas={empresas} setores={setores} />
    </div>
  );
}
