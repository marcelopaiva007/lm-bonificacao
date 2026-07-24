-- Remove o módulo de RH/clima organizacional deste sistema: ele passou a viver
-- em repositório e banco próprios (sistemadoRH). Aqui sobra só o motor de
-- bonificação de vendas.
--
-- ATENÇÃO: destrutivo. Apaga empresas, setores, posições, colaboradores,
-- pesquisas e respostas. Só aplique depois de confirmar que este banco NÃO é o
-- mesmo usado pelo sistemadoRH.

-- Contas de acesso que só existiam para o RH. O NOT EXISTS evita apagar quem
-- por acaso tenha registros do motor de bonificação vinculados (lotes de
-- importação / fechamentos) — nesse caso a conta fica e deve ser ajustada à mão.
DELETE FROM "User"
WHERE "role" IN ('RH_MANAGER', 'GESTOR_SETOR')
  AND NOT EXISTS (SELECT 1 FROM "ImportLote" WHERE "ImportLote"."usuarioId" = "User"."id")
  AND NOT EXISTS (SELECT 1 FROM "FechamentoMensal" WHERE "FechamentoMensal"."fechadoPorId" = "User"."id");

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_empresaId_fkey";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_setorId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "empresaId",
DROP COLUMN IF EXISTS "setorId";

-- DropTable (ordem irrelevante por causa do CASCADE, mas mantida das folhas
-- para a raiz por clareza)
DROP TABLE IF EXISTS "RespostaItem" CASCADE;
DROP TABLE IF EXISTS "Resposta" CASCADE;
DROP TABLE IF EXISTS "SurveyToken" CASCADE;
DROP TABLE IF EXISTS "Opcao" CASCADE;
DROP TABLE IF EXISTS "Pergunta" CASCADE;
DROP TABLE IF EXISTS "Pesquisa" CASCADE;
DROP TABLE IF EXISTS "Colaborador" CASCADE;
DROP TABLE IF EXISTS "Posicao" CASCADE;
DROP TABLE IF EXISTS "Setor" CASCADE;
DROP TABLE IF EXISTS "Empresa" CASCADE;
