"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, KeyRound, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { navByRole, diretoriaNav } from "@/components/nav-config";
import { Logo } from "@/components/logo";
import packageJson from "@/package.json";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrativo/Financeiro",
  DIRETORIA: "Diretoria/Gestão",
  RH_MANAGER: "Gestão de RH",
  GESTOR_SETOR: "Gestor de Setor",
};

export function AppSidebar({
  role,
  nome,
}: {
  role: string;
  nome: string;
}) {
  const pathname = usePathname();
  const items = navByRole[role] ?? diretoriaNav;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-slate-950/95 backdrop-blur-2xl">
      {/* Top Brand & Logo */}
      <div className="border-b border-white/10 px-5 py-4 space-y-2.5 bg-gradient-to-b from-slate-900/80 to-transparent">
        <div className="flex items-center justify-between">
          <Logo width={160} height={40} className="h-8 w-auto" />
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 shadow-sm shadow-cyan-500/10">
            <Sparkles className="size-3" /> PRO
          </span>
        </div>
        <p className="text-[11px] font-medium text-slate-400 tracking-tight">
          Gestão de Vendas & Bonificação
        </p>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Navegação Principal
        </p>
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent text-cyan-300 shadow-md border-l-2 border-cyan-400"
                  : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
              )}
            >
              <Icon
                className={cn(
                  "size-4 transition-transform duration-200 group-hover:scale-110",
                  active ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile & Logout */}
      <div className="border-t border-white/10 p-3 bg-slate-900/60 space-y-1">
        <Link
          href="/conta"
          title="Alterar minha conta / senha"
          className={cn(
            "flex items-center justify-between rounded-lg p-2.5 transition-all duration-200 hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60",
            pathname === "/conta" && "bg-slate-800 border-slate-700"
          )}
        >
          <div className="truncate">
            <p className="text-xs font-bold text-slate-100 leading-tight truncate">
              {nome}
            </p>
            <p className="text-[10px] text-cyan-400 font-medium truncate mt-0.5">
              {ROLE_LABELS[role] ?? "Diretoria/Gestão"}
            </p>
          </div>
          <KeyRound className="size-4 text-slate-400 shrink-0 hover:text-cyan-400 transition-colors" />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-all font-semibold"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-3.5" />
          Sair da conta
        </Button>
        <div className="mt-2 text-center text-[10px] text-slate-500 font-mono tracking-wider">
          v{packageJson.version} · L&M TELECOM
        </div>
      </div>
    </aside>
  );
}
