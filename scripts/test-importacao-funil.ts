// Teste do caminho que decide quanto cada vendedor vendeu — e, portanto,
// quanto recebe. Roda sem banco: agregarNegociacoesFunil é função pura.
//
// Existe porque em 06/08/2026 dois defeitos de comissão só apareceram DEPOIS
// de ir para produção. O motor de cálculo tinha teste (scripts/test-bonificacao)
// e passava; o que não tinha teste era o passo anterior — transformar linhas do
// relatório do Elleven em vendas por pessoa.
//
//   npx tsx scripts/test-importacao-funil.ts

import { agregarNegociacoesFunil, type LinhaFunil } from "../lib/elleven-core";

let falhas = 0;

function checar(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(
    `${ok ? "✅" : "❌"} ${nome}: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`,
  );
}

// Uma negociação do relatório. Os nomes das colunas são os do CSV real.
function linha(over: Partial<Record<string, string>> = {}): LinhaFunil {
  return {
    "Status Negociacao": "Ganha",
    "Tipo Negociacao": "Venda",
    Vendedor: "MARIA SOUZA",
    "Servico Carrinho": "FIBRA 300MB_PROMO",
    "Valor Serv. Carrinho": "99,90",
    ...over,
  };
}

console.log("\n--- O que conta como venda ---\n");

{
  const r = agregarNegociacoesFunil([
    linha(),
    linha({ "Status Negociacao": "Perdida" }),
    linha({ "Status Negociacao": "Andamento" }),
  ]);
  checar("só negociação Ganha entra", r.negociacoesFiltradas, 1);
}

{
  const r = agregarNegociacoesFunil([linha(), linha({ "Tipo Negociacao": "Upgrade" })]);
  checar("Upgrade não é venda nova", r.negociacoesFiltradas, 1);
}

{
  // O "CDNTV | Pacote Completo" a R$ 0,00 é brinde atrelado a outro plano.
  const r = agregarNegociacoesFunil([
    linha(),
    linha({ "Servico Carrinho": "CDNTV | Pacote Completo", "Valor Serv. Carrinho": "0,00" }),
  ]);
  checar("brinde de valor zero fica fora", r.negociacoesFiltradas, 1);
}

{
  const r = agregarNegociacoesFunil([linha(), linha({ Vendedor: "" }), linha({ Vendedor: "   " })]);
  checar("negociação sem vendedor é contada à parte", r.negociacoesSemVendedor, 2);
  checar("...e não vira venda de ninguém", r.porVendedor.size, 1);
}

{
  // Status vem com capitalização inconsistente entre exports do Elleven.
  const r = agregarNegociacoesFunil([
    linha({ "Status Negociacao": "GANHA" }),
    linha({ "Status Negociacao": " ganha " }),
  ]);
  checar("status é lido sem depender de maiúscula/espaço", r.negociacoesFiltradas, 2);
}

console.log("\n--- Agrupamento por vendedor ---\n");

{
  const r = agregarNegociacoesFunil([
    linha({ Vendedor: "MARIA SOUZA" }),
    linha({ Vendedor: "MARIA SOUZA" }),
    linha({ Vendedor: "JOÃO LIMA" }),
  ]);
  checar("dois vendedores distintos", r.porVendedor.size, 2);
  checar("vendas somam por pessoa", r.porVendedor.get("MARIA SOUZA")?.quantidade, 2);
}

console.log("\n--- Categoria do produto (decide a regra aplicada) ---\n");

const CATEGORIAS: [string, string][] = [
  ["FIBRA 300MB_PROMO", "qtdInternet"],
  ["INTERNET 600MB", "qtdInternet"],
  ["IP FIXO", "qtdInternet"],
  ["CDNTV | Pacote Completo", "qtdStreaming"],
  ["RASTREAMENTO VEICULAR", "qtdGps"],
  ["TELEFONIA FIXA", "qtdTelefoniaFixa"],
];

for (const [servico, campo] of CATEGORIAS) {
  const r = agregarNegociacoesFunil([linha({ "Servico Carrinho": servico })]);
  const ag = r.porVendedor.get("MARIA SOUZA");
  checar(`"${servico}" conta em ${campo}`, (ag as never)?.[campo], 1);
}

console.log("\n--- Valores ---\n");

{
  const r = agregarNegociacoesFunil([
    linha({ "Valor Serv. Carrinho": "99,90" }),
    linha({ "Valor Serv. Carrinho": "1.234,56" }),
  ]);
  const ag = r.porVendedor.get("MARIA SOUZA");
  checar("valor instalado soma com separador de milhar", ag?.valorInstalado, 1334.46);
}

{
  // valorDemaisServicos é a base da regra de 50% do Atendimento/ADM: tudo que
  // NÃO é internet entra, inclusive produto sem categoria reconhecida.
  const r = agregarNegociacoesFunil([
    linha({ "Servico Carrinho": "FIBRA 300MB", "Valor Serv. Carrinho": "100,00" }),
    linha({ "Servico Carrinho": "RASTREAMENTO VEICULAR", "Valor Serv. Carrinho": "50,00" }),
    linha({ "Servico Carrinho": "PRODUTO DESCONHECIDO XYZ", "Valor Serv. Carrinho": "30,00" }),
  ]);
  const ag = r.porVendedor.get("MARIA SOUZA");
  checar("internet NÃO entra em demais serviços", ag?.valorDemaisServicos, 80);
  checar("valor instalado inclui tudo", ag?.valorInstalado, 180);
  checar("produto sem categoria não vira contagem", ag?.qtdInternet, 1);
}

console.log("\n--- Caso completo, como vem do Elleven ---\n");

{
  const r = agregarNegociacoesFunil([
    linha({ Vendedor: "ANA PAULA", "Servico Carrinho": "FIBRA 600MB_PROMO", "Valor Serv. Carrinho": "149,90" }),
    linha({ Vendedor: "ANA PAULA", "Servico Carrinho": "FIBRA 300MB", "Valor Serv. Carrinho": "99,90" }),
    linha({ Vendedor: "ANA PAULA", "Servico Carrinho": "CDNTV | HBO", "Valor Serv. Carrinho": "29,90" }),
    linha({ Vendedor: "ANA PAULA", "Status Negociacao": "Perdida" }),
    linha({ Vendedor: "ANA PAULA", "Tipo Negociacao": "Upgrade" }),
    linha({ Vendedor: "" }),
  ]);
  const ag = r.porVendedor.get("ANA PAULA");
  checar("vendas válidas", ag?.quantidade, 3);
  checar("internet", ag?.qtdInternet, 2);
  checar("streaming", ag?.qtdStreaming, 1);
  checar("valor instalado", ag?.valorInstalado, 279.7);
  checar("demais serviços (só o streaming)", ag?.valorDemaisServicos, 29.9);
  checar("descartadas por falta de vendedor", r.negociacoesSemVendedor, 1);
}

console.log(
  falhas === 0
    ? "\nTodos os casos passaram.\n"
    : `\n${falhas} caso(s) falharam.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
