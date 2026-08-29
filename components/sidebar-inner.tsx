"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { gruposByRole, diretoriaGrupos } from "@/components/nav-config";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrativo/Financeiro",
  DIRETORIA: "Diretoria/Gestão",
};

export type SidebarInnerProps = {
  role: string;
  nome: string;
  /** "v<número> · <data>" — ver lib/versao.ts. */
  versao: string;
  /** O sha do commit (ou "local"), para conferência técnica. */
  versaoDetalhe: string;
  /** Chamado ao navegar — usado pelo drawer mobile para fechar ao clicar. */
  onNavigate?: () => void;
};

/**
 * Conteúdo da navegação lateral, compartilhado entre a sidebar fixa do desktop
 * ({@link AppSidebar}) e o drawer do mobile ({@link MobileNav}). Não define
 * largura nem borda externa — quem o envolve decide isso. Os itens vêm
 * agrupados por seção (Visão geral, Cadastros, Operação, Análise, Sistema).
 */
export function SidebarInner({
  role,
  nome,
  versao,
  versaoDetalhe,
  onNavigate,
}: SidebarInnerProps) {
  const pathname = usePathname();
  const grupos = gruposByRole[role] ?? diretoriaGrupos;

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Logo width={180} height={44} className="h-9 w-auto" />
        <p className="mt-1 text-xs text-muted-foreground">Bonificação de Vendas</p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {grupos.map((grupo) => (
          <div key={grupo.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase">
              {grupo.label}
            </p>
            <ul className="space-y-0.5">
              {grupo.itens.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                        active
                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      {active && (
                        <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_12px_var(--accent)]" />
                      )}
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active ? "text-accent" : "group-hover:text-accent/80"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/conta"
          onClick={onNavigate}
          className={cn(
            "mb-2 flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent/50",
            pathname === "/conta" && "bg-sidebar-accent/50"
          )}
        >
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-medium">{nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ROLE_LABELS[role] ?? "Diretoria/Gestão"}
            </p>
          </div>
          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
        </Link>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="size-4" />
          Sair
        </Button>
        {/* Rodapé de versão: responde "estou na versão nova?" sem abrir o GitHub.
            Detalhe é o commit — abre /novidades para o histórico completo. */}
        <Link
          href="/novidades"
          onClick={onNavigate}
          className="mt-2 block rounded-md px-2 py-0.5 transition-colors hover:bg-sidebar-accent/50"
        >
          <p className="text-[11px] leading-tight font-medium tabular-nums text-muted-foreground/80">
            {versao}
          </p>
          <p className="text-[11px] leading-tight tabular-nums text-muted-foreground/50">
            {versaoDetalhe}
          </p>
        </Link>
      </div>
    </div>
  );
}
