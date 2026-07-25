import { requireContabilEditor } from "@/lib/contabil-auth-guard";
import { prisma } from "@/lib/prisma";
import { CadastrosView } from "./cadastros-view";

export default async function CadastrosContabeisPage() {
  await requireContabilEditor();

  const [empresas, tipos] = await Promise.all([
    prisma.empresaContabil.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { competencias: true } } },
    }),
    prisma.tipoImposto.findMany({
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      include: { _count: { select: { impostos: true } } },
    }),
  ]);

  return (
    <CadastrosView
      empresas={empresas.map((e) => ({
        id: e.id,
        nome: e.nome,
        cnpj: e.cnpj,
        regime: e.regime,
        ativo: e.ativo,
        competencias: e._count.competencias,
      }))}
      tipos={tipos.map((t) => ({
        id: t.id,
        nome: t.nome,
        descricao: t.descricao,
        ordem: t.ordem,
        ativo: t.ativo,
        usos: t._count.impostos,
      }))}
    />
  );
}
