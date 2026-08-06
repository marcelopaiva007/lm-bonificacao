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
  History,
  GitCompare,
  Wallet,
  Send,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// O menu é montado a partir das MESMAS capacidades que protegem as páginas
// (lib/permissoes.ts). Mostrar item que a pessoa não pode abrir é pior que não
// mostrar: ela clica, é redirecionada, e fica achando que o sistema quebrou.

const PAINEL: NavItem = { href: "/", label: "Painel", icon: LayoutDashboard };
const RELATORIOS: NavItem = { href: "/relatorios", label: "Relatórios", icon: BarChart3 };
const FECHAMENTO: NavItem = { href: "/fechamento", label: "Fechamento Mensal", icon: Lock };
const METAS: NavItem = { href: "/metas", label: "Metas", icon: Send };
const REGISTRO: NavItem = { href: "/registro", label: "Registro de Alterações", icon: History };
const BATIMENTO: NavItem = { href: "/batimento", label: "Batimento", icon: GitCompare };
const PAGAMENTOS: NavItem = { href: "/pagamentos", label: "Pagamentos", icon: Wallet };

const OPERACAO: NavItem[] = [
  { href: "/cadastros/cidades", label: "Cidades", icon: Building2 },
  { href: "/cadastros/equipes", label: "Equipes", icon: UsersRound },
  { href: "/cadastros/funcionarios", label: "Funcionários", icon: Users },
  { href: "/regras", label: "Regras de Bonificação", icon: SlidersHorizontal },
  { href: "/lancamentos", label: "Lançamentos", icon: ClipboardList },
  { href: "/importar", label: "Importar Planilha/CSV", icon: Upload },
  { href: "/importar/elleven", label: "Importar do elleven", icon: Upload },
];

export const adminNav: NavItem[] = [
  PAINEL,
  ...OPERACAO,
  FECHAMENTO,
  PAGAMENTOS,
  METAS,
  RELATORIOS,
  BATIMENTO,
  REGISTRO,
  { href: "/cadastros/usuarios", label: "Usuários", icon: UserCog },
];

// Gerente faz o trabalho do dia a dia e fecha o mês; não cria usuário.
export const gerenteNav: NavItem[] = [
  PAINEL,
  ...OPERACAO,
  FECHAMENTO,
  PAGAMENTOS,
  METAS,
  RELATORIOS,
  BATIMENTO,
  REGISTRO,
];

// Diretoria confere. Vê inclusive o registro de alterações — é o contrapeso de
// o gerente definir a regra e fechar o mês.
export const diretoriaNav: NavItem[] = [
  PAINEL,
  RELATORIOS,
  FECHAMENTO,
  PAGAMENTOS,
  METAS,
  REGISTRO,
];

// Supervisor e vendedor só consultam, e o que veem já vem limitado pelo escopo
// (lib/escopo.ts). Sem fechamento: o valor a pagar de terceiros não é assunto
// de quem não paga.
export const supervisorNav: NavItem[] = [PAINEL, METAS, RELATORIOS];

export const vendedorNav: NavItem[] = [PAINEL, METAS];

export const navByRole: Record<string, NavItem[]> = {
  ADMIN: adminNav,
  GERENTE: gerenteNav,
  DIRETORIA: diretoriaNav,
  SUPERVISOR: supervisorNav,
  VENDEDOR: vendedorNav,
};
