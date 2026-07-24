# Migração do Banco — Separação por Schemas

**Objetivo:** organizar o banco Neon único em schemas isolados
(`shared`, `bonificacao`, `rh`, `vapt`) e desacoplar o `User` do RH, deixando o
caminho pronto para, no futuro, separar em bancos distintos com facilidade.

**Status:** PREPARAÇÃO CONCLUÍDA (branch `feat/db-schema-separation`).
Nada foi aplicado em produção. Ver "O que falta para executar".

---

## Verdade do banco (inspeção em 24/07/2026)

Um único banco Neon (`neondb`), schema `public`, compartilhado por **3 apps**:

| App | Repo | Tabelas |
|-----|------|---------|
| lm-bonificação | `lm-bonificacao` (este) | Cidade, Equipe, Funcionario, RegraBonificacao, LancamentoVenda, ImportLote, FechamentoMensal, BonificacaoCalculada, Ajuste, contrato_ativacao_elleven, elleven_relatorio_linha, venda_chip_movel |
| sistemadoRH | `sistemadoRH` | Empresa, Setor, Posicao, Colaborador, Pesquisa, Pergunta, Opcao, SurveyToken, Resposta, RespostaItem |
| Painel VAPT | `vapt-postos` | vapt_postos, vapt_historico, vapt_usuarios, vapt_importacoes |
| compartilhado | — | User, _prisma_migrations |

⚠️ **A pesquisa NR-01 está ATIVA** (71 respostas coletadas, 28 tokens pendentes
em 24/07). O move de schema quebra o acesso do app RH até o redeploy — por isso
a execução é numa janela coordenada, de preferência com a NR-01 já encerrada.

### Acoplamentos que importam
FKs cross-schema que existirão depois do move (relevantes p/ separar em bancos):

- `shared.User → rh.Empresa` e `shared.User → rh.Setor` → **removidas no cutover**
  (é o desacoplamento pedido; nenhum código depende do FK físico).
- `bonificacao.ImportLote → shared.User`
- `bonificacao.FechamentoMensal → shared.User`
- `rh.Pesquisa → shared.User`
  → mantidas por ora (Postgres suporta FK entre schemas); viram soft ref na Fase B.

---

## Arquitetura-alvo

- **Um banco, vários schemas.** FKs continuam reais (integridade no banco).
- `prisma/schema.separada.prisma` = schema-alvo de referência (multiSchema, já
  validado no Prisma 7.8). Não é o schema ativo ainda.
- **Não rodar `prisma migrate` contra produção** (os 3 apps dividem
  `_prisma_migrations` e há colunas aplicadas fora das migrations). O schema é
  gerido à mão + `prisma db pull` / `prisma migrate resolve`.

---

## Fase A — organizar em schemas (esta migração)

Arquivos em `prisma/migrations-manual/`:

| Arquivo | O que faz |
|---------|-----------|
| `00-preflight.sql` | Somente leitura. Contagens + defs de FK + estado NR-01. **Rodar e salvar a saída.** |
| `01-cutover.sql` | `CREATE SCHEMA` + `ALTER TABLE ... SET SCHEMA` (instantâneo) + solta as 2 FKs User→RH. Transacional. |
| `02-rollback.sql` | Devolve tudo ao `public` e recria as 2 FKs (defs exatas de produção). |

`ALTER TABLE ... SET SCHEMA` é troca de metadados: instantâneo, sem cópia de
dados, leva junto índices/constraints/sequências. Pega lock `ACCESS EXCLUSIVE`
por instantes — por isso, janela de manutenção.

### Passo a passo da janela
1. **Backup:** criar uma **Neon branch** do `neondb` (snapshot instantâneo,
   grátis). Console Neon → Branches → Create branch. É o ponto de restauração.
2. Rodar `00-preflight.sql`; salvar a saída.
3. Colocar os 3 apps em manutenção (ou pausar tráfego).
4. Rodar `01-cutover.sql`.
5. Redeployar os 3 apps com o schema multiSchema:
   - **lm-bonificação:** substituir `prisma/schema.prisma` pelo conteúdo de
     `prisma/schema.separada.prisma`; `prisma generate`; deploy. Ajustar código
     que usava `User.empresa`/`User.setor` como relação (ver "Impacto no código").
   - **sistemadoRH:** aplicar o MESMO mapa de `@@schema` no schema dele
     (Empresa/Setor/... → `rh`, User → `shared`) e a `DATABASE_URL` com os
     schemas; deploy.
   - **vapt-postos:** apontar para o schema `vapt`; deploy.
6. Conferir (ver "Verificação").
7. Se algo falhar antes/durante os redeploys: `02-rollback.sql` e voltar os apps.

### Conexão (Vercel)
Com multiSchema, a `DATABASE_URL` NÃO precisa de `?schema=` — os schemas são
declarados no bloco `datasource { schemas = [...] }`. Cada app deve listar só os
schemas que usa + `shared`. Mantém-se a mesma credencial/host do Neon.

---

## Impacto no código (lm-bonificação) — para a janela

Como `User.empresa`/`User.setor` deixam de ser relação, buscar nome de
empresa/setor de um usuário passa a ser consulta separada por `empresaId`/
`setorId`. Arquivos a revisar (grep de `empresa`/`setor`/`fechadoPor`/
`criadoPor`/`usuario` em 24/07 — 19 arquivos; a maioria é do módulo RH):

- `lib/actions/fechamento.ts`, `app/(app)/fechamento/[periodo]/*`
- `lib/actions/pesquisas.ts`, `lib/actions/pesquisas-publico.ts`
- `app/(app)/usuarios/*`, `app/(app)/cadastros/usuarios/*`
- `app/(app)/rh/**`, `lib/actions/rh-*.ts`
- `prisma/seed.ts`

As relações `ImportLote.usuario`, `FechamentoMensal.fechadoPor` e
`Pesquisa.criadoPor` permanecem — **não** precisam mudar na Fase A.

---

## Fase B — separar em bancos distintos (FUTURO, quando quiser)

Depois da Fase A, separar vira trabalho de dias, não semanas:

1. Provisionar novo(s) banco(s) Neon (ex.: um para `rh`).
2. Copiar o schema alvo: `pg_dump --schema=rh ... | psql <novo_banco>` (ou Neon
   branch + drop dos outros schemas).
3. Converter as 3 FKs cross-schema restantes (ImportLote/FechamentoMensal/
   Pesquisa → User) em **referência leve**: `DROP CONSTRAINT` + remover o
   `@relation` no schema.prisma (mantendo a coluna `*Id`). Ajustar as consultas
   que faziam `include` desses usuários.
4. Cada app aponta sua `DATABASE_URL` para o banco correspondente.
5. `shared.User`: decidir onde mora (duplicar auth por app, ou um serviço de
   auth central). Como já está desacoplado do RH, essa escolha fica livre.

---

## Verificação (pós-cutover)

```sql
-- Tabelas nos schemas certos
SELECT schemaname, count(*) FROM pg_stat_user_tables
WHERE schemaname IN ('shared','bonificacao','rh','vapt') GROUP BY schemaname;

-- Contagens batem com o preflight (nada perdido)
SELECT 'Resposta' t, count(*) FROM rh."Resposta"
UNION ALL SELECT 'LancamentoVenda', count(*) FROM bonificacao."LancamentoVenda"
UNION ALL SELECT 'User', count(*) FROM shared."User";

-- As 2 FKs User->RH sumiram; as 3 para User continuam
SELECT conname FROM pg_constraint
WHERE conname LIKE 'User_%fkey'
   OR conname IN ('ImportLote_usuarioId_fkey','FechamentoMensal_fechadoPorId_fkey','Pesquisa_criadoPorId_fkey');
```

Fumaça funcional: login, dashboard de vendas, responder um token da NR-01,
fechar/reabrir um período de teste.

---

## O que falta para executar

- [ ] Encerrar (ou aceitar risco d)a NR-01 ativa.
- [ ] Coordenar redeploy dos 3 repos (2 fora desta conversa).
- [ ] Ajustar o código do lm-bonificação (seção "Impacto no código").
- [ ] Definir janela de manutenção.
- [ ] Criar a Neon branch de backup imediatamente antes.
