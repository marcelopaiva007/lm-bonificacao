import "server-only";
import { prisma } from "@/lib/prisma";
import {
  asRegraConfig,
  getRegraVigente,
  calcularBonificacaoIndividual,
  type LancamentoAgregado,
} from "@/lib/bonificacao";
import {
  acharFuncionario,
  categoriaProdutoFunil,
  parseDataBr,
  parseValorBr,
  type LinhaFunil,
} from "@/lib/elleven-core";
import { normalizarTexto } from "@/lib/text";

// Pagamento semanal dos TÉCNICOS (regra da diretoria, 08/08/2026): R$ 20 por
// internet + 50% dos demais serviços, pagos toda segunda-feira.
//
// Decisão de desenho: isto é um RELATÓRIO DE PAGAMENTO, não um segundo
// fechamento. O fechamento do sistema continua mensal (e o mês do técnico
// também é calculado lá, pela mesma regra); a segunda-feira recebe o recorte
// semanal — a soma das 4-5 semanas de um mês bate com o mês, porque a regra do
// técnico não tem faixa nem meta: é linear por venda.
//
// A semana vai de SEGUNDA a DOMINGO e é paga na segunda-feira seguinte.
//
// Fonte: as linhas cruas do Funil de Vendas (elleven_relatorio_linha), porque
// LancamentoVenda é um agregado mensal sem data. A data de cada venda é a
// "Data Ativacao" (para técnico, venda = instalação ativada), caindo para
// "Data do Status" quando a ativação ainda não foi preenchida.

export type LinhaSemanaTecnico = {
  funcionarioId: string;
  nome: string;
  qtdInternet: number;
  qtdDemais: number;
  valorDemaisServicos: number;
  valorInternet: number;
  valorDemais: number;
  total: number;
};

export type SemanaTecnicos = {
  /** Segunda-feira em que o pagamento é feito (ISO AAAA-MM-DD). */
  pagamentoIso: string;
  /** Intervalo coberto: segunda (inclusive) e domingo (inclusive), ISO. */
  inicioIso: string;
  fimIso: string;
  linhas: LinhaSemanaTecnico[];
  totalGeral: number;
  /** Vendas de técnico cuja linha não tem data nenhuma — ficam de fora e são contadas. */
  linhasSemData: number;
  temRegra: boolean;
};

function isoDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diaSaoPaulo(agora: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora); // "AAAA-MM-DD"
  return new Date(`${parts}T00:00:00.000Z`);
}

/**
 * A segunda-feira de pagamento mais recente (hoje, se hoje for segunda).
 * `ref` em ISO permite navegar para semanas passadas pela URL.
 */
export function segundaDePagamento(refIso?: string): Date {
  const base = refIso ? new Date(`${refIso}T00:00:00.000Z`) : diaSaoPaulo(new Date());
  const dia = base.getUTCDay(); // 0=dom, 1=seg
  const recuo = dia === 0 ? 6 : dia - 1;
  const segunda = new Date(base);
  segunda.setUTCDate(segunda.getUTCDate() - recuo);
  return segunda;
}

export async function semanaDosTecnicos(refIso?: string): Promise<SemanaTecnicos> {
  const pagamento = segundaDePagamento(refIso);
  const inicio = new Date(pagamento);
  inicio.setUTCDate(inicio.getUTCDate() - 7); // segunda da semana paga
  const fim = new Date(pagamento);
  fim.setUTCDate(fim.getUTCDate() - 1); // domingo

  // A semana pode cruzar a virada do mês — carrega os dois períodos.
  const periodos = [...new Set([isoDe(inicio).slice(0, 7), isoDe(fim).slice(0, 7)])];
  const [linhasBrutas, funcionarios, regra] = await Promise.all([
    prisma.elevenRelatorioLinha.findMany({
      where: { relatorio: "funil-de-vendas", periodo: { in: periodos } },
    }),
    prisma.funcionario.findMany({ where: { ativo: true } }),
    // A regra vigente no mês da segunda de pagamento — a mesma que o
    // fechamento mensal usa para o técnico.
    getRegraVigente("TECNICO", isoDe(pagamento).slice(0, 7)),
  ]);
  const config = asRegraConfig(regra?.config);

  const porNomeExato = new Map(funcionarios.map((f) => [normalizarTexto(f.nome), f]));
  const tecnicos = new Map<
    string,
    { funcionarioId: string; nome: string; agregado: LancamentoAgregado }
  >();
  let linhasSemData = 0;

  for (const linha of linhasBrutas) {
    const dados = linha.dados as LinhaFunil;
    // Mesmos critérios de venda da importação mensal (Ganha, não-Upgrade,
    // valor > 0) — divergir aqui faria a semana não bater com o mês.
    if (normalizarTexto(String(dados["Status Negociacao"] ?? "")) !== "ganha") continue;
    if (normalizarTexto(String(dados["Tipo Negociacao"] ?? "")) === "upgrade") continue;
    const valor = parseValorBr(String(dados["Valor Serv. Carrinho"] ?? ""));
    if (valor <= 0) continue;

    const nomeVendedor = String(dados["Vendedor"] ?? "").trim();
    if (!nomeVendedor) continue;
    const { funcionario } = acharFuncionario(nomeVendedor, funcionarios, porNomeExato);
    if (!funcionario || funcionario.cargo !== "TECNICO") continue;

    const data =
      parseDataBr(String(dados["Data Ativacao"] ?? "")) ??
      parseDataBr(String(dados["Data do Status"] ?? ""));
    if (!data) {
      linhasSemData++;
      continue;
    }
    if (data < inicio || data > fim) continue;

    const atual = tecnicos.get(funcionario.id) ?? {
      funcionarioId: funcionario.id,
      nome: funcionario.nome,
      agregado: {
        quantidade: 0,
        aprovado: 0,
        cancelado: 0,
        valorInstalado: 0,
        valorDemaisServicos: 0,
        qtdInternet: 0,
        qtdChip: 0,
        qtdGps: 0,
        qtdTv: 0,
        qtdStreaming: 0,
        qtdTelefoniaFixa: 0,
      },
    };
    atual.agregado.quantidade++;
    atual.agregado.aprovado++;
    atual.agregado.valorInstalado += valor;
    const cat = categoriaProdutoFunil(String(dados["Servico Carrinho"] ?? ""));
    if (cat) atual.agregado[cat]++;
    if (cat !== "qtdInternet") atual.agregado.valorDemaisServicos += valor;
    tecnicos.set(funcionario.id, atual);
  }

  const linhas: LinhaSemanaTecnico[] = [...tecnicos.values()]
    .map((t) => {
      const b = calcularBonificacaoIndividual(t.agregado, config);
      return {
        funcionarioId: t.funcionarioId,
        nome: t.nome,
        qtdInternet: t.agregado.qtdInternet,
        qtdDemais: t.agregado.quantidade - t.agregado.qtdInternet,
        valorDemaisServicos: t.agregado.valorDemaisServicos,
        valorInternet: b.valorInternet,
        valorDemais: b.valorDemais + b.valorChip,
        total: b.valorInternet + b.valorChip + b.valorDemais,
      };
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    pagamentoIso: isoDe(pagamento),
    inicioIso: isoDe(inicio),
    fimIso: isoDe(fim),
    linhas,
    totalGeral: linhas.reduce((s, l) => s + l.total, 0),
    linhasSemData,
    temRegra: config != null,
  };
}
