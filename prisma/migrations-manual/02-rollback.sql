-- =============================================================================
-- 02-ROLLBACK — desfaz o 01-cutover.sql, devolvendo tudo ao schema public.
-- =============================================================================
-- Use se algo der errado ANTES de os apps serem redeployados com o schema novo.
-- Também instantâneo (metadados). Recria as 2 FKs User->RH removidas no cutover
-- com a definição EXATA capturada em produção (ver 00-preflight.sql).
-- =============================================================================

BEGIN;

-- ---- Voltar SHARED ----
ALTER TABLE shared."User" SET SCHEMA public;

-- ---- Voltar BONIFICACAO ----
ALTER TABLE bonificacao."Cidade"                 SET SCHEMA public;
ALTER TABLE bonificacao."Equipe"                 SET SCHEMA public;
ALTER TABLE bonificacao."Funcionario"            SET SCHEMA public;
ALTER TABLE bonificacao."RegraBonificacao"       SET SCHEMA public;
ALTER TABLE bonificacao."LancamentoVenda"        SET SCHEMA public;
ALTER TABLE bonificacao."ImportLote"             SET SCHEMA public;
ALTER TABLE bonificacao."FechamentoMensal"       SET SCHEMA public;
ALTER TABLE bonificacao."BonificacaoCalculada"   SET SCHEMA public;
ALTER TABLE bonificacao."Ajuste"                 SET SCHEMA public;
ALTER TABLE bonificacao.contrato_ativacao_elleven SET SCHEMA public;
ALTER TABLE bonificacao.elleven_relatorio_linha   SET SCHEMA public;
ALTER TABLE bonificacao.venda_chip_movel          SET SCHEMA public;

-- ---- Voltar RH ----
ALTER TABLE rh."Empresa"      SET SCHEMA public;
ALTER TABLE rh."Setor"        SET SCHEMA public;
ALTER TABLE rh."Posicao"      SET SCHEMA public;
ALTER TABLE rh."Colaborador"  SET SCHEMA public;
ALTER TABLE rh."Pesquisa"     SET SCHEMA public;
ALTER TABLE rh."Pergunta"     SET SCHEMA public;
ALTER TABLE rh."Opcao"        SET SCHEMA public;
ALTER TABLE rh."SurveyToken"  SET SCHEMA public;
ALTER TABLE rh."Resposta"     SET SCHEMA public;
ALTER TABLE rh."RespostaItem" SET SCHEMA public;

-- ---- Voltar VAPT ----
ALTER TABLE vapt.vapt_postos      SET SCHEMA public;
ALTER TABLE vapt.vapt_historico   SET SCHEMA public;
ALTER TABLE vapt.vapt_usuarios    SET SCHEMA public;
ALTER TABLE vapt.vapt_importacoes SET SCHEMA public;

-- ---- Recriar as 2 FKs User->RH (defs exatas de produção) ----
ALTER TABLE public."User"
  ADD CONSTRAINT "User_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES public."Empresa"(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."User"
  ADD CONSTRAINT "User_setorId_fkey"
  FOREIGN KEY ("setorId") REFERENCES public."Setor"(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

COMMIT;

-- Schemas vazios podem ser removidos depois de confirmar o rollback:
--   DROP SCHEMA IF EXISTS shared, bonificacao, rh, vapt;
