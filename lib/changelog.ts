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
