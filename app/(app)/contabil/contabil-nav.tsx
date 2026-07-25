"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, TrendingUp, Receipt, Lock, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { podeEditarContabil } from "@/lib/contabil";

const ITENS = [
  { href: "/contabil", label: "Painel", icon: LayoutDashboard, soEditor: false },
  { href: "/contabil/resultado", label: "Faturamento x Despesas", icon: TrendingUp, soEditor: false },
  { href: "/contabil/impostos", label: "Impostos", icon: Receipt, soEditor: false },
  { href: "/contabil/fechamento", label: "Fechamento", icon: Lock, soEditor: false },
  { href: "/contabil/cadastros", label: "Cadastros", icon: Settings, soEditor: true },
];

export function ContabilNav({ role }: { role: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Empresa e ano viajam junto na navegação — trocar de aba não deve fazer o
  // analista escolher a empresa de novo.
  const filtros = new URLSearchParams();
  const empresa = searchParams.get("empresa");
  const ano = searchParams.get("ano");
  if (empresa) filtros.set("empresa", empresa);
  if (ano) filtros.set("ano", ano);
  const query = filtros.toString();

  const itens = ITENS.filter((i) => !i.soEditor || podeEditarContabil(role));

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-2">
      {itens.map((item) => {
        const ativo =
          item.href === "/contabil" ? pathname === "/contabil" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={query ? `${item.href}?${query}` : item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
