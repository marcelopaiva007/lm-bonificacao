"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function EmpresaMarcaSwitcher() {
  const { data: session } = useSession();
  const scopes = session?.user?.scopes || [];

  const [activeEmpresaId, setActiveEmpresaId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("active_empresa_id");
    if (stored && scopes.some((s) => s.empresaId === stored)) {
      setActiveEmpresaId(stored);
    } else if (scopes.length > 0) {
      setActiveEmpresaId(scopes[0].empresaId);
    }
  }, [scopes]);

  if (session?.user?.role === "ADMIN") {
    return (
      <div className="px-3 py-1.5 bg-cyan-950/30 border border-cyan-500/20 rounded-md text-xs flex items-center justify-between text-cyan-400">
        <span className="flex items-center gap-1 font-medium">
          <Building2 className="size-3.5" /> Administrador Global
        </span>
        <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-300">
          Todos os CNPJs
        </Badge>
      </div>
    );
  }

  if (scopes.length === 0) {
    return null;
  }

  const activeScope = scopes.find((s) => s.empresaId === activeEmpresaId) || scopes[0];

  function handleSelect(empresaId: string) {
    setActiveEmpresaId(empresaId);
    localStorage.setItem("active_empresa_id", empresaId);
  }

  return (
    <div className="px-2 py-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full flex items-center justify-between gap-2 p-2 bg-muted/30 hover:bg-muted/60 border rounded-md text-xs transition-colors">
          <div className="flex items-center gap-2 truncate text-left">
            <Building2 className="size-4 text-cyan-500 shrink-0" />
            <div className="truncate">
              <p className="font-semibold leading-tight truncate">
                {activeScope.marca || activeScope.nomeEmpresa}
              </p>
              {activeScope.cnpj && (
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {activeScope.cnpj}
                </p>
              )}
            </div>
          </div>
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Alternar Marca / CNPJ
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {scopes.map((s) => {
            const isSelected = s.empresaId === activeScope.empresaId;
            return (
              <DropdownMenuItem
                key={s.empresaId}
                onClick={() => handleSelect(s.empresaId)}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <div>
                  <div className="font-medium">{s.marca || s.nomeEmpresa}</div>
                  {s.cnpj && <div className="text-[10px] text-muted-foreground font-mono">{s.cnpj}</div>}
                </div>
                {isSelected && <Check className="size-4 text-cyan-500 ml-2" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
