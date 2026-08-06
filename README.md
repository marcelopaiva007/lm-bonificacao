# LM Bonificação

Sistema de comissão de vendas da L&M Telecom. Captura as vendas do Elleven e do
L&M Móvel, calcula quanto cada vendedor recebe no mês e fecha o período para
pagamento.

**No ar:** https://vendas.assinelm.com

---

## Banco de dados

A conexão vem de **`DATABASE_URL`** — e só dela.

O projeto também tem 14 variáveis `LM_BONIFICACAO_*` (`POSTGRES_URL`, `PGHOST`,
`DATABASE_URL_UNPOOLED` e companhia) criadas automaticamente pela integração do
Neon. **Nenhuma é lida pelo código.** Para trocar de banco, muda-se
`DATABASE_URL`; mexer nas prefixadas não tem efeito.

O banco (`lm-bonificacao-db`, Neon, São Paulo) é **compartilhado com o
sistemadoRH**, separado por schemas: `bonificacao`, `shared` e `rh`. Um problema
nele derruba os dois sistemas.

Sem `DATABASE_URL`, o sistema **não sobe em produção** — de propósito. Antes ele
caía num SQLite local vazio em silêncio, o que fazia parecer que os dados tinham
sumido.

### Migrations

Este projeto **não roda `prisma migrate` contra produção** — três aplicações
dividem o mesmo `_prisma_migrations`. O schema é mantido à mão, e colunas ou
tabelas novas são criadas sob demanda (`ADD COLUMN IF NOT EXISTS`).

⚠️ Ao adicionar campo em modelo existente, garanta a coluna **também no caminho
dos crons** — eles não passam pelo `requireUser`, que é quem normalmente cria as
colunas. Ver `lib/ensure-schema.ts`.

---

## Rodar local

```bash
npm install
vercel env pull .env.local
npm run dev
```

Sem `.env.local`, o sistema usa um SQLite em `prisma/dev.db`.

---

## Automações

Rodam sozinhas todo dia (horário de Brasília):

| Hora | O quê |
|------|-------|
| 03:15 | Elleven — Vendedores Comercial |
| 03:30 | Elleven — **Funil de Vendas** (única fonte da bonificação) |
| 03:45 | Elleven — Pedidos de Venda |
| 04:00 | Vendas de chip (L&M Móvel) |
| 09:00 | Cobrança de metas |

Falha avisa no Telegram quem estiver marcado em **Cadastros → Vincular
Telegram**. Saúde das automações em `/api/health/crons`.

Disparo manual: `vercel crons run "/api/cron/sync-elleven?report=funil-de-vendas"`

---

## Versão

Todo PR que muda produção sobe a `version` do `package.json` — ver `AGENTS.md`.
A etiqueta `v<versão> · <commit>` aparece abaixo da marca, no menu e no login.

---

## Perdeu o acesso de administrador

Não existe "esqueci minha senha" na tela. Pela linha de comando:

```bash
npx tsx scripts/redefinir-senha.ts --listar
npx tsx scripts/redefinir-senha.ts <username>
```

A senha é digitada no terminal, sem aparecer na tela.
