/**
 * Registro de versões do sistema — a fonte de verdade do "o que mudou", por
 * versão e data. A tela /novidades lê daqui; o CHANGELOG.md na raiz é o espelho
 * para quem olha o repositório.
 *
 * Convenção ao publicar uma mudança (ver também CLAUDE.md):
 *   1. suba o número em package.json seguindo SemVer
 *      (correção → patch 1.9.x; recurso → minor 1.x.0; quebra → major x.0.0);
 *   2. adicione UMA entrada no TOPO do array `CHANGELOG` abaixo, com a data no
 *      formato aaaa-mm-dd (fuso de Brasília) e o mesmo número do package.json;
 *   3. espelhe a entrada em CHANGELOG.md.
 *
 * O selo "v<número> · <data>" que aparece no login e no rodapé do menu usa o
 * número do package.json e a data do build (lib/versao.ts) — mantenha os dois
 * (package.json e o topo deste arquivo) com o mesmo número.
 */

export type TipoMudanca = "adicionado" | "corrigido" | "alterado" | "removido";

export type Mudanca = { tipo: TipoMudanca; texto: string };

export type Versao = {
  /** Ex.: "1.9.0" — igual ao package.json quando esta for a versão publicada. */
  numero: string;
  /** aaaa-mm-dd, no fuso de Brasília. */
  data: string;
  /** Resumo curto da versão, para o cabeçalho. */
  titulo: string;
  mudancas: Mudanca[];
};

/** Mais recente primeiro. */
export const CHANGELOG: Versao[] = [
  {
    numero: "1.18.0",
    data: "2026-08-29",
    titulo: "Funcionários e Regras no padrão premium",
    mudancas: [
      {
        tipo: "alterado",
        texto:
          "Funcionários ganhou o padrão premium de tabela: busca no topo, cabeçalho fixo, situação em selo colorido (verde/cinza), inicial do nome em avatar e contagem de registros no rodapé. A tela de Regras de Bonificação ganhou o cabeçalho padronizado e um aviso explicando que cada mudança cria uma nova vigência. Mesmas funções — cadastrar, editar, excluir e criar vigência continuam iguais.",
      },
    ],
  },
  {
    numero: "1.17.0",
    data: "2026-08-29",
    titulo: "Tela de Gestão repaginada no padrão premium",
    mudancas: [
      {
        tipo: "alterado",
        texto:
          "A tela de Gestão ganhou o mesmo acabamento do Painel: cabeçalho padronizado, tabelas em cartões de vidro com cabeçalho fixo e zebra, minigráfico (sparkline) de 6 meses colorido pela tendência de cada vendedor, e o Simulador de regra em destaque com borda de acento. Mesmos dados e cálculos — só o visual.",
      },
    ],
  },
  {
    numero: "1.16.0",
    data: "2026-08-29",
    titulo: "Tema claro (opcional) com botão para alternar",
    mudancas: [
      {
        tipo: "adicionado",
        texto:
          "Agora dá para escolher entre tema escuro (padrão, como sempre foi) e tema claro. O botão fica no rodapé do menu lateral (e no canto da tela de login), com sol/lua, e a escolha fica salva no seu navegador. Nada muda para quem quiser continuar no escuro.",
      },
    ],
  },
  {
    numero: "1.15.2",
    data: "2026-08-28",
    titulo: "Login: logo volta a aparecer",
    mudancas: [
      {
        tipo: "corrigido",
        texto:
          "O logo não aparecia na tela de login: o controle de acesso estava redirecionando as imagens do sistema (como o logo) para a própria tela de login quando o usuário ainda não tinha entrado. Agora os arquivos de imagem são liberados e o logo carrega normalmente na entrada.",
      },
      {
        tipo: "alterado",
        texto:
          "O painel de marca do login ficou escuro (navy) com um brilho sutil do gradiente, dando mais contraste ao logo e aos textos brancos.",
      },
    ],
  },
  {
    numero: "1.15.1",
    data: "2026-08-28",
    titulo: "Tela de login repaginada",
    mudancas: [
      {
        tipo: "alterado",
        texto:
          "A tela de entrada ganhou um visual em duas colunas: à esquerda, o painel de marca com gradiente azul→ciano e destaques do sistema; à direita, o formulário em cartão de vidro com campos de usuário e senha (com ícones) e botão com indicador de carregamento. No celular, aparece apenas o cartão centralizado. Nada muda na forma de entrar.",
      },
    ],
  },
  {
    numero: "1.15.0",
    data: "2026-08-28",
    titulo: "Painel repaginado: visual premium de SaaS de dados",
    mudancas: [
      {
        tipo: "alterado",
        texto:
          "O Painel foi redesenhado num padrão mais moderno e legível: cartões de indicador com ícone, variação colorida (verde/vermelho) e minigráfico de tendência; blocos de gráfico e tabelas sobre superfície de vidro, com cabeçalho de coluna fixo e ranking com destaque para o top 3.",
      },
      {
        tipo: "alterado",
        texto:
          "O menu lateral passou a agrupar os itens por seção (Visão geral, Cadastros, Operação, Análise, Sistema), com a página atual destacada por uma barra de acento em ciano.",
      },
      {
        tipo: "alterado",
        texto:
          "A identidade visual foi refinada (paleta em navy com camadas background → cartão → elevado, acento ciano e números em fonte monoespaçada alinhados), melhorando o contraste e a hierarquia no escuro em todas as telas.",
      },
    ],
  },
  {
    numero: "1.14.1",
    data: "2026-08-28",
    titulo: "Cores de situação voltam a aparecer (verde/vermelho)",
    mudancas: [
      {
        tipo: "corrigido",
        texto:
          "Em Gestão, Batimento, Pagamentos e no painel de gestão, as etiquetas de situação (verde para bom, âmbar para atenção, vermelho para crítico) não estavam recebendo cor — o estilo existia no código mas sem a definição da cor. Agora aparecem certas, e os números dessas telas ficaram alinhados (tabular).",
      },
    ],
  },
  {
    numero: "1.14.0",
    data: "2026-08-28",
    titulo: "Painel mais legível: destaque nos números e tabelas mais limpas",
    mudancas: [
      {
        tipo: "alterado",
        texto:
          "No Painel, Valor vendido e Bonificação total ganharam destaque (número maior e leve realce) para o olho pegar o essencial primeiro; os outros indicadores ficaram como apoio. Rótulos em caixa alta e números alinhados (tabular).",
      },
      {
        tipo: "alterado",
        texto:
          "Cabeçalhos de todas as tabelas do sistema ficaram mais discretos (caixa alta menor), separando melhor o título da coluna dos dados.",
      },
    ],
  },
  {
    numero: "1.13.0",
    data: "2026-08-28",
    titulo: "Navegação adaptada ao celular",
    mudancas: [
      {
        tipo: "adicionado",
        texto:
          "No celular, o menu lateral vira um botão (☰) no topo que abre a navegação deslizante e fecha sozinho ao escolher uma tela — antes o menu ocupava o espaço e espremia o conteúdo. No computador nada muda.",
      },
    ],
  },
  {
    numero: "1.12.0",
    data: "2026-08-24",
    titulo: "Tela de Diagnóstico de sincronização",
    mudancas: [
      {
        tipo: "adicionado",
        texto:
          "Nova tela Diagnóstico: mostra a última execução de cada automação (Elleven, Chip, Cobrança de Metas), o erro quando falha e — a partir da próxima rodada — um print da tela no momento em que o robô do Elleven é barrado no login (para ver se é 2FA, senha ou mudança na tela).",
      },
    ],
  },
  {
    numero: "1.11.0",
    data: "2026-08-22",
    titulo: "Validação de CPF/CNPJ no cadastro",
    mudancas: [
      {
        tipo: "adicionado",
        texto:
          "O cadastro de funcionário passa a validar o dígito verificador do CPF (barra fictícios como 123.456.789-10) e a aceitar CNPJ para vendedor pessoa jurídica (ex.: ME TELECOM).",
      },
      {
        tipo: "corrigido",
        texto:
          "Salvar funcionário de cargo Técnico, Responsável de Setor ou Vendedor Agregado voltou a funcionar — a validação da tela ainda tinha só 4 cargos e recusava esses em silêncio.",
      },
      {
        tipo: "alterado",
        texto:
          'Quando o CPF/CNPJ já está em outra ficha, o erro agora diz de quem é — ajuda a achar a duplicata em vez de só "já existe".',
      },
    ],
  },
  {
    numero: "1.10.1",
    data: "2026-08-22",
    titulo: "Duplicados: CPF diferente separa os xarás",
    mudancas: [
      {
        tipo: "corrigido",
        texto:
          'Na tela de Duplicados, duas fichas com CPF diferente deixam de ser sugeridas como a mesma pessoa — e um nome genérico (ex.: "JOSÉ DA SILVA") não junta mais xarás de CPFs distintos no mesmo grupo.',
      },
    ],
  },
  {
    numero: "1.10.0",
    data: "2026-08-21",
    titulo: "Detecção de vendedores duplicados mais esperta",
    mudancas: [
      {
        tipo: "adicionado",
        texto:
          'A tela de Duplicados agora encontra fichas da mesma pessoa mesmo com erro de digitação (JEFERSON/JEFFERSON), abreviação (CLEBER DOUGLAS × SOUGLAS V.), nome parcial (Larissa Ferreira × Larissa Ferreira dos Santos), prefixo colado ("(SERASA)…") ou mesmo CPF — antes só pegava nome exatamente igual.',
      },
      {
        tipo: "adicionado",
        texto:
          "Cada grupo mostra o motivo da suspeita (mesmo CPF, nome idêntico, um nome contém o outro, grafia parecida). A unificação continua sendo confirmada uma a uma, à mão.",
      },
    ],
  },
  {
    numero: "1.9.1",
    data: "2026-08-21",
    titulo: "Rótulos de cargo, mensagem de metas e cabeçalhos de segurança",
    mudancas: [
      {
        tipo: "corrigido",
        texto:
          'Cargos Técnico, Responsável de Setor e Vendedor Agregado voltaram a aparecer com o nome certo no painel, nas metas e nos cadastros (antes vinham com o código cru, ex.: "TECNICO").',
      },
      {
        tipo: "corrigido",
        texto:
          'Metas: quem ainda não tem venda com bonificação deixa de receber "Parabéns, você já desbloqueou as metas" — agora vê uma mensagem coerente.',
      },
      {
        tipo: "adicionado",
        texto:
          "Cabeçalhos de segurança em todas as respostas (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy e HSTS com includeSubDomains).",
      },
    ],
  },
  {
    numero: "1.9.0",
    data: "2026-08-21",
    titulo: "Registro de versões e telas restauradas",
    mudancas: [
      {
        tipo: "adicionado",
        texto:
          "Registro de versões: esta tela de Novidades, o arquivo CHANGELOG e o selo de versão (v… · data) de volta na tela de entrada e no rodapé do menu.",
      },
      {
        tipo: "adicionado",
        texto:
          "Telas restauradas: Gestão, Pagamentos, Registro de Alterações, Batimento e Duplicados. O menu foi religado e Metas voltou para a lista.",
      },
      {
        tipo: "alterado",
        texto:
          "A reestruturação de 15/08 (que reorganizou a importação do Elleven e havia removido as telas acima) foi mantida no que corrigiu; as telas que ela tirou do ar foram trazidas de volta por cima da versão atual, sem mexer no banco.",
      },
      {
        tipo: "corrigido",
        texto:
          "Número de versão realinhado à linhagem 1.8.x — o build de 15/08 havia zerado o número para 0.2.1 por engano.",
      },
    ],
  },
  {
    numero: "1.8.2",
    data: "2026-08-08",
    titulo: "Última versão antes da reestruturação",
    mudancas: [
      {
        tipo: "alterado",
        texto:
          "Ajustes na coleta automática do Elleven — as coletas que vinham falhando saíram da agenda diária para não atrapalhar as que funcionam.",
      },
    ],
  },
];
