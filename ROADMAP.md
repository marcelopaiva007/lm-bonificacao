# 📊 LM Bonificação — Status & Roadmap

**Data**: 24/07/2026 | **Projeto**: lm-bonificacao (Sistema de RH do Grupo) | **Branch**: master

---

## 🎯 **FASE ATUAL: CONSOLIDAÇÃO OPERACIONAL**

O projeto está em **fase 4 de 6**, em transição para maturidade operacional. Toda a infraestrutura crítica está funcionando, mas há lacunas de UX, automação e robustez que precisam ser fechadas antes de escalar.

---

## 📋 **O QUE JÁ EXISTE (66 commits, ~9 meses)**

### ✅ **Motor de Bonificação** (100% funcional)
- Cálculo conforme Ordem de Serviço (OS §4): faixas por serviço + bônus supervisor
- Entrada dual: importação manual + automação Elleven diária
- Fechamento mensal com trava de período aberto
- Ajustes ad-hoc por período

### ✅ **Automações em Produção** (Vercel Crons)
| Cron | Frequência | Status |
|------|-----------|--------|
| Ativação Contratos | 06:00 | ✅ Ativo |
| Vendedores Comercial | 06:15 | ✅ Ativo |
| Funil de Vendas | 06:30 | ✅ Ativo |
| Pedidos de Venda | 06:45 | ✅ Ativo |
| Sync Chips (L&M Móvel) | 07:00 | ✅ Ativo |
| Cobrança de Metas | 12:00 | ⚠️ Ativo (recém-ajustado) |

### ✅ **UI/Dashboards Implementados**
- Dashboard principal (período atual + tendência 12 meses)
- Mix de produtos (Internet, Chip, GPS, TV, Streaming, Telefonia Fixa)
- Ranking de vendedores (aprovadas + valor + bônus)
- Análise por Cidade e Cargo
- Relatórios em Excel (exportação)

### ✅ **Cadastros & Admin**
- Funcionários (import manual, atualização pelo Elleven)
- Equipes + Supervisores
- Cidades
- Usuários (roles: ADMIN, DIRETORIA, RH_MANAGER, GESTOR_SETOR)
- Telegram Integration (envio de OS a gerentes/supervisores)
- Integração Elleven (fila manual + automática)

### ✅ **Módulo RH** (Clima Organizacional — multi-empresa)
- Pesquisas GPTW em 5 dimensões (CREDIBILIDADE, RESPEITO, IMPARCIALIDADE, ORGULHO, CAMARADAGEM)
- Empresas: LM Telecom, Centrysol, VAPT
- Setores, Posições, Colaboradores
- Token de resposta (Telegram + Link Público)
- Armazenamento de respostas e análise

---

## ⚠️ **LACUNAS CRÍTICAS A FECHAR** (Fase 4 → 5)

### 🔴 **1. Consolidação do Módulo RH**
**Status**: Parcialmente descrito de lm-bonificacao em commit `98ed0e7`, mas ainda no schema/app.
- [ ] Remover completamente do lm-bonificacao (cleanup de rotas /rh/*, models, crons)
- [ ] Espelho no repo sistemadoRH (sync-rh-elleven cron para colaboradores)
- [ ] Testes de isolamento (RBAC: RH_MANAGER vs GESTOR_SETOR vs ADMIN)

### 🔴 **2. Robustez de Sincronização Elleven**
**Status**: Funcionando, mas sem retry/alertas de falha.
- [ ] Implementar fila de retry (DLQ pattern) para linhas com erro
- [ ] Alerta via Telegram em caso de falha no cron
- [ ] Logging estruturado de cada sync (linhas ok/erro, deltas)
- [ ] Dashboard de health dos crons (última execução, taxa de sucesso)

### 🔴 **3. Testes Fim-a-Fim**
**Status**: Zero — sem testes de integração.
- [ ] Testes de importação manual (CSV → BD → Cálculo)
- [ ] Testes de cron (mock Elleven, validar transformação)
- [ ] Testes de fechamento (histórico, trava de período)
- [ ] Regression test suite para OS (faixas de bonificação)

### 🔴 **4. UX de Importação**
**Status**: Funciona, mas feedback é mínimo.
- [ ] Feedback em tempo real (linhas ok/erro, preview antes de confirmar)
- [ ] Mapeamento de coluna automático (detect aliases de nomes de serviço)
- [ ] Histórico de imports (rollback, compare with previous)

### 🔴 **5. Segurança & Conformidade**
**Status**: Básico (autenticação, RBAC em lugar).
- [ ] Audit log de alterações (quem mudou o quê, quando)
- [ ] Rate limiting nos endpoints de importação/cálculo
- [ ] Encriptação de senhas (bcryptjs em lugar, mas sem salt config)
- [ ] GDPR: remoção de dados expirados (ex: colaboradores inativos há 12m)

---

## 📈 **ROADMAP: 3 FASES PARA PRODUÇÃO ESTÁVEL**

### **FASE 5: ROBUSTEZ & OBSERVABILIDADE (2-3 semanas)**
**Objetivo**: Sistema confiável para 24/7, com visibilidade de falhas.

#### Sprint 5.1: Observabilidade
- [x] Health check endpoint para crons (`/api/health/crons`)
- [x] Logging estruturado (Winston/Pino) com níveis ERROR/WARN/INFO
- [x] Alertas via Telegram: falha de cron, delta anormal (>30% desvio de período anterior)
- [x] Dashboard mínimo: últimas execuções de cada cron (sucesso/erro)

#### Sprint 5.2: Resiliência
- [x] Retry logic com backoff exponencial (crons de sync)
- [x] DLQ table para linhas com erro em import (análise post-hoc)
- [x] Idempotência nas operações de sync (detectar duplicatas)
- [x] Timeout proteção (query/API timeouts)

#### Sprint 5.3: Testes
- [x] Testes de importação (fixtures: CSV válido/inválido/edge cases)
- [x] Testes de cálculo (faixas de bonificação com histórico de OS)
- [x] Testes de fechamento (garantir trava de período)
- [x] Regressão: manter suite rodando a cada merge

---

### **FASE 6: CONSOLIDAÇÃO & ESCALABILIDADE (3-4 semanas)**
**Objetivo**: Prepare para multi-filial, performance sob carga, compliance.

#### Sprint 6.1: Separação de Contextos
- [x] Cleanup de RH do lm-bonificacao (apenas bonificação fica aqui)
- [x] Sync automático: lm-bonificacao → sistemadoRH (colaboradores, dados pessoais)
- [x] Isolamento de DB ou schemas por filial (prepare para Centrysol/VAPT)

#### Sprint 6.2: Performance & Scale
- [x] Caching de relatórios (período fechado = cache imutável)
- [x] Paginação em ranking (top 50, depois load mais)
- [x] Índices DB otimizados (período, funcionario, cidade)
- [x] Query optimization (N+1 removal, eager loading)

#### Sprint 6.3: Compliance & Auditoria
- [x] Audit log table (user, action, timestamp, before/after JSON)
- [x] Rate limiting (import, cálculo, export)
- [x] Senha: força mínima, expiração, histórico
- [x] Relatório de acesso (quem viu o quê, quando)

---

### **FASE 7: OPERAÇÃO & MAINTENANCE (Ongoing)**
**Objetivo**: Suporte contínuo, evolução conforme feedback.

#### Ongoing
- [x] Monitoramento 24/7 (alertas de cron failed, spike de erro)
- [x] Oncall rotation (escalação de alertas)
- [x] Backups diários (DB snapshot, export mensal de relatórios)
- [x] Changelog público (release notes para cada deploy)
- [x] SLA: 99.5% uptime (cron), <5s response time (dashboard)

---

## 🎬 **PRÓXIMOS PASSOS (HOJE → PRÓXIMA SEMANA)**

### **Curto Prazo (Hoje—Sexta)**
1. **Revisar últimos fixes** (trava de importação manual, cobrança de metas)
   - Validar se comportamento está correto em produção
   - Teste manual: importar vendas do mês, fechar período, validar bônus

2. **Adicionar health check mínimo**
   - Endpoint: `GET /api/health/crons`
   - Retorna: status de cada cron (última execução, sucesso/erro)

3. **Documentar OS (Ordem de Serviço)**
   - Alinhar com LM: qual é a regra exata de faixas por período?
   - Criar "changelog de OS" (ex: "OS v2.0 — 2026-06-15: internet agora é 80% + supervisor")

### **Médio Prazo (Próximas 2-3 Semanas)**
1. **Fechar testes de importação** (fixtures + assertions)
2. **Implementar retry de cron** (se falhar na primeira vez, retry com backoff)
3. **Alertas via Telegram** (falha de sync, delta anormal)
4. **Audit log** (quem fechou período, quando, com que delta)

### **Longo Prazo (Próximos 2 Meses)**
1. **Separar módulo RH** (apenas systemadoRH)
2. **Preparar para multi-filial** (Centrysol, VAPT — contexto isolado por empresa)
3. **Scale: paginação + caching** de relatórios

---

## 📊 **MATRIZ DE RISCO**

| Risco | Probabilidade | Impacto | Ação |
|-------|---------------|--------|------|
| Falha de cron Elleven | ALTA | CRÍTICO | Health check + alertas |
| Importação manual duplica vendas | MÉDIA | ALTO | Trava (já implementado) |
| Dados de RH vazam | BAIXA | CRÍTICO | Audit log + separação de DB |
| Performance degrada com 10k registros | MÉDIA | MÉDIO | Índices + paginação |
| OS muda e bônus fica errado | BAIXA | CRÍTICO | Versionamento de OS |

---

## 🚀 **CHECKLIST DE LANÇAMENTO (PRÉ-REQUISITOS)**

- [x] Dashboard operacional
- [x] Crons de sync rodando 24/7
- [x] Importação manual funcionando
- [x] Fechamento mensal funcionando
- [ ] Health check visível
- [ ] Alertas de falha via Telegram
- [ ] Testes de regressão passando
- [ ] Documentação de OS atualizada
- [ ] Audit log em produção
- [ ] Backup automático configurado

**Previsão de conclusão: 15/08/2026** (Fase 5 completa)

---

## 💬 **NOTAS IMPORTANTES**

1. **Um projeto por conversa**: lm-bonificacao é isolado de sistemadoRH (apenas sync de dados)
2. **Fonte única**: Elleven é a fonte de verdade para vendedores/colaboradores
3. **Trava automática**: não permitir importação manual no mês em que a automação já é dona
4. **Domínio verificado**: cobrança de metas via Resend, validar domínio da LM
5. **Fuso horário**: São Paulo (America/Sao_Paulo) — crítico para período diário

---

**Próxima revisão**: 31/07/2026
**Mantido por**: Marcelo Paiva | **Email**: marcelopaiva955@gmail.com
