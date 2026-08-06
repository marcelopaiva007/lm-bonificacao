---
name: lm-bonificacao
description: Conhecimento de domínio do sistema LM Bonificação (SOFTVENDAS) — motor de cálculo de bônus de vendas, sincronização Elleven, período/fechamento mensal e regras operacionais. Use SEMPRE que a tarefa tocar bonificação, comissão, faixas, meta, supervisor, importação de vendas, Elleven, chip móvel, fechamento de período, crons de sync, ou qualquer arquivo em lib/bonificacao*, lib/actions/*, lib/elleven*, app/(app)/*, app/api/cron/*. Carrega o mapa do código e as travas de negócio para não reaprender o sistema a cada sessão.
---

# LM Bonificação (SOFTVENDAS)

Sistema de RH/vendas do Grupo LM. Calcula o bônus mensal de cada vendedor a
partir das vendas, seguindo a **Ordem de Serviço (OS)** do cliente. Fonte de
verdade das vendas é o **Elleven** (sistema externo, importado via cron diário +
importação manual). Stack: Next.js 16 (App Router) + Prisma 7 + NextAuth 5 +
Postgres, deploy na Vercel.

> Antes de escrever código Next: este é o Next 16, com quebras vs. o que você
> conhece. `middleware.ts` **não existe** — a autenticação está em `proxy.ts` na
> raiz. Consulte `node_modules/next/dist/docs/` na dúvida. (Ver `AGENTS.md`.)

## O motor de cálculo — o coração do sistema

Duas camadas, propositalmente separadas:

- **`lib/bonificacao-calc.ts`** — cálculo **puro**, sem Prisma. É aqui que mora a
  regra. Testável isolado. **Mexeu na regra? Mexe aqui.**
- **`lib/bonificacao.ts`** — camada de dados: lê lançamentos do banco, agrega,
  chama o cálculo puro, grava `BonificacaoCalculada`.

Cada serviço tem um **tipo de regra** (campo `tipo` em `ServicoRegra`):

| tipo | Como paga | Usado em |
|---|---|---|
| `faixas` | valor da faixa atingida × **todas** as vendas do período (não-progressivo) | Internet (Vendas Externas) |
| `meta` | valor × qtd **se** qtd ≥ metaQtd; senão 0 | Chip |
| `porVenda` | valor × qtd desde a 1ª venda, sem meta | Demais serviços, internet ADM (R$20) |
| `percentualValor` | percentual × `valorDemaisServicos` | Regra dos 50% do ADM |

**Bônus de supervisor** (`calcularBonificacaoSupervisor`): só sobre internet, com
base no total de internet da **equipe inteira**; meta e largura das faixas
escalam com o tamanho da equipe. ⚠️ A fórmula foi **generalizada a partir de um
único exemplo da OS (equipe de 5)** — equipe com tamanho ≠ 5 precisa de
confirmação do cliente antes de produção. Não trate como fato consolidado.

Serviços: `internet, chip, gps, tv, streaming, telefoniaFixa, demaisServicos`.
Buckets de exibição: **internet**, **chip**, **demais** (todo o resto).
Defaults das regras: `lib/regras-defaults.ts` (`REGRAS_DEFAULT`).

**Validar o motor sem banco:**
```bash
npx tsx scripts/test-bonificacao.ts
```
Cobre os casos da OS §5. Rode isso depois de qualquer mudança em
`bonificacao-calc.ts` **antes** de dizer "feito".

## Travas de negócio (não quebrar)

1. **Elleven é fonte única** de vendedores/vendas. Importação manual e automação
   não podem duplicar. Existe **trava**: não permitir importação manual no mês em
   que a automação já é dona do período.
2. **Fuso é São Paulo, sempre** (`lib/periodo.ts`, `FUSO_BR`). Nunca use o relógio
   do servidor pra decidir "mês corrente" — Vercel roda em UTC e vira o mês cedo
   demais na virada. Período tem formato `"AAAA-MM"`.
3. **Fechamento mensal trava o período.** Período fechado não recebe novo
   lançamento nem recálculo silencioso. Ver `lib/actions/fechamento.ts`.
4. **RBAC:** `User.role` ∈ `ADMIN`, `DIRETORIA` (ver `lib/constants.ts` `ROLES`).
   Cargo do funcionário ≠ role de acesso (`CARGOS`).

## Mapa do código

- **Telas** — `app/(app)/`: `page.tsx` (dashboard), `lancamentos`, `importar`
  (`/elleven`, `/chip`), `fechamento/[periodo]`, `metas`, `regras`, `relatorios`,
  `cadastros/` (funcionarios, equipes, cidades, usuarios, telegram).
- **Server Actions** — `lib/actions/`: `cadastros, chip-movel, conta, elleven,`
  `fechamento, importar, lancamentos, regras, usuarios`. Toda escrita passa por aqui.
- **Integração Elleven** — `lib/elleven-api.ts`, `elleven-core.ts`,
  `importar-elleven-auto.ts`, `importar-elleven-funil.ts`, `vendedor-match.ts`
  (casamento de nome de vendedor → funcionário).
- **Chip móvel (L&M Móvel)** — `lib/chip-movel.ts`.
- **Crons** (`vercel.json` + `app/api/cron/`): sync-elleven (06:15 vendedores,
  06:30 funil, 06:45 pedidos), sync-chip (07:00), cobranca-metas (12:00).
  Observabilidade em `lib/cron-observability.ts`; health em `/api/health/crons`.
- **Modelos Prisma** (`prisma/schema.prisma`): `User, Cidade, Equipe, Funcionario,`
  `RegraBonificacao, LancamentoVenda, ImportLote, FechamentoMensal,`
  `BonificacaoCalculada, Ajuste, ContratoAtivacaoElleven, ElevenRelatorioLinha,`
  `VendaChipMovel`.

## Deploy e versão

- Deploy: push → Vercel builda (roda `prisma generate` no postinstall).
- **Todo PR que muda produção sobe a `version` do `package.json`** no mesmo
  commit (convenção do grupo): `patch` = bugfix/ajuste de tela, `minor` =
  funcionalidade/mudança de comportamento, `major` = quebra grande. Não deixe
  duas entregas com o mesmo número.

## Como trabalhar aqui

Vale o **Modo CEO** (skill `modo-ceo`): executo sozinho tudo que é reversível;
paro e levo decisão pronta quando é **regra de negócio que muda o bônus dos
vendedores**, algo com peso trabalhista/LGPD, dado real/produção, ou gasto.
Mudança em faixa/meta/percentual/OS = decisão do CEO, não minha.
