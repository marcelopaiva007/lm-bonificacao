-- =============================================================================
-- 00-PREFLIGHT — SOMENTE LEITURA. Rode ANTES do cutover e SALVE a saída.
-- É a fonte da verdade para conferência pós-migração e para o rollback dos FKs.
-- =============================================================================

-- (1) Contagem de linhas por tabela (guardar para comparar depois do move)
SELECT schemaname, relname AS tabela, n_live_tup AS linhas
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

-- (2) Definição EXATA das 5 FKs cross-schema (para recriar no rollback se preciso)
SELECT conrelid::regclass AS tabela, conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname IN (
  'User_empresaId_fkey','User_setorId_fkey','Pesquisa_criadoPorId_fkey',
  'FechamentoMensal_fechadoPorId_fkey','ImportLote_usuarioId_fkey'
)
ORDER BY conname;

-- (3) Estado da pesquisa NR-01 ao vivo (não deve mudar com o move)
SELECT id, titulo, status FROM public."Pesquisa";
SELECT COUNT(*) AS respostas FROM public."Resposta";
SELECT status, COUNT(*) FROM public."SurveyToken" GROUP BY status;
