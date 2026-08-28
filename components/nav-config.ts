import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Building2,
  Users,
  UsersRound,
  SlidersHorizontal,
  ClipboardList,
  Upload,
  Lock,
  BarChart3,
  UserCog,
  Gauge,
  Wallet,
  Target,
  Scale,
  History,
  Sparkles,
  Activity,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Grupo de itens da navegação, com um rótulo de seção. */
export type NavGroup = {
  label: string;
  itens: NavItem[];
};

export const adminGrupos: NavGroup[] = [
  {
    label: "Visão geral",
    itens: [
      { href: "/", label: "Painel", icon: LayoutDashboard },
      { href: "/gestao", label: "Gestão", icon: Gauge },
    ],
  },
  {
    label: "Cadastros",
    itens: [
      { href: "/cadastros/cidades", label: "Cidades", icon: Building2 },
      { href: "/cadastros/equipes", label: "Equipes", icon: UsersRound },
      { href: "/cadastros/funcionarios", label: "Funcionários", icon: Users },
      { href: "/regras", label: "Regras de Bonificação", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Operação",
    itens: [
      { href: "/lancamentos", label: "Lançamentos", icon: ClipboardList },
      { href: "/importar", label: "Importar Planilha/CSV", icon: Upload },
      { href: "/importar/elleven", label: "Importar do elleven", icon: Upload },
      { href: "/fechamento", label: "Fechamento Mensal", icon: Lock },
      { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
      { href: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    label: "Análise",
    itens: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/batimento", label: "Batimento", icon: Scale },
      { href: "/registro", label: "Registro de Alterações", icon: History },
    ],
  },
  {
    label: "Sistema",
    itens: [
      { href: "/cadastros/usuarios", label: "Usuários", icon: UserCog },
      { href: "/diagnostico", label: "Diagnóstico", icon: Activity },
      { href: "/novidades", label: "Novidades", icon: Sparkles },
    ],
  },
];

export const diretoriaGrupos: NavGroup[] = [
  {
    label: "Visão geral",
    itens: [{ href: "/", label: "Painel", icon: LayoutDashboard }],
  },
  {
    label: "Análise",
    itens: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/fechamento", label: "Fechamentos", icon: Lock },
    ],
  },
  {
    label: "Sistema",
    itens: [{ href: "/novidades", label: "Novidades", icon: Sparkles }],
  },
];

// Lookup de grupos por papel de acesso (coluna User.role).
export const gruposByRole: Record<string, NavGroup[]> = {
  ADMIN: adminGrupos,
  DIRETORIA: diretoriaGrupos,
};

// Versões planas (um único array por papel) — mantidas para qualquer consumidor
// que precise iterar os itens sem os grupos.
export const adminNav: NavItem[] = adminGrupos.flatMap((g) => g.itens);
export const diretoriaNav: NavItem[] = diretoriaGrupos.flatMap((g) => g.itens);

export const navByRole: Record<string, NavItem[]> = {
  ADMIN: adminNav,
  DIRETORIA: diretoriaNav,
};
