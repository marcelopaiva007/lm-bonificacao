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
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const adminNav: NavItem[] = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/gestao", label: "Gestão", icon: Gauge },
  { href: "/cadastros/cidades", label: "Cidades", icon: Building2 },
  { href: "/cadastros/equipes", label: "Equipes", icon: UsersRound },
  { href: "/cadastros/funcionarios", label: "Funcionários", icon: Users },
  { href: "/regras", label: "Regras de Bonificação", icon: SlidersHorizontal },
  { href: "/lancamentos", label: "Lançamentos", icon: ClipboardList },
  { href: "/importar", label: "Importar Planilha/CSV", icon: Upload },
  { href: "/importar/elleven", label: "Importar do elleven", icon: Upload },
  { href: "/fechamento", label: "Fechamento Mensal", icon: Lock },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/batimento", label: "Batimento", icon: Scale },
  { href: "/registro", label: "Registro de Alterações", icon: History },
  { href: "/cadastros/usuarios", label: "Usuários", icon: UserCog },
];

export const diretoriaNav: NavItem[] = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/fechamento", label: "Fechamentos", icon: Lock },
];

// Lookup por role — adminNav/diretoriaNav continuam intactos (referenciados
// diretamente em alguns pontos).
export const navByRole: Record<string, NavItem[]> = {
  ADMIN: adminNav,
  DIRETORIA: diretoriaNav,
};
