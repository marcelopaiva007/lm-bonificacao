# Visão da Empresa — Dashboard RH

## O que foi adicionado

Uma página inicial (dashboard) para cada empresa do RH que mostra:

1. **KPIs — Indicadores principais:**
   - Colaboradores ativos
   - Turnover 12 meses
   - Absenteísmo 30 dias
   - Custo de pessoal

2. **Preenchimento da Base — Pendências agrupadas:**
   - Sem Telegram vinculado
   - Sem salário na ficha
   - Sem data de admissão
   - Sem setor definido

Cada pendência é **expansível** — clique para ver a lista de colaboradores que precisam corrigir aquele campo específico.

---

## Como usar

1. Entre no RH e selecione uma empresa
2. Clique na aba **"Início"** (primeira aba da navegação)
3. Veja os KPIs e as pendências
4. Clique em uma pendência para expandir e ver quais colaboradores precisam corrigir

---

## Campos adicionados ao Colaborador

- **`salarioFicha`** (Float): Salário registrado na ficha do RH
- **`dataAdmissao`** (DateTime): Data de admissão do colaborador

Estes campos precisam ser preenchidos através da página de **Colaboradores** (edit de cada um) para que desapareçam das pendências.

---

## Arquivos criados/modificados

### Novos
- `lib/rh-pendencias.ts` — Query que busca as pendências
- `app/(app)/rh/[empresaId]/page.tsx` — Página inicial da empresa
- `app/(app)/rh/[empresaId]/pendencias-view.tsx` — Componente visual das pendências
- `prisma/migrations-manual/03-add-colaborador-fields.sql` — Migration do banco

### Modificados
- `app/(app)/rh/[empresaId]/rh-empresa-nav.tsx` — Adicionado link "Início"
- `prisma/schema.prisma` — Adicionados campos ao model Colaborador

---

## Próximas melhorias

- [ ] Cálculo real de Turnover e Absenteísmo
- [ ] Gráficos de tendência
- [ ] Filtros avançados por setor/posição
- [ ] Export de relatórios
