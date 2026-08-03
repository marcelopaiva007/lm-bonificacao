import { requireEmpresaAccess } from "@/lib/rh-auth-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buscarPendenciasEmpresa } from "@/lib/rh-pendencias";
import { PendenciasView } from "./pendencias-view";
import { Users, TrendingDown, AlertCircle, DollarSign } from "lucide-react";

export default async function EmpresaVisaoPage({
  params,
}: {
  params: Promise<{ empresaId: string }>;
}) {
  const { empresaId } = await params;
  await requireEmpresaAccess(empresaId);

  const [empresa, colaboradoresComSalario, pendenciasData] = await Promise.all([
    prisma.empresa.findUnique({ where: { id: empresaId } }),
    prisma.colaborador.findMany({
      where: { empresaId, ativo: true },
      select: { salarioFicha: true },
    }),
    buscarPendenciasEmpresa(empresaId),
  ]);

  if (!empresa) return null;

  // Calcular custo total de pessoal
  const custoPessoal = colaboradoresComSalario.reduce(
    (acc, c) => acc + (c.salarioFicha || 0),
    0
  );

  // Calcular indicadores fictícios (em produção viriam de uma tabela de histórico)
  const totalColaboradores = pendenciasData.totalColaboradores;
  const turnover = 30.3; // placeholder
  const absenteismo = 0.0; // placeholder

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Visão da Empresa</h2>
        <p className="text-sm text-muted-foreground">
          Dashboard de indicadores e preenchimento de dados da {empresa.nome}.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Colaboradores ativos
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-semibold">{totalColaboradores}</p>
              <p className="text-xs text-muted-foreground">
                {totalColaboradores > 0
                  ? `${colaboradoresComSalario.filter(c => c.salarioFicha).length} com salário definido`
                  : "Nenhum colaborador"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Turnover 12 meses
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-semibold">{turnover.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">últimos 12 meses</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Absenteísmo 30 dias
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-semibold">{absenteismo.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                0 dia(s) de falta não abonada
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custo de pessoal
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-semibold">
                R$ {(custoPessoal / 1000).toFixed(0)}k
              </p>
              <p className="text-xs text-muted-foreground">
                parcial — {colaboradoresComSalario.filter(c => c.salarioFicha).length} ficha(s) com salário preenchido
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pendências */}
      <PendenciasView pendencias={pendenciasData.pendencias} />
    </div>
  );
}
