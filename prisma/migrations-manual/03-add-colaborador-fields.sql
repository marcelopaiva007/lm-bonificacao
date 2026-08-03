-- ============================================================================
-- 03-ADD-COLABORADOR-FIELDS — Adiciona campos para preenchimento de dados RH
-- ============================================================================
-- Adiciona os campos salarioFicha e dataAdmissao ao model Colaborador.
-- Necessários para a dashboard de preenchimento da base e cálculo de custos.
-- ============================================================================

BEGIN;

ALTER TABLE rh."Colaborador"
  ADD COLUMN IF NOT EXISTS "salarioFicha" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "dataAdmissao" TIMESTAMP(3);

-- Criar índice para queries de pendências
CREATE INDEX IF NOT EXISTS "Colaborador_salarioFicha_idx" ON rh."Colaborador"("salarioFicha");
CREATE INDEX IF NOT EXISTS "Colaborador_dataAdmissao_idx" ON rh."Colaborador"("dataAdmissao");

COMMIT;
