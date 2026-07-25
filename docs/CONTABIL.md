# Módulo Contábil

Sistema do analista contábil: resultado mensal (faturamento x despesas), impostos
com controle de pagamento e fechamento por competência — por empresa.

Substitui as duas planilhas que eram mantidas à mão: a de faturamento/despesas
por trimestre e a de impostos por mês/tributo.

## Onde fica

| Tela | Rota | O que faz |
|------|------|-----------|
| Painel | `/contabilidade` | Planilha do ano inteiro (12 meses + subtotal de cada trimestre + total), aba alternativa com os 4 blocos trimestrais, KPIs, gráfico, impostos por tributo, guias em aberto de todas as empresas e o download da planilha anual em .xlsx |
| Faturamento x Despesas | `/contabilidade/resultado` | Grade dos 12 meses; o lucro é calculado, nunca digitado |
| Impostos | `/contabilidade/impostos` | Matriz mês x tributo + tabela de guias (vencimento, baixa, nº do documento) |
| Fechamento | `/contabilidade/fechamento` | Trava a competência (faturamento, despesas e impostos daquele mês) |
| Cadastros | `/contabilidade/cadastros` | Empresas e tributos acompanhados |

Empresa e ano viajam na query string (`?empresa=<id>&ano=2026`) e são preservados
ao trocar de aba.

## Acesso

Papel novo: **`CONTABIL`** (rótulo "Analista Contábil"), criado em `/usuarios`.

| Papel | Vê | Edita |
|-------|----|-------|
| `ADMIN` | sim | sim (único que pode **reabrir** um mês fechado) |
| `CONTABIL` | sim (só este módulo — cai direto em `/contabilidade` ao entrar) | sim |
| `DIRETORIA` | sim | não |

## Modelo de dados (schema `contabil`)

- `empresa_contabil` — empresa, CNPJ, regime.
- `tipo_imposto` — os tributos acompanhados (viram as colunas da planilha).
- `competencia_contabil` — empresa + mês (`AAAA-MM`), faturamento, despesas, status.
- `imposto_apurado` — valor de um tributo na competência + a guia (vencimento,
  status, data/valor pago, documento).

Duas decisões que importam:

1. **O lucro não é coluna.** É sempre derivado (`faturamento - despesas`), então
   não existe a possibilidade de o valor salvo divergir das parcelas.
2. **Nenhuma FK sai do schema `contabil`.** Quem fechou a competência é gravado
   como referência leve (`fechadaPorId` + `fechadaPor`). O módulo já nasce pronto
   para virar banco próprio (Fase B do [MIGRACAO-BANCO.md](MIGRACAO-BANCO.md)).

## Como foi aplicado / como reaplicar

O projeto não roda `prisma migrate` contra produção. O DDL é manual:

```bash
npx tsx scripts/aplicar-sql.ts prisma/migrations-manual/03-contabil.sql
npx prisma generate
```

`03-contabil.sql` é só `CREATE` (idempotente) — não toca em nenhuma tabela
existente, então roda com os apps no ar.

Carga inicial (tributos, as 3 empresas e as planilhas da VAPT de jan–jun/2026):

```bash
npx tsx scripts/seed-contabil.ts
```

O seed é idempotente e imprime a conferência contra os totais da planilha
original ao final.

## Convenções de valor

- Os campos aceitam o formato que o analista digita (`1.234,56`, `1234.56`,
  `R$ 1.234,56`) — ver `parseValorBR` em `lib/contabil.ts`.
- Datas de vencimento/pagamento são gravadas em UTC "puro" (meia-noite) e
  formatadas em UTC, para o dia 1 não virar dia 31 do mês anterior.
- As exportações são `.xlsx` de verdade (biblioteca `xlsx`), geradas no navegador. A do painel traz duas abas: **Resultado** (com os subtotais de trimestre) e **Impostos** (matriz mês x tributo).

## Ponto em aberto

Se as despesas lançadas **já incluem** os impostos, o "lucro após impostos"
mostrado no painel subtrai duas vezes. Hoje o número principal em todo lugar
é o da planilha (`faturamento - despesas`); confirmar com o analista antes de
usar a coluna "lucro após impostos" para decisão.
