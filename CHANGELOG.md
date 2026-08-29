# Registro de versões

Todas as mudanças relevantes do sistema, por versão e data (fuso de Brasília).
Segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[SemVer](https://semver.org/lang/pt-BR/).

> **Fonte de verdade:** `lib/changelog.ts` (é o que a tela **/novidades** mostra).
> Ao publicar uma versão, atualize os dois — e o número em `package.json`.
> Correção → _patch_ (1.9.x) · recurso → _minor_ (1.x.0) · quebra → _major_ (x.0.0).

## [1.19.1] — 2026-08-29

### Alterado
- **Números em Geist Mono:** a utility `num` passa a aplicar `font-family` Geist
  Mono + `letter-spacing: -0.01em` (além de `tabular-nums`), igual ao design de
  referência do Lovable — a fonte de texto (Geist) permanece a mesma.

## [1.19.0] — 2026-08-29

### Alterado
- **Cadastros (Cidades, Equipes, Usuários) no padrão premium:** cartão de vidro
  com cabeçalho fixo e zebra (`DataTable`), toolbar com contagem de registros e
  botão de novo, e `PageHeader` padronizado. Mesmo CRUD (criar/editar/excluir)
  do Funcionários. Reusa os componentes do design system.

## [1.18.0] — 2026-08-29

### Alterado
- **Funcionários (padrão premium de tabela):** busca no topo, cartão de vidro com
  cabeçalho fixo e zebra (`DataTable`), avatar com inicial do nome, situação em
  selo colorido (`StatusBadge`) e contagem de registros no rodapé. `PageHeader`
  padronizado. Cadastrar/editar/excluir/ativar continuam idênticos.
- **Regras de Bonificação:** `PageHeader` padronizado e um aviso (banner de
  acento) explicando que cada mudança cria uma nova vigência sem sobrescrever o
  histórico. Nenhuma mudança na lógica do formulário/vigências.
- Estabelece os dois padrões-referência (tabela e formulário) portados do design
  premium para o restante das telas seguir.

## [1.17.0] — 2026-08-29

### Alterado
- **Tela de Gestão repaginada (padrão premium):** cabeçalho padronizado
  (`PageHeader`), tabelas em cartões de vidro com cabeçalho fixo e zebra
  (`DataTable`), sparkline de 6 meses colorido pela tendência de cada vendedor
  (`Sparkline`) e o Simulador de regra em destaque com borda de acento. Mesmos
  dados, cálculos e lógica do simulador — só o visual. Reusa os componentes do
  design system (v1.15.0) em vez de recriar tabelas.

## [1.16.0] — 2026-08-29

### Adicionado
- **Tema claro (opcional):** dá para escolher entre o tema **escuro** (padrão,
  como sempre foi) e um **tema claro**. O botão (sol/lua) fica no rodapé do menu
  lateral e no canto da tela de login; a escolha fica salva no navegador. O tema
  é gerido pelo `next-themes` (classe `dark` no `<html>`), com paleta clara real
  em `:root` e a navy em `.dark`. O painel de marca do login permanece escuro nos
  dois temas (texto branco). Nada muda para quem ficar no escuro.

## [1.15.2] — 2026-08-28

### Corrigido
- **Login — logo volta a aparecer:** a causa raiz era o `matcher` do middleware
  de auth (`proxy.ts`), que não excluía os arquivos estáticos do `/public` —
  então, para o usuário deslogado, as imagens (ex.: `/lm-telecom-logo*.png`) eram
  redirecionadas para `/login` e não carregavam justamente na tela de login. O
  matcher passou a ignorar arquivos com extensão (png/svg/glb…).

### Alterado
- **Login — painel de marca escuro:** o painel da esquerda ficou navy com um
  brilho sutil do gradiente e halos, dando mais contraste ao logo e aos textos
  brancos.

## [1.15.1] — 2026-08-28

### Alterado
- **Tela de login repaginada:** layout em duas colunas — painel de marca à
  esquerda (gradiente azul→ciano, frase de valor e destaques do sistema) e
  formulário em cartão de vidro à direita, com campos de usuário/senha com
  ícones e botão com indicador de carregamento. No mobile, apenas o cartão
  centralizado. Sem mudança no fluxo de autenticação (NextAuth).

## [1.15.0] — 2026-08-28

### Alterado
- **Painel repaginado (visual premium de SaaS de dados):** cartões de indicador
  com ícone, variação colorida (verde/vermelho) e minigráfico de tendência
  (sparkline); blocos de gráfico e tabelas sobre superfície de vidro
  (glassmorphism), cabeçalho de coluna fixo, zebrado sutil e ranking com destaque
  para o top 3. Componentes reutilizáveis novos: `KpiCard`, `ChartCard`,
  `DataTable`, `PageHeader`, `Sparkline`.
- **Menu lateral agrupado:** itens organizados por seção (Visão geral, Cadastros,
  Operação, Análise, Sistema), com a página atual marcada por uma barra de acento
  em ciano.
- **Identidade visual refinada:** paleta em navy com hierarquia de camadas
  (`background → card → elevated`), acento ciano e números em fonte monoespaçada
  com alinhamento tabular — melhor contraste e hierarquia no escuro em todas as
  telas. Novo token `--elevated` e utilities `surface` / `glow-accent` /
  `text-gradient-brand`.

## [1.14.1] — 2026-08-28

### Corrigido
- **Cores de situação voltam a aparecer:** em Gestão, Batimento, Pagamentos e no
  painel de gestão, as etiquetas de situação (verde = bom, âmbar = atenção,
  vermelho = crítico) não recebiam cor — o estilo existia
  (`text-ok`/`bg-ok`/`text-warn`/`text-bad`/`num`) mas sem token de cor definido.
  Foram criados os tokens semânticos (`--ok`, `--warn`, `--bad`) e a utility `num`
  (números tabulares). Sem mudança nos temas nem no acento.

## [1.14.0] — 2026-08-28

### Alterado
- **Painel — hierarquia dos indicadores:** _Valor vendido_ e _Bonificação total_
  ganharam destaque (número maior e leve realce de acento) para o essencial saltar
  primeiro; os demais indicadores ficaram como apoio. Rótulos em caixa alta e
  números com alinhamento tabular.
- **Tabelas (todo o sistema):** cabeçalhos mais discretos (caixa alta menor, tom
  suave), separando melhor o título da coluna dos dados.

## [1.13.0] — 2026-08-28

### Adicionado
- **Navegação adaptada ao celular:** o menu lateral vira um botão (☰) no topo
  que abre a navegação deslizante (drawer) e fecha sozinho ao escolher uma tela.
  Antes, no celular, o menu ocupava o espaço e espremia o conteúdo. No
  computador o layout continua igual.

## [1.12.0] — 2026-08-24

### Adicionado
- **Tela de Diagnóstico de sincronização:** última execução de cada automação
  (Elleven, Chip, Cobrança de Metas), o erro quando falha e — a partir da próxima
  rodada — um **print da tela** no momento em que o robô do Elleven é barrado no
  login (para ver se é 2FA, senha ou mudança na tela).

## [1.11.0] — 2026-08-22

### Adicionado
- Cadastro de funcionário **valida o dígito verificador do CPF** (barra fictícios
  como `123.456.789-10`) e passa a **aceitar CNPJ** para vendedor pessoa jurídica
  (ex.: ME TELECOM).

### Corrigido
- Salvar funcionário de cargo **Técnico**, **Responsável de Setor** ou **Vendedor
  Agregado** voltou a funcionar — a validação ainda tinha só 4 cargos e recusava
  esses em silêncio.

### Alterado
- Quando o CPF/CNPJ já está em outra ficha, o erro **diz de quem é** — ajuda a
  achar a duplicata em vez de só "já existe".

## [1.10.1] — 2026-08-22

### Corrigido
- **Duplicados:** duas fichas com **CPF diferente** deixam de ser sugeridas como
  a mesma pessoa, e um nome genérico (ex.: `JOSÉ DA SILVA`) não junta mais xarás
  de CPFs distintos no mesmo grupo.

## [1.10.0] — 2026-08-21

### Adicionado
- **Detecção de duplicados mais esperta:** a tela de Duplicados encontra fichas
  da mesma pessoa mesmo com erro de digitação (JEFERSON/JEFFERSON), abreviação
  (CLEBER DOUGLAS × SOUGLAS V.), nome parcial (Larissa Ferreira × Larissa
  Ferreira dos Santos), prefixo colado (`(SERASA)…`) ou mesmo CPF — antes só
  pegava nome exatamente igual. Cada grupo mostra o motivo; a unificação continua
  confirmada à mão, uma a uma.

## [1.9.1] — 2026-08-21

### Adicionado
- Cabeçalhos de segurança em todas as respostas: CSP, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS com
  `includeSubDomains`.

### Corrigido
- Cargos **Técnico**, **Responsável de Setor** e **Vendedor Agregado** voltaram a
  aparecer com o nome certo no painel, nas metas e nos cadastros (antes vinham
  com o código cru, ex.: `TECNICO`).
- **Metas:** quem ainda não tem venda com bonificação deixa de receber
  "Parabéns, você já desbloqueou as metas" — agora vê uma mensagem coerente.

## [1.9.0] — 2026-08-21

### Adicionado
- **Registro de versões:** a tela **Novidades**, este CHANGELOG e o selo de
  versão (`v… · data`) de volta na tela de entrada e no rodapé do menu.
- **Telas restauradas:** Gestão, Pagamentos, Registro de Alterações, Batimento e
  Duplicados. Menu religado e **Metas** de volta à lista.

### Alterado
- A reestruturação de 15/08 (que reorganizou a importação do Elleven e havia
  removido as telas acima) foi mantida no que corrigiu; as telas que ela tirou
  do ar voltaram por cima da versão atual, sem mexer no banco de dados.

### Corrigido
- Número de versão realinhado à linhagem 1.8.x — o build de 15/08 havia zerado
  o número para `0.2.1` por engano.

## [1.8.2] — 2026-08-08

### Alterado
- Ajustes na coleta automática do Elleven — as coletas que vinham falhando
  saíram da agenda diária para não atrapalhar as que funcionam.
