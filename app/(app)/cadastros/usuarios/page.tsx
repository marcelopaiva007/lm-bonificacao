import { requireAdmin } from "@/lib/auth-guard";
import { listarVinculos } from "@/lib/escopo";
import { prisma } from "@/lib/prisma";
import { UsuariosTable } from "./usuarios-table";

export default async function UsuariosPage() {
  const admin = await requireAdmin();

  const [usuarios, funcionarios, vinculos] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, username: true, role: true, createdAt: true },
    }),
    // Supervisor e vendedor precisam apontar para alguém do cadastro de vendas —
    // é assim que o sistema sabe qual equipe mostrar.
    prisma.funcionario.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, cargo: true },
    }),
    listarVinculos(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground">
          Quem acessa o sistema e o quanto cada um enxerga. Diretoria e gerente veem
          o quadro inteiro; supervisor vê a própria equipe; vendedor vê apenas o
          próprio desempenho.
        </p>
      </div>
      <UsuariosTable
        usuarios={usuarios.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          funcionarioId: vinculos.get(u.id) ?? null,
        }))}
        funcionarios={funcionarios}
        currentUserId={admin.id}
      />
    </div>
  );
}
