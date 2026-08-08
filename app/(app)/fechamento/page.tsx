import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { periodoLabel } from "@/lib/periodo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, ChevronRight, Lock, Unlock, DollarSign, Trophy } from "lucide-react";

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function FechamentoListPage() {
  await requireUser();

  const fechamentos = await prisma.fechamentoMensal.findMany({
    orderBy: { periodo: "desc" },
  });

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-4 shadow-lg backdrop-blur-xl">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Fechamento Mensal de Comissões
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Histórico e congelamento de apurações mensais da equipe comercial L&M Telecom.
        </p>
      </div>

      {/* Main Table Card */}
      <Card className="glass-card border border-slate-800/80 bg-slate-900/60 p-4 shadow-xl">
        <CardHeader className="px-0 pt-0 pb-3">
          <CardTitle className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="size-4 text-cyan-400" />
            Períodos de Fechamento Registrados
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Clique no mês desejado para visualizar a auditoria detalhada ou alterar o status do período.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 shadow-inner">
            <Table>
              <TableHeader className="bg-slate-900/90">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="font-bold text-slate-300">Período</TableHead>
                  <TableHead className="font-bold text-slate-300">Status</TableHead>
                  <TableHead className="text-right font-bold text-slate-300">Valor Total Vendido</TableHead>
                  <TableHead className="text-right font-bold text-slate-300">Bonificação Total</TableHead>
                  <TableHead className="w-16 text-center font-bold text-slate-300"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechamentos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-slate-400">
                      Nenhum mês lançado ainda.
                    </TableCell>
                  </TableRow>
                )}
                {fechamentos.map((f) => (
                  <TableRow key={f.id} className="border-slate-800/60 hover:bg-slate-900/50 transition-colors">
                    <TableCell className="font-bold text-slate-100">
                      <Link href={`/fechamento/${f.periodo}`} className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                        <Calendar className="size-4 text-cyan-400" />
                        {periodoLabel(f.periodo)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          f.status === "FECHADO"
                            ? "border-slate-700 bg-slate-900 text-slate-300 text-[11px] font-semibold"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold"
                        }
                      >
                        {f.status === "FECHADO" ? (
                          <>
                            <Lock className="size-3 mr-1 text-slate-400" /> Fechado
                          </>
                        ) : (
                          <>
                            <Unlock className="size-3 mr-1 text-emerald-400" /> Aberto
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-cyan-400">
                      {fmtMoeda(f.valorTotalVendido)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-amber-400">
                      {fmtMoeda(f.valorTotalBonificacao)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/fechamento/${f.periodo}`} className="inline-flex size-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400 transition-all">
                        <ChevronRight className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
