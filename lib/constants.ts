export type ActionResult = { ok: true } | { ok: false; error: string };

export const CARGOS = [
  { value: "VENDEDOR_EXTERNO", label: "Vendedor Externo" },
  { value: "ATENDIMENTO_ADM", label: "Atendimento/Administrativo" },
  { value: "SUPERVISOR", label: "Supervisor" },
  // Cargos que existem no cadastro e precisam de rótulo — sem eles, o painel e
  // as metas mostram o código cru (ex.: "RESPONSAVEL_SETOR", "TECNICO").
  { value: "TECNICO", label: "Técnico" },
  { value: "VENDEDOR_AGREGADO", label: "Vendedor Agregado" },
  { value: "RESPONSAVEL_SETOR", label: "Responsável de Setor" },
  { value: "OUTRO_SETOR", label: "Outro Setor" },
] as const;

// Papéis de acesso ao sistema (coluna User.role).
export const ROLES = [
  { value: "ADMIN", label: "Administrativo/Financeiro" },
  { value: "DIRETORIA", label: "Diretoria/Gestão" },
] as const;
