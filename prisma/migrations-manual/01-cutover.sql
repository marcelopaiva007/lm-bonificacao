-- =============================================================================
-- 01-CUTOVER — Fase A: organiza o banco em schemas (shared / bonificacao / rh / vapt)
-- =============================================================================
-- ✅ EXECUTADO em 24/07/2026 ~21:50 UTC, com 3 desvios deliberados:
--   1. vapt_* NÃO foi movido — ficou no public (o app VAPT não precisou de
--      redeploy; mover depois é trivial e vira tarefa própria).
--   2. Backup por cópia no schema backup_pre_cutover (27 tabelas) em vez de
--      Neon branch — remover esse schema quando a migração estiver validada.
--   3. Rede de segurança adicionada: ALTER ROLE neondb_owner SET search_path =
--      public, bonificacao, rh, shared (qualquer SQL cru não qualificado que
--      tenha escapado continua resolvendo).
-- =============================================================================
-- PRÉ-REQUISITOS (ver docs/MIGRACAO-BANCO.md):
--   1. Backup pronto (Neon branch criada).
--   2. Os 3 apps (lm-bonificacao, sistemadoRH, vapt-postos) em janela de
--      manutenção OU prontos para redeploy imediato com schema multiSchema.
--   3. 00-preflight.sql já rodado e a saída salva.
--
-- ALTER TABLE ... SET SCHEMA é INSTANTÂNEO (só metadados) e leva junto índices,
-- constraints e sequências próprias. Não copia dados. Tudo numa transação: ou
-- move tudo, ou nada.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS shared;
CREATE SCHEMA IF NOT EXISTS bonificacao;
CREATE SCHEMA IF NOT EXISTS rh;
CREATE SCHEMA IF NOT EXISTS vapt;

BEGIN;

-- ---- SHARED (autenticação) ----
ALTER TABLE public."User" SET SCHEMA shared;

-- ---- BONIFICACAO (motor de vendas) ----
ALTER TABLE public."Cidade"                 SET SCHEMA bonificacao;
ALTER TABLE public."Equipe"                 SET SCHEMA bonificacao;
ALTER TABLE public."Funcionario"            SET SCHEMA bonificacao;
ALTER TABLE public."RegraBonificacao"       SET SCHEMA bonificacao;
ALTER TABLE public."LancamentoVenda"        SET SCHEMA bonificacao;
ALTER TABLE public."ImportLote"             SET SCHEMA bonificacao;
ALTER TABLE public."FechamentoMensal"       SET SCHEMA bonificacao;
ALTER TABLE public."BonificacaoCalculada"   SET SCHEMA bonificacao;
ALTER TABLE public."Ajuste"                 SET SCHEMA bonificacao;
ALTER TABLE public.contrato_ativacao_elleven SET SCHEMA bonificacao;
ALTER TABLE public.elleven_relatorio_linha   SET SCHEMA bonificacao;
ALTER TABLE public.venda_chip_movel          SET SCHEMA bonificacao;

-- ---- RH (clima organizacional) ----
ALTER TABLE public."Empresa"      SET SCHEMA rh;
ALTER TABLE public."Setor"        SET SCHEMA rh;
ALTER TABLE public."Posicao"      SET SCHEMA rh;
ALTER TABLE public."Colaborador"  SET SCHEMA rh;
ALTER TABLE public."Pesquisa"     SET SCHEMA rh;
ALTER TABLE public."Pergunta"     SET SCHEMA rh;
ALTER TABLE public."Opcao"        SET SCHEMA rh;
ALTER TABLE public."SurveyToken"  SET SCHEMA rh;
ALTER TABLE public."Resposta"     SET SCHEMA rh;
ALTER TABLE public."RespostaItem" SET SCHEMA rh;

-- ---- VAPT (painel de postos) ----
ALTER TABLE public.vapt_postos      SET SCHEMA vapt;
ALTER TABLE public.vapt_historico   SET SCHEMA vapt;
ALTER TABLE public.vapt_usuarios    SET SCHEMA vapt;
ALTER TABLE public.vapt_importacoes SET SCHEMA vapt;

-- ---- DESACOPLAR User do RH ----
-- Remove as 2 únicas FKs que apontam do shared para dentro do rh. Nenhum código
-- do app depende do FK físico (o Prisma resolve a relação pela coluna). É isto
-- que deixa o schema `shared` autossuficiente para virar um banco próprio.
-- (As colunas empresaId/setorId permanecem — viram referência leve.)
ALTER TABLE shared."User" DROP CONSTRAINT IF EXISTS "User_empresaId_fkey";
ALTER TABLE shared."User" DROP CONSTRAINT IF EXISTS "User_setorId_fkey";

COMMIT;

-- Observações:
--  * public._prisma_migrations é deixado onde está de propósito.
--  * As 3 FKs cross-schema restantes (ImportLote/FechamentoMensal/Pesquisa ->
--    shared.User) continuam válidas — o Postgres suporta FK entre schemas.
--    Elas só serão removidas na Fase B (separação definitiva em bancos).
