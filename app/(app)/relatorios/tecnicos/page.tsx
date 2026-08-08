import Link from "next/link";
import { requireCapacidade } from "@/lib/auth-guard";
import { semanaDosTecnicos, segundaDePagamento } from "@/lib/pagamento-semanal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

// Pagamento semanal dos técnicos — decisão da diretoria de 08/08/2026:
// R$ 20 por internet + 50% dos demais, pagos toda segunda-feira. O fechamento
// do sistema segue mensal; esta tela é o recorte que a segunda-feira paga.

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDataIso(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export default async function TecnicosSemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  // Mesma régua da tela de Pagamentos: valor a pagar de terceiros é assunto de
  // quem paga (admin/gerente) e de quem confere (diretoria).
  await requireCapacidade("VER_REGISTRO_ALTERACOES");
  const params = await searchParams;
  const semanaParam = /^\d{4}-\d{2}-\d{2}$/.test(params.semana ?? "")
    ? params.semana
    : undefined;

  const semana = await semanaDosTecnicos(semanaParam);
  const segundaAtual = segundaDePagamento().toISOString().slice(0, 10);
  const anterior = somarDias(semana.pagamentoIso, -7);
  const proxima = somarDias(semana.pagamentoIso, 7);
  const ehSemanaCorrente = semana.pagamentoIso >= segundaAtual;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Técnicos — pagamento semanal</h1>
          <p className="text-sm text-muted-foreground">
            Semana de {fmtDataIso(semana.inicioIso)} a {fmtDataIso(semana.fimIso)} · paga na
            segunda-feira {fmtDataIso(semana.pagamentoIso)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`?semana=${anterior}`} />}
          >
            <ChevronLeft className="size-4" />
            Semana anterior
          </Button>
          {!ehSemanaCorrente && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`?semana=${proxima}`} />}
            >
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {!semana.temRegra && (
        <Alert>
          <AlertDescription>
            Não há regra vigente para o cargo Técnico neste período — os valores abaixo saem
            zerados. Cadastre a regra em Regras de Bonificação.
          </AlertDescription>
        </Alert>
      )}

      {semana.linhasSemData > 0 && (
        <Alert>
          <AlertDescription>
            {semana.linhasSemData} venda(s) de técnico sem data de ativação no Elleven ficaram fora
            desta semana. Elas continuam contando normalmente no fechamento mensal.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {semana.linhas.length === 0
              ? "Nenhuma venda de técnico nesta semana"
              : `${semana.linhas.length} técnico(s) com venda na semana`}
          </CardTitle>
          <CardDescription>
            Regra: valor fixo por internet vendida + percentual dos demais serviços, conforme a
            vigência em Regras de Bonificação. A conta é linear por venda, então a soma das semanas
            bate com o fechamento mensal. A data de cada venda é a ativação no Elleven.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Técnico</TableHead>
                <TableHead className="text-right">Internet</TableHead>
                <TableHead className="text-right">Demais (qtd)</TableHead>
                <TableHead className="text-right">Demais (valor vendido)</TableHead>
                <TableHead className="text-right">Bônus internet</TableHead>
                <TableHead className="text-right">Bônus demais</TableHead>
                <TableHead className="text-right">A pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semana.linhas.map((l) => (
                <TableRow key={l.funcionarioId}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.qtdInternet}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.qtdDemais}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoeda(l.valorDemaisServicos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoeda(l.valorInternet)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoeda(l.valorDemais)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtMoeda(l.total)}
                  </TableCell>
                </TableRow>
              ))}
              {semana.linhas.length > 0 && (
                <TableRow>
                  <TableCell className="font-semibold">Total da semana</TableCell>
                  <TableCell colSpan={5} />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {fmtMoeda(semana.totalGeral)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
