import { PAPEIS, PAPEL_LABEL, PAPEL_DESCRICAO } from "@/lib/permissoes";

export type ActionResult = { ok: true } | { ok: false; error: string };

export const CARGOS = [
  { value: "VENDEDOR_EXTERNO", label: "Vendedor Externo" },
  { value: "ATENDIMENTO_ADM", label: "Atendimento/Administrativo" },
  { value: "SUPERVISOR", label: "Supervisor" },
  // Cargos criados em 08/08/2026 (regras definidas pela diretoria).
  // GESTOR fica de fora até a regra dele ser definida — cargo sem regra
  // pagaria zero em silêncio.
  { value: "TECNICO", label: "Técnico" },
  { value: "VENDEDOR_AGREGADO", label: "Vendedor Agregado" },
  { value: "RESPONSAVEL_SETOR", label: "Responsável de Setor" },
  { value: "OUTRO_SETOR", label: "Outro Setor" },
] as const;

// Papéis de acesso ao sistema (coluna User.role), derivados da fonte única em
// lib/permissoes.ts — assim o que a tela oferece nunca sai de sincronia com o
// que o sistema realmente reconhece.
export const ROLES = PAPEIS.map((value) => ({
  value,
  label: PAPEL_LABEL[value],
  descricao: PAPEL_DESCRICAO[value],
}));
