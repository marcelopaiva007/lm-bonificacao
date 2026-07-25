-- =============================================================================
-- 03-CONTABIL — cria o schema do módulo contábil (impostos, resultado, fechamento)
-- =============================================================================
-- Segue a regra do projeto: NÃO rodar `prisma migrate` contra produção (os apps
-- dividem o mesmo `_prisma_migrations`). O DDL é aplicado à mão e o
-- prisma/schema.prisma é mantido em sincronia (ver docs/MIGRACAO-BANCO.md).
--
-- Tudo aqui é CREATE — não altera nem lê nenhuma tabela existente, então é
-- seguro rodar com os apps no ar. Idempotente (IF NOT EXISTS).
--
-- Nenhuma FK sai do schema `contabil`: quem fechou a competência é gravado como
-- referência leve (fechadaPorId + fechadaPor), de propósito, para o módulo já
-- nascer pronto para virar banco próprio (Fase B).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS contabil;

BEGIN;

-- ---- Empresas do escopo contábil (LM Telecom, Centrysol, VAPT...) ----
CREATE TABLE IF NOT EXISTS contabil.empresa_contabil (
  "id"        TEXT         NOT NULL,
  "nome"      TEXT         NOT NULL,
  "cnpj"      TEXT,
  "regime"    TEXT,
  "ativo"     BOOLEAN      NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT empresa_contabil_pkey PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS empresa_contabil_nome_key
  ON contabil.empresa_contabil ("nome");

-- ---- Tributos acompanhados (ISS, PIS, COFINS, retenções...) ----
CREATE TABLE IF NOT EXISTS contabil.tipo_imposto (
  "id"        TEXT         NOT NULL,
  "nome"      TEXT         NOT NULL,
  "descricao" TEXT,
  "ordem"     INTEGER      NOT NULL DEFAULT 0,
  "ativo"     BOOLEAN      NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tipo_imposto_pkey PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS tipo_imposto_nome_key
  ON contabil.tipo_imposto ("nome");

-- ---- Competência = empresa + mês ("AAAA-MM"). O lucro é sempre derivado. ----
CREATE TABLE IF NOT EXISTS contabil.competencia_contabil (
  "id"           TEXT         NOT NULL,
  "empresaId"    TEXT         NOT NULL,
  "periodo"      TEXT         NOT NULL,
  "faturamento"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "despesas"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"       TEXT         NOT NULL DEFAULT 'ABERTA',
  "fechadaEm"    TIMESTAMP(3),
  "fechadaPorId" TEXT,
  "fechadaPor"   TEXT,
  "observacoes"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT competencia_contabil_pkey PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS competencia_contabil_empresaId_periodo_key
  ON contabil.competencia_contabil ("empresaId", "periodo");
CREATE INDEX IF NOT EXISTS competencia_contabil_periodo_idx
  ON contabil.competencia_contabil ("periodo");

-- ---- Valor apurado de cada tributo + controle da guia ----
CREATE TABLE IF NOT EXISTS contabil.imposto_apurado (
  "id"            TEXT         NOT NULL,
  "competenciaId" TEXT         NOT NULL,
  "tipoId"        TEXT         NOT NULL,
  "valor"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vencimento"    TIMESTAMP(3),
  "status"        TEXT         NOT NULL DEFAULT 'PENDENTE',
  "dataPagamento" TIMESTAMP(3),
  "valorPago"     DOUBLE PRECISION,
  "documento"     TEXT,
  "observacoes"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT imposto_apurado_pkey PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS imposto_apurado_competenciaId_tipoId_key
  ON contabil.imposto_apurado ("competenciaId", "tipoId");
CREATE INDEX IF NOT EXISTS imposto_apurado_tipoId_idx
  ON contabil.imposto_apurado ("tipoId");
CREATE INDEX IF NOT EXISTS imposto_apurado_status_idx
  ON contabil.imposto_apurado ("status");

-- ---- FKs (todas internas ao schema contabil) ----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'competencia_contabil_empresaId_fkey'
  ) THEN
    ALTER TABLE contabil.competencia_contabil
      ADD CONSTRAINT "competencia_contabil_empresaId_fkey"
      FOREIGN KEY ("empresaId") REFERENCES contabil.empresa_contabil("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imposto_apurado_competenciaId_fkey'
  ) THEN
    ALTER TABLE contabil.imposto_apurado
      ADD CONSTRAINT "imposto_apurado_competenciaId_fkey"
      FOREIGN KEY ("competenciaId") REFERENCES contabil.competencia_contabil("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'imposto_apurado_tipoId_fkey'
  ) THEN
    ALTER TABLE contabil.imposto_apurado
      ADD CONSTRAINT "imposto_apurado_tipoId_fkey"
      FOREIGN KEY ("tipoId") REFERENCES contabil.tipo_imposto("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;

-- Conferência rápida:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'contabil';
