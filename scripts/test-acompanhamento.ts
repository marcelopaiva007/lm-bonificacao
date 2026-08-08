/**
 * Teste standalone da mensagem de acompanhamento de metas.
 * Rode com: npx tsx scripts/test-acompanhamento.ts
 *
 * Usa apenas funções puras (lib/acompanhamento.ts) — não toca no banco.
 *
 * O caso que originou estes testes: quem NÃO vendeu nada recebia, por Telegram
 * e e-mail, "Parabéns! Você já desbloqueou as metas com bonificação neste mês".
 * Acontecia sempre que a lista de pendências saía vazia — e ela sai vazia tanto
 * para quem bateu tudo quanto para quem não tem regra de meta no cargo.
 */
import {
  montarMensagem,
  type AcompanhamentoSupervisor,
  type MetaServico,
} from "../lib/acompanhamento";

let falhas = 0;

function contem(nome: string, texto: string, trecho: string) {
  const ok = texto.includes(trecho);
  if (!ok) falhas++;
  console.log(`${ok ? "✅" : "❌"} ${nome}\n   esperava conter: "${trecho}"\n   obtido: "${texto}"`);
}

function naoContem(nome: string, texto: string, trecho: string) {
  const ok = !texto.includes(trecho);
  if (!ok) falhas++;
  console.log(`${ok ? "✅" : "❌"} ${nome}\n   NÃO podia conter: "${trecho}"\n   obtido: "${texto}"`);
}

const metaEmAberto: MetaServico = {
  servico: "internet",
  label: "Internet",
  qtdAtual: 0,
  valorPorVendaAtual: 0,
  proximaMeta: 20,
  faltam: 20,
  valorPorVendaProxima: 10,
};

const metaBatida: MetaServico = {
  servico: "internet",
  label: "Internet",
  qtdAtual: 25,
  valorPorVendaAtual: 10,
  proximaMeta: null,
  faltam: null,
  valorPorVendaProxima: null,
};

const supervisorAbaixo: AcompanhamentoSupervisor = {
  metaEquipe: 100,
  internetEquipe: 40,
  faltam: 60,
  atingiu: false,
  valorAtual: 0,
};

// 1. OUTRO_SETOR (regras vazias) sem venda — era aqui que nascia o parabéns falso.
const semRegraSemVenda = montarMensagem("Ana Paula", [], null, {
  totalVendas: 0,
  bonificacaoAtual: 0,
  temRegra: false,
});
naoContem("sem regra + sem venda não parabeniza", semRegraSemVenda, "Parabéns");
naoContem("sem regra + sem venda não fala em desbloqueio", semRegraSemVenda, "desbloqueou");
contem("sem regra + sem venda avisa a ausência de venda", semRegraSemVenda, "ainda não tem venda registrada");

// 2. Atendimento/ADM (paga por venda, sem meta) sem venda — o outro caminho
//    que produzia o parabéns falso: lista de metas vazia por ausência de limiar.
const admSemVenda = montarMensagem("Bruno", [], null, {
  totalVendas: 0,
  bonificacaoAtual: 0,
  temRegra: true,
});
naoContem("ADM sem venda não parabeniza", admSemVenda, "Parabéns");
contem("ADM sem venda avisa a ausência de venda", admSemVenda, "ainda não tem venda registrada");

// 3. Meta em aberto e nenhuma venda: cobra, mas sem parabenizar.
const comMetaSemVenda = montarMensagem("Carla", [metaEmAberto], null, {
  totalVendas: 0,
  bonificacaoAtual: 0,
  temRegra: true,
});
naoContem("meta em aberto + sem venda não parabeniza", comMetaSemVenda, "Parabéns");
contem("meta em aberto + sem venda diz quanto falta", comMetaSemVenda, "Faltam 20");

// 4. Vendeu e bateu a meta: o parabéns continua existindo.
const bateuMeta = montarMensagem("Dora", [metaBatida], null, {
  totalVendas: 25,
  bonificacaoAtual: 250,
  temRegra: true,
});
contem("bateu a meta parabeniza", bateuMeta, "Parabéns");

// 5. Atendimento/ADM com venda: ganha por venda, sem meta — informa o valor
//    em vez de anunciar um desbloqueio que a regra do cargo não tem.
const admComVenda = montarMensagem("Elias", [], null, {
  totalVendas: 7,
  bonificacaoAtual: 140,
  temRegra: true,
});
naoContem("ADM com venda não fala em desbloqueio", admComVenda, "desbloqueou");
// Sem o "R$" no trecho procurado: o Intl separa símbolo e número por espaço
// não-quebrável (U+00A0), que não é o espaço digitado aqui.
contem("ADM com venda mostra o valor já ganho", admComVenda, "140,00");
contem("ADM com venda explica que é por venda", admComVenda, "sem meta a bater");

// 6. Vendeu, mas o cargo não tem regra nenhuma: não promete bonificação.
const vendeuSemRegra = montarMensagem("Fábio", [], null, {
  totalVendas: 7,
  bonificacaoAtual: 0,
  temRegra: false,
});
naoContem("vendeu sem regra não parabeniza", vendeuSemRegra, "Parabéns");
contem("vendeu sem regra informa a falta de configuração", vendeuSemRegra, "Não há regra de bonificação configurada");
contem("vendeu sem regra mostra a quantidade", vendeuSemRegra, "7 venda(s)");

// 7. Supervisor abaixo da meta de equipe, sem venda própria.
const supervisorSemVenda = montarMensagem("Gisele", [], supervisorAbaixo, {
  totalVendas: 0,
  bonificacaoAtual: 0,
  temRegra: true,
});
naoContem("supervisor sem venda não parabeniza", supervisorSemVenda, "Parabéns");
contem("supervisor sem venda mostra a meta da equipe", supervisorSemVenda, "faltam 60");

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
