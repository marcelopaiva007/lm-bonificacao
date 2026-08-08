"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { User, Bell, ChevronRight, KeyRound, LogOut, Building2 } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard Executivo", subtitle: "Visão geral de vendas, metas e ranking" },
  "/lancamentos": { title: "Lançamentos de Vendas", subtitle: "Gestão e registro de vendas por funcionário" },
  "/fechamento": { title: "Fechamento Mensal", subtitle: "Aprovação e congelamento de comissões" },
  "/regras": { title: "Regras de Bonificação", subtitle: "Configuração de fórmulas e aceleradores" },
  "/metas": { title: "Acompanhamento de Metas", subtitle: "Desempenho das equipes e metas individuais" },
  "/relatorios": { title: "Relatórios & Analytics", subtitle: "Análise detalhada de performance por cidade e cargo" },
  "/cadastros": { title: "Cadastros Gerais", subtitle: "Gestão de funcionários, equipes e cidades" },
  "/auditoria": { title: "Trilha de Auditoria", subtitle: "Histórico de alterações e eventos do sistema" },
  "/usuarios": { title: "Gestão de Usuários", subtitle: "Controle de acessos e permissões por perfil" },
  "/conta": { title: "Minha Conta", subtitle: "Configurações de perfil e alteração de senha" },
  "/importar": { title: "Importação de Dados", subtitle: "Carregamento automatizado de planilhas e sistemas" },
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador Global",
  DIRETORIA: "Diretoria & Gestão",
  RH_MANAGER: "Gestor de RH",
  GESTOR_SETOR: "Gestor de Setor",
};

export function AppHeader({
  role,
  nome,
}: {
  role: string;
  nome: string;
}) {
  const pathname = usePathname();

  // Find match or default to dashboard
  const baseRoute = Object.keys(PAGE_TITLES).find(
    (route) => route !== "/" && pathname.startsWith(route)
  ) || "/";

  const pageInfo = PAGE_TITLES[baseRoute] ?? {
    title: "Sistema de Vendas",
    subtitle: "Plataforma L&M Telecom",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-white/10 bg-slate-950/70 px-6 backdrop-blur-xl transition-all">
      {/* Title and Breadcrumbs */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
              L&M Telecom
            </span>
            <ChevronRight className="size-3.5 text-slate-500" />
            <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
              {pageInfo.title}
            </h1>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block mt-0.5">
            {pageInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls: User Profile Menu */}
      <div className="flex items-center gap-3">
        {/* User Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full border border-cyan-500/25 bg-slate-900/80 p-1.5 pr-3.5 text-left transition-all hover:border-cyan-400/50 hover:bg-slate-800/90 focus:outline-none shadow-md">
            <div className="relative flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 font-extrabold text-slate-950 shadow-md shadow-cyan-500/20">
              {nome ? nome.charAt(0).toUpperCase() : "U"}
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
            </div>
            <div className="hidden text-xs sm:block">
              <p className="font-bold text-slate-100 leading-tight truncate max-w-[130px]">
                {nome}
              </p>
              <p className="text-[10px] text-cyan-400 font-medium truncate max-w-[130px]">
                {ROLE_LABELS[role] ?? role}
              </p>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 border-slate-800 bg-slate-950/95 backdrop-blur-2xl shadow-2xl">
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold text-slate-100">{nome}</p>
                <p className="text-xs text-cyan-400 font-mono">
                  {ROLE_LABELS[role] ?? role}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800/80" />

            <DropdownMenuItem className="cursor-pointer text-xs p-2 hover:bg-slate-900 focus:bg-slate-900">
              <Link href="/conta" className="flex items-center gap-2 w-full text-slate-200">
                <KeyRound className="size-4 text-cyan-400" />
                Minha Conta / Senha
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-slate-800/80" />

            <DropdownMenuItem
              className="cursor-pointer text-xs text-rose-400 p-2 focus:bg-rose-950/40 focus:text-rose-300"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4 mr-2" />
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
