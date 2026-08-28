"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { navByRole, diretoriaNav } from "@/components/nav-config";
import { Logo } from "@/components/logo";

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
 * largura nem borda externa — quem o envolve decide isso.
 */
export function SidebarInner({
  role,
  nome,
  versao,
  versaoDetalhe,
  onNavigate,
}: SidebarInnerProps) {
  const pathname = usePathname();
  const items = navByRole[role] ?? diretoriaNav;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-4">
        <Logo width={180} height={44} className="h-9 w-auto" />
        <p className="mt-1 text-xs text-muted-foreground">Bonificação de Vendas</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/conta"
          onClick={onNavigate}
          className={cn(
            "mb-2 flex items-center justify-between rounded-md px-1 py-1 transition-colors hover:bg-muted",
            pathname === "/conta" && "bg-muted"
          )}
        >
          <div>
            <p className="text-sm font-medium leading-tight">{nome}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[role] ?? "Diretoria/Gestão"}
            </p>
          </div>
          <KeyRound className="size-4 text-muted-foreground" />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
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
          className="mt-2 block rounded-md px-1 py-0.5 transition-colors hover:bg-muted"
        >
          <p className="text-[11px] font-medium leading-tight tabular-nums text-muted-foreground/80">
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
