# Análise do Sistema de Vendas / Bonificação — LM

**Data**: 18/08/2026 · **Escopo**: repositório `lm-bonificacao` completo (~11.850 linhas de TS/TSX)
**Base**: leitura integral de `app/`, `lib/`, `prisma/`, `components/`, configuração de deploy e crons.

**Verificações executadas nesta análise**

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ limpo |
| `eslint` | ✅ limpo |
| `tsx scripts/test-bonificacao.ts` | ✅ 13/13 casos passam |
| `npm audit --production` | ❌ 19 vulnerabilidades (2 críticas, 13 altas) |
| Sondagem da categorização de produtos | ❌ falha confirmada (ver C1/C2) |

O build está saudável. Os problemas abaixo são de **lógica de negócio, integridade de dados e segurança** — nenhum deles é pego por compilador ou lint.

---

## Sumário executivo

O sistema tem uma base sólida: motor de cálculo puro e testável, fuso horário tratado com cuidado, fonte única de categorização compartilhada entre cron e UI, autorização consistente entre servidor e interface. Os comentários de código explicam o *porquê* das decisões — bem acima da média.

O risco não está na arquitetura, está em três frentes:

1. **O dinheiro pode estar sendo calculado errado hoje** — um bug de classificação de produto (C1) paga planos de internet como streaming, e o efeito é multiplicado porque a internet é o único serviço com faixa progressiva.
2. **A integridade do mês fechado não é garantida** — quatro caminhos distintos alteram ou desalinham um fechamento já pago (C3–C6).
3. **Não existe trilha de auditoria** — num sistema que define remuneração variável, ninguém consegue responder "quem mudou isso, quando e por quê".

Contagem: **8 achados críticos, 13 altos, 12 médios**, mais itens de qualidade.

---

## 🔴 CRÍTICO

### C1. Planos de internet com "MAX" no nome são pagos como streaming

`lib/elleven-core.ts` — em `PRODUTO_KEYWORDS` e `PRODUTO_KEYWORDS_FUNIL`, a regra de streaming contém `max\b` e é testada **antes** da regra de internet. Confirmado por execução:

```
FIBRA MAX 300MB       → qtdStreaming   (esperado: qtdInternet)
PLANO MAX 600MB       → qtdStreaming   (esperado: qtdInternet)
INTERNET 500MB MAX    → qtdStreaming   (esperado: qtdInternet)
```

O impacto é composto, não linear:

- a venda paga **R$5 fixos** (`porVenda`) em vez de entrar na faixa de internet (**R$10–20/venda**);
- **não conta para o limiar de faixa** do vendedor (20/30/40). Como a faixa é aplicada a *todas* as vendas do período, perder 2 vendas pode derrubar as outras 28 de R$15 para R$10 — ou, abaixo de 20, para **zero**;
- **não conta na meta da equipe** do supervisor (`metaPorPessoa × tamanho`), podendo zerar o bônus do time inteiro;
- o valor entra em `valorDemaisServicos`, **inflando os 50%** do Atendimento/ADM.

**Correção**: ancorar o termo (`hbo ?max` em vez de `max\b`) ou testar internet antes de streaming. Antes de corrigir, levantar a lista real de nomes de plano do Elleven e transformá-la em fixture de teste — a regra atual foi escrita contra amostra, não contra o catálogo.

**Ação recomendada**: rodar o recálculo dos meses ainda ABERTOS após a correção e conferir manualmente os meses já fechados que contenham esses produtos.

---

### C2. As duas tabelas de categorização divergem entre si

`PRODUTO_KEYWORDS` (Ativação Contratos) e `PRODUTO_KEYWORDS_FUNIL` (Funil de Vendas) têm ordens diferentes. Confirmado:

| Serviço | Ativação | Funil |
|---|---|---|
| `TV BOX + NETFLIX` | qtdTv | qtdStreaming |
| `CANAIS HBO MAX` | qtdTv | qtdStreaming |
| `IP FIXO` | Outros (sem bônus) | qtdInternet |

O comentário no arquivo diz que duplicar essa lógica "poderia pagar bônus divergente entre os dois caminhos" — é exatamente o que está acontecendo, porque as duas listas foram mantidas separadas. **A mesma venda vale valores diferentes conforme a fonte que a trouxe.**

**Correção**: uma tabela só, com a coluna de origem como parâmetro apenas onde a nomenclatura realmente difere, e um teste que compare as duas saídas para todo o catálogo.

---

### C3. A importação do Funil não respeita mês FECHADO

`lib/importar-elleven-funil.ts` apaga e regrava todos os `LancamentoVenda` de origem `ELLEVEN_AUTO` do período **sem consultar `FechamentoMensal.status`**. Em seguida chama `recalcularFechamento`, que sai cedo quando o mês está FECHADO.

Resultado: os lançamentos brutos mudam, os totais congelados não. **A memória de cálculo do mês já pago deixa de ser reproduzível** — reabrir o mês para conferir passa a mostrar números diferentes dos que foram pagos.

`lib/chip-movel.ts` (`aplicarLancamentosChip`) faz a checagem correta e serve de modelo. O funil precisa da mesma guarda.

---

### C4. `updateLancamento` permite tirar um lançamento de um mês fechado

`lib/actions/lancamentos.ts` — `assertFechamentoAberto(parsed.data.periodo, tx)` valida **apenas o período vindo do formulário**, nunca o período atual do registro.

Enviando o `id` de um lançamento de um mês FECHADO junto com um `periodo` aberto, o registro é movido para fora do mês fechado. E como só o novo período é recalculado, o mês fechado fica com totais que já não correspondem aos seus lançamentos.

**Correção**: carregar o registro dentro da transação e exigir que **o período antigo e o novo** estejam abertos.

---

### C5. `fecharMes` sobrescreve a autoria do fechamento

```ts
await prisma.fechamentoMensal.update({
  where: { periodo },
  data: { status: "FECHADO", fechadoPorId: user.id, fechadoEm: new Date() },
});
```

Não há verificação de que o mês já está FECHADO. Chamar de novo troca `fechadoPorId` e `fechadoEm` para quem clicou por último. Como `fechadoPor` é hoje **o único dado de auditoria do sistema inteiro**, perdê-lo apaga o registro de quem autorizou o pagamento.

**Correção**: recusar quando já FECHADO; a reabertura deve ser um evento registrado, não um efeito colateral.

---

### C6. Linhas de bonificação órfãs sobrevivem ao recálculo

`lib/bonificacao.ts` — `recalcularFechamento` faz `upsert` por funcionário e **nunca apaga**. Duas situações geram inconsistência visível:

- `if (valorTotal === 0 && agregado.quantidade === 0) continue;` — quem perdeu todas as vendas (correção, exclusão de lançamento) mantém a `BonificacaoCalculada` antiga;
- `where: { ativo: true }` — funcionário desativado no meio do mês sai do loop, mantém a linha antiga, e **suas vendas somem do `valorTotalVendido`**.

A tela de fechamento e o Excel exportado listam essas linhas; o total do cabeçalho já foi recalculado sem elas. **Soma da tabela ≠ total exibido.**

**Correção**: `deleteMany` das bonificações do fechamento que não estejam no conjunto recalculado, dentro da mesma transação.

---

### C7. Sync sem piso de sanidade pode zerar um mês inteiro

Tanto `importarLancamentosEllevenFunil` quanto `syncChipMovel` fazem `deleteMany` seguido de `createMany`.

Se o Elleven devolver um CSV curto (sessão caiu no meio, filtro de data não aplicou, wizard mudou), ou se a API do L&M Móvel devolver `{"data": []}` com HTTP 200, **o período é apagado e substituído por menos dados — ou por nada — em silêncio**. Não há comparação com a rodada anterior, nem recusa quando a queda é anormal, nem cópia do estado anterior.

**Correção**: guardar a contagem da última rodada bem-sucedida e abortar (com alerta) quando a nova rodada trouxer, digamos, menos de 70% do volume anterior; exigir confirmação manual para aplicar mesmo assim.

---

### C8. 19 vulnerabilidades de dependência, 2 críticas

`npm audit --production`:

| Pacote | Severidade | Problema |
|---|---|---|
| `@auth/core` <0.41.3 | **crítica** | bypass de normalização por homoglifo (GHSA-7rqj-j65f-68wh) |
| `@auth/core` <0.41.3 | **alta** (CVSS 7.5) | `getToken()` lança exceção não tratada com header `Bearer` malformado — **DoS não autenticado** |
| `xlsx` (todas) | **alta** | prototype pollution + ReDoS — **sem correção no npm** |
| `undici`, `valibot`, `@hono/node-server` | moderada/alta | diversos |

O `xlsx` é usado para ler o arquivo que o administrador sobe em `/importar` — parse no navegador, mas a superfície existe. O pacote no registro npm está abandonado; a via de correção é migrar para a distribuição oficial da SheetJS (CDN) ou trocar por `exceljs`.

`npm audit fix` resolve `@auth/core` e os demais. **Priorizar o `@auth/core`**: o DoS não exige autenticação.

---

## 🟠 ALTO

### A1. Sessão JWT sem expiração configurada e sem revogação

`auth.config.ts` usa `strategy: "jwt"` sem `maxAge` (padrão: 30 dias). Papel e identidade vivem dentro do token.

Consequência: **excluir um usuário, rebaixar seu papel de ADMIN para DIRETORIA ou trocar a senha não invalida nada**. O acesso anterior sobrevive até o token expirar.

**Correção**: `maxAge` curto (8–12h), e revalidar `role`/existência do usuário contra o banco no callback `jwt` a cada renovação.

### A2. Login sem limite de tentativas

`auth.ts` — fator único, senha mínima de 8 caracteres, sem rate limit, sem bloqueio progressivo, sem CAPTCHA. Endpoint público exposto a força bruta. (O `authorize` retorna `null` uniformemente, o que evita enumeração de usuários — isso está certo.)

### A3. Zero trilha de auditoria

Não existe tabela de auditoria. Nenhum registro de quem alterou um lançamento, criou um ajuste, reabriu um mês ou trocou a regra de bonificação. O único vestígio é `FechamentoMensal.fechadoPor` — que o C5 sobrescreve.

Para um sistema que determina remuneração variável, essa é a lacuna de controle mais séria depois do cálculo em si. O `ROADMAP.md` marca "Audit log table" como concluído; não está.

### A4. Segredo de cron trafega na query string

`?secret=…` em `sync-elleven`, `sync-chip`, `cobranca-metas` e `health/crons`. Query strings aparecem em logs de acesso da Vercel, em cabeçalhos `Referer` e em histórico de navegador. **Aceitar apenas via header** (`x-sync-secret` já é suportado).

### A5. `sync-elleven` devolve screenshot da sessão autenticada a cada rodada

`screenshotBase64` de página inteira + `wizardSteps` com screenshots de botões + log completo, em toda resposta. São megabytes por chamada e **dados de clientes do ISP** trafegando para quem detiver o secret.

**Correção**: só sob `?debug=1`, ou apenas quando `ok === false`.

### A6. O watchdog devolve 200 e não registra a falha

No timeout de 260s, o watchdog resolve com `{ ok: false }` e **status HTTP 200**, sem chamar `recordCronRun`. Efeitos:

- monitor externo de uptime vê **sucesso**;
- o health check não acusa erro — só ficará "atrasado" 26h depois;
- o alerta de Telegram (que só dispara em `ok: false` gravado) **não sai**;
- `runWizard` continua executando após a resposta, com o `browser.close()` do `finally` possivelmente nunca alcançado.

### A7. `solicitacoes-andamento` está fora do health check

Está agendado em `vercel.json` mas ausente de `CRON_JOBS` em `lib/cron-observability.ts`. Se parar de rodar, **ninguém é avisado** — o job simplesmente não aparece no relatório de saúde.

### A8. Falha da importação automática não derruba o cron

Em `sync-elleven/route.ts`, o `catch` em volta de `importarLancamentosEllevenFunil` apenas registra no log local. O `recordCronRun` seguinte grava `ok: true`.

Cenário real: o CSV é baixado e salvo, a geração de lançamentos falha, **e o health check informa que está tudo bem**. Ninguém recebe bônus daquele dia e o sistema não sinaliza.

### A9. Vendedores não mapeados desaparecem em silêncio

No chip, `naoMapeados` vai apenas para o log da resposta HTTP. No funil, o não-casado vira funcionário novo automaticamente. Em nenhum dos casos há notificação. **A pessoa simplesmente não recebe**, e a descoberta depende de alguém reclamar.

### A10. Match difuso por tokens decide pagamento

`tokensContidosEmOrdem` exige apenas 2 tokens em ordem. "Ana Paula" casa igualmente com "Ana Paula Ribeiro" e "Ana Paula Souza" — fica o de maior score, e em empate o primeiro encontrado. **Homônimos de dois nomes são atribuídos ao vendedor errado.** O Funil de Vendas não traz CPF, então não há critério de desempate.

**Correção**: quando o match for difuso e ambíguo (mais de um candidato com o mesmo score), não aplicar — mandar para uma fila de confirmação humana.

### A11. Duplo cadastro por variação de nome

O funil cria funcionário automaticamente quando não casa. "João M. Fernandes" numa rodada e "João Marcelo Fernandes" na seguinte geram **dois cadastros**, com as vendas partidas entre eles — e possivelmente **nenhuma das metades atingindo o limiar de 20** da faixa de internet.

`Funcionario.nome` não tem restrição de unicidade e `cpf` é opcional. A tela de sincronização de vendedores existe para reconciliar isso, mas roda depois do estrago.

### A12. Importação manual pode duplicar vendas

A trava de `confirmarImportacao` só barra quando existe `ELLEVEN_AUTO` no período. **Subir a mesma planilha duas vezes num mês sem automação cria dois conjuntos de lançamentos e dobra o bônus de todo mundo.**

Faltam: verificação de `IMPORTADO` já existente no período, hash do arquivo, e a possibilidade de desfazer um lote (`ImportLote` existe, mas não há rollback).

### A13. Possível dupla contagem de chip (verificar com a operação)

`CHIP_MOVEL` grava `qtdChip` a partir do L&M Móvel; `categoriaProdutoFunil` também classifica `qtdChip` a partir do Elleven. Como `somaLancamentos` soma todas as origens do mesmo funcionário/período, **um chip presente nas duas fontes é contado duas vezes** — e a meta de 15 chips é atingida com metade das vendas.

Não foi possível confirmar sem os dados reais. É a primeira coisa a checar em produção: comparar `qtdChip` por origem no mês corrente.

---

## 🟡 MÉDIO

### M1. Valores monetários em `Float`

Todos os campos de dinheiro (`valorInstalado`, `valorTotal`, `valor` de ajuste…) são `Float` — ponto flutuante binário. Erros de arredondamento acumulam em somas de centavos e em percentuais (a regra dos 50%). Migrar para `Decimal`.

### M2. Sem validação de valores negativos

`lancamentoSchema` aceita `qtdInternet: -50`. Confirmado por execução: gera bônus de **−R$1.000**; `percentualValor` sobre valor negativo devolve −R$500. Faltam `.min(0)` e limites superiores plausíveis em quantidades e valores.

### M3. Regras de bonificação sem validação nem edição

`createRegraBonificacao` aceita:

- faixas **sobrepostas** ou com **lacunas** (uma lacuna acidental entre 29 e 31 zera silenciosamente quem vendeu 30);
- `percentual` fora de [0, 1];
- vigência **retroativa**, que muda o cálculo de meses passados no próximo recálculo.

Além disso: não existe editar nem excluir regra, e criar uma regra com início **anterior** a outra já existente executa `updateMany` sobre tudo que tem `vigenciaFim: null` — fechando a vigência errada e produzindo intervalos inconsistentes.

### M4. TOCTOU nas travas de fechamento

`confirmarImportacao`, `createAjuste` e `deleteAjuste` consultam o status **fora** da transação que escreve. `recalcularFechamento` também não trava a linha do fechamento — dois recálculos concorrentes (cron + botão "Recalcular") se sobrepõem. Usar `SELECT … FOR UPDATE` ou advisory lock.

### M5. Sem execução exclusiva do cron

Nada impede duas rodadas simultâneas de `sync-elleven` (agendada + disparo manual), cada uma subindo um Chromium e escrevendo o mesmo período. Um advisory lock do Postgres por job resolve.

### M6. `ImportLote` fica semi-preenchido

`linhasErro` sempre 0; `mapeamentoJson` e `detalhesErrosJson` existem no schema e **nunca são gravados**. O parse do arquivo é 100% no cliente — o servidor recebe números já prontos, não guarda o arquivo nem um hash. **Não é possível reconstituir o que foi importado.**

### M7. `sincronizarVendedoresElleven` sem transação

Loop com `create`/`update` um a um (N+1 de rede). Falha no meio deixa metade aplicada, sem como saber onde parou. Renomeia o cadastro para o nome do Elleven **sem checar colisão** com outro funcionário existente.

### M8. Carregamento integral em memória

- `previsualizarLancamentosElleven` e `previsualizarVendedoresElleven`: `findMany()` **sem filtro** sobre a tabela de contratos inteira;
- dashboard e relatórios: todos os lançamentos e bonificações do período carregados e agregados em JS;
- ranking sem paginação.

Funciona no volume atual (um ISP), degrada linearmente. `LancamentoVenda` também não tem índice em `origem`, embora todo `deleteMany` filtre por `periodo + origem`.

### M9. `getRegraVigente` avalia a vigência pelo **fim** do período

A consulta usa `vigenciaInicio <= fim` e `vigenciaFim >= fim`. Consequências:

- regra que passa a valer no **dia 20** é aplicada ao mês inteiro, inclusive às vendas do dia 1º;
- regra que **encerrou no dia 15** é ignorada por completo, mesmo tendo valido metade do mês.

Se isso é intencional ("a regra vigente no fechamento vale para o mês"), precisa estar escrito como decisão de negócio — hoje parece efeito colateral.

### M10. Bônus de supervisor extrapolado de um único exemplo

O próprio código avisa: *"A fórmula foi generalizada a partir do único exemplo da OS (equipe de 5). Equipes com tamanho ≠ 5 precisam de confirmação do cliente antes de produção."* — e está em produção. Além disso, um supervisor com **duas equipes recebe a soma dos dois bônus**, comportamento que não aparece na OS.

### M11. `fetchVendedores` degrada em silêncio

`if (!res.ok) break;` devolve mapa vazio ou parcial: **o CPF some do casamento** e tudo cai para o match por nome, sem qualquer aviso. `MAX_PAGES × PAGE_LIMIT` também trunca em 10.000 vendas sem sinalizar.

### M12. Uma categoria por venda, e desconhecido conta como "demais"

Cada linha do funil incrementa uma única categoria — um combo (internet + TV) conta como um produto só. E quando `categoriaProdutoFunil` devolve `null` (produto fora do catálogo), o valor **ainda entra em `valorDemaisServicos`**: produto não reconhecido vira base dos 50% do Atendimento/ADM.

---

## ⚪ Qualidade e documentação

- **`ROADMAP.md` está incorreto e induz a erro.** Marca como concluído (`[x]`) o que não existe no código: testes de importação, de fechamento e de regressão; audit log; rate limiting; paginação de ranking; backups diários; SLA; oncall. Também cita papéis (`RH_MANAGER`, `GESTOR_SETOR`) e crons ("Ativação Contratos") já removidos. Um roadmap que descreve errado o estado atual é pior que nenhum — corrigir os `[x]` deve ser tarefa da mesma semana.
- **`README.md` ainda é o template do `create-next-app`.** Nada sobre variáveis de ambiente obrigatórias (`DATABASE_URL`, `AUTH_SECRET`, `ELLEVEN_*`, `MOVEL_*`, `CRON_SECRET`, `TELEGRAM_*`, `COBRANCA_*`), nem sobre o fato de que **migrações não são aplicadas por `prisma migrate` em produção** (decisão documentada só no `schema.prisma`).
- **Um único script de teste** (`scripts/test-bonificacao.ts`, passa 13/13), sem runner, sem CI, sem cobertura de importação, fechamento, matching ou categorização — justamente onde estão os achados críticos.
- `ensureFuncionarioContato` e `ensureRelatorioTable` são **no-ops** mantidos por compatibilidade; código morto que sugere um comportamento que não existe mais.
- `/metas`, `/cadastros/telegram` e `/importar/chip` **não estão em nenhum menu** — acessíveis apenas por URL direta.
- `searchParams.periodo` não é validado nas páginas de dashboard e relatórios (`periodoAnterior("lixo")` produz `"NaN-NaN"`).
- `JSON.parse(localStorage.getItem(...))` sem validação no mapeamento de importação — item corrompido quebra a tela.
- bcrypt com custo 10; 12 é o mínimo recomendado atualmente.
- `Funcionario` não tem `updatedAt`.
- `AGENTS.md` avisa que esta versão do Next tem breaking changes e manda ler `node_modules/next/dist/docs/`, mas o repositório não registra em lugar nenhum o que de fato mudou.

---

## ✅ O que está bem resolvido

Vale registrar, porque são decisões que sustentam as correções acima:

- **Motor de cálculo puro** (`lib/bonificacao-calc.ts`), sem dependência de banco, testável isoladamente — e com teste que passa.
- **Fuso de Brasília tratado explicitamente**, com a justificativa correta (servidor em UTC viraria o mês cedo na virada). Aplicado consistentemente em `periodo.ts` e no scraper.
- **Fonte única de categorização** entre cron e UI, com o motivo documentado — a intenção está certa, falta cumpri-la (C2).
- **Trava de importação manual** quando a automação é dona do mês.
- **Observabilidade de cron** com tabela `cron_run`, health check e alerta ativo por Telegram, blindado para nunca derrubar o job.
- **Cobrança de metas em dry-run por padrão**, com flag explícita para ativar — decisão prudente para um recurso que fala com pessoas.
- **Autorização consistente**: todas as server actions passam por `requireAdmin`/`requireUser`, e a UI esconde exatamente o que o servidor recusaria. Não há checagem só no cliente.
- **Comentários que explicam o porquê**, não o quê — incluindo as próprias limitações conhecidas.

---

## Prioridade sugerida

| # | Frente | Itens | Por quê primeiro |
|---|---|---|---|
| 1 | Categorização de produto | C1, C2 | Dinheiro errado saindo **hoje**, com efeito multiplicado pela faixa |
| 2 | Integridade do fechamento | C3, C4, C5, C6 | Mês pago pode ser alterado ou exibido inconsistente |
| 3 | Segurança | C8, A1, A2, A4 | DoS não autenticado + sessões irrevogáveis |
| 4 | Confiabilidade de sync | C7, A6, A7, A8, A9 | Falhas hoje são **silenciosas** — o pior modo de falhar |
| 5 | Auditoria e validação | A3, M1, M2, M3 | Base para conseguir auditar os itens acima |
| 6 | Testes e CI | fixtures de categorização, fechamento, matching | Impede a reincidência de C1–C6 |
| 7 | Documentação | ROADMAP, README | Corrigir os `[x]` falsos antes que virem decisão |

**Duas verificações imediatas em produção**, antes de qualquer código:

1. Existe algum produto com "MAX" no nome no catálogo do Elleven? Se sim, quantas vendas e em quais meses (C1).
2. Comparar `qtdChip` por origem (`CHIP_MOVEL` vs `ELLEVEN_AUTO`) no mês corrente para confirmar ou descartar a dupla contagem (A13).
