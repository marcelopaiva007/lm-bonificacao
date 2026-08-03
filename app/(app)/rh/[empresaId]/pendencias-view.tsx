"use client";

import { useState } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Pendencia } from "@/lib/rh-pendencias";

const pendenciaLabels: Record<string, { label: string; cor: string }> = {
  sem_telegram: { label: "Telegram", cor: "bg-blue-50" },
  sem_salario: { label: "Salário", cor: "bg-yellow-50" },
  sem_data_admissao: { label: "Data Admissão", cor: "bg-purple-50" },
  sem_setor: { label: "Setor", cor: "bg-red-50" },
};

export function PendenciasView({ pendencias }: { pendencias: Pendencia[] }) {
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const toggleExpand = (tipo: string) => {
    setExpandidos((prev) => ({
      ...prev,
      [tipo]: !prev[tipo],
    }));
  };

  if (pendencias.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preenchimento da base</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-success/10 border-success/30">
            <AlertCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Nenhuma pendência! Todos os colaboradores estão com dados preenchidos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preenchimento da base</CardTitle>
        <p className="text-sm text-muted-foreground">
          {pendencias.length} tipo(s) de pendência precisam de atenção.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendencias.map((pendencia) => {
          const config = pendenciaLabels[pendencia.tipo] || { label: pendencia.tipo, cor: "bg-gray-50" };
          const isExpandido = expandidos[pendencia.tipo];

          return (
            <div
              key={pendencia.tipo}
              className={`border rounded-lg overflow-hidden ${config.cor}`}
            >
              <button
                onClick={() => toggleExpand(pendencia.tipo)}
                className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{pendencia.total} {pendencia.descricao}</p>
                    <p className="text-xs text-muted-foreground">{pendencia.percentual}% dos colaboradores</p>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${
                    isExpandido ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isExpandido && (
                <div className="border-t px-4 py-3 bg-white/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b">
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">CPF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendencia.colaboradores.map((colab) => (
                        <TableRow key={colab.id} className="border-b last:border-b-0">
                          <TableCell className="text-sm py-2">{colab.nome}</TableCell>
                          <TableCell className="text-sm py-2 font-mono text-muted-foreground">
                            {colab.cpf || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
