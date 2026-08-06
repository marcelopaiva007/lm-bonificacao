// Papéis de acesso e o que cada um pode fazer.
//
// Módulo puro (sem "server-only" e sem banco) porque tanto o servidor quanto as
// telas precisam consultar as mesmas regras — um menu que mostra item que a
// pessoa não pode abrir é pior que não mostrar.
//
// Desenho de 06/08/2026, quando o acesso passou a incluir supervisores:
// até então só existia a trava de ADMIN, e QUALQUER pessoa logada via a
// bonificação de todo mundo — inclusive quanto cada colega recebeu.

export const PAPEIS = [
  "ADMIN",
  "DIRETORIA",
  "GERENTE",
  "SUPERVISOR",
  "VENDEDOR",
] as const;

export type Papel = (typeof PAPEIS)[number];

export const PAPEL_LABEL: Record<Papel, string> = {
  ADMIN: "Administrador do sistema",
  DIRETORIA: "Diretoria",
  GERENTE: "Gerente",
  SUPERVISOR: "Supervisor",
  VENDEDOR: "Vendedor",
};

export const PAPEL_DESCRICAO: Record<Papel, string> = {
  ADMIN: "Acesso técnico total, incluindo usuários e integrações.",
  DIRETORIA: "Vê tudo e confere. Não altera regra, lançamento nem fechamento.",
  GERENTE: "Define regra e meta, corrige lançamento e fecha o mês.",
  SUPERVISOR: "Vê o desempenho e a bonificação da própria equipe.",
  VENDEDOR: "Vê apenas o próprio desempenho e a própria bonificação.",
};

// Quanto cada papel enxerga. É a decisão central: sem escopo, um supervisor
// abre a tela de fechamento e lê o bônus de todos os colegas.
export type Escopo = "TUDO" | "EQUIPE" | "PROPRIO";

const ESCOPO_POR_PAPEL: Record<Papel, Escopo> = {
  ADMIN: "TUDO",
  DIRETORIA: "TUDO",
  GERENTE: "TUDO",
  SUPERVISOR: "EQUIPE",
  VENDEDOR: "PROPRIO",
};

export function escopoDoPapel(papel: string): Escopo {
  return ESCOPO_POR_PAPEL[papel as Papel] ?? "PROPRIO";
}

// Capacidades de escrita. Nomeadas pelo efeito no negócio, não pela tabela que
// tocam — quem lê o código precisa entender o que está liberando.
export type Capacidade =
  | "EDITAR_REGRA"
  | "EDITAR_CADASTRO"
  | "EDITAR_LANCAMENTO"
  | "FECHAR_MES"
  | "IMPORTAR_VENDAS"
  | "GERIR_USUARIOS"
  | "VER_REGISTRO_ALTERACOES"
  | "MARCAR_PAGAMENTO";

const CAPACIDADES_POR_PAPEL: Record<Papel, Capacidade[]> = {
  ADMIN: [
    "EDITAR_REGRA",
    "EDITAR_CADASTRO",
    "EDITAR_LANCAMENTO",
    "FECHAR_MES",
    "IMPORTAR_VENDAS",
    "GERIR_USUARIOS",
    "VER_REGISTRO_ALTERACOES",
    "MARCAR_PAGAMENTO",
  ],
  // O gerente faz o trabalho do dia a dia e fecha o mês (decisão da diretoria,
  // 06/08/2026), mas não cria usuário — quem dá acesso é o administrador.
  GERENTE: [
    "EDITAR_REGRA",
    "EDITAR_CADASTRO",
    "EDITAR_LANCAMENTO",
    "FECHAR_MES",
    "IMPORTAR_VENDAS",
    "VER_REGISTRO_ALTERACOES",
    "MARCAR_PAGAMENTO",
  ],
  // Diretoria confere: vê tudo, inclusive o histórico de alterações, e não
  // altera nada. É o contrapeso de o gerente definir a regra e fechar o mês.
  DIRETORIA: ["VER_REGISTRO_ALTERACOES"],
  SUPERVISOR: [],
  VENDEDOR: [],
};

export function pode(papel: string, capacidade: Capacidade): boolean {
  return (CAPACIDADES_POR_PAPEL[papel as Papel] ?? []).includes(capacidade);
}

export function papelValido(papel: string): papel is Papel {
  return (PAPEIS as readonly string[]).includes(papel);
}
