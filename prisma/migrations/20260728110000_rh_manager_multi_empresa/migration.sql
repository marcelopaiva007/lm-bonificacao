-- Migration: suporte a múltiplas empresas por usuário RH_MANAGER
-- O campo empresaId (único) é substituído por empresasIds (array TEXT[]).
-- Dados existentes são preservados: o empresaId anterior vira o primeiro elemento do array.

-- 1. Adicionar nova coluna
ALTER TABLE "shared"."User" ADD COLUMN "empresasIds" TEXT[] NOT NULL DEFAULT '{}';

-- 2. Migrar dados existentes
UPDATE "shared"."User"
SET "empresasIds" = ARRAY["empresaId"]
WHERE "empresaId" IS NOT NULL;

-- 3. Remover índice antigo
DROP INDEX IF EXISTS "shared"."User_empresaId_idx";

-- 4. Remover coluna antiga
ALTER TABLE "shared"."User" DROP COLUMN "empresaId";

-- 5. Criar índice GIN para consultas array @> (contains)
CREATE INDEX "User_empresasIds_idx" ON "shared"."User" USING GIN ("empresasIds");
