"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, CalendarRange } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EmpresaOpcao = { id: string; nome: string };

export function ContabilFiltros({
  empresas,
  empresaId,
  anos,
  ano,
}: {
  empresas: EmpresaOpcao[];
  empresaId: string;
  anos: number[];
  ano: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function trocar(chave: "empresa" | "ano", valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(chave, valor);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-muted-foreground" />
        <Select
          value={empresaId}
          onValueChange={(v) => v && trocar("empresa", String(v))}
          items={Object.fromEntries(empresas.map((e) => [e.id, e.nome]))}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            {empresas.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 text-muted-foreground" />
        <Select
          value={String(ano)}
          onValueChange={(v) => v && trocar("ano", String(v))}
          items={Object.fromEntries(anos.map((a) => [String(a), String(a)]))}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {anos.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
