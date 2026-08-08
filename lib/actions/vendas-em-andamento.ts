"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { parseDataBr, parseValorBr, isCancelado } from "@/lib/elleven-core";

export type VendaEmAndamento = {
  id: number;
  contrato: string;
  vendedor: string;
  cliente: string;
  cidade: string;
  servico: string;
  valorServico: number;
  dataContrato: string;
  prazoAtivacao: string;
  statusContrato: string;
};

export type ResumoVendasEmAndamento = {
  totalCount: number;
  valorTotalEstimado: number;
  vendas: VendaEmAndamento[];
  porCidade: { cidade: string; quantidade: number; valor: number }[];
  porVendedor: { vendedor: string; quantidade: number; valor: number }[];
};

export async function getVendasEmAndamento(periodo?: string): Promise<ResumoVendasEmAndamento> {
  await requireAdmin();

  const todosContratos = await prisma.contratoAtivacaoElleven.findMany({
    orderBy: { syncedAt: "desc" },
  });

  let ano: number | null = null;
  let mes: number | null = null;

  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) {
    const [a, m] = periodo.split("-").map(Number);
    ano = a;
    mes = m;
  }

  const emAndamento = todosContratos.filter((c) => {
    // Se o contrato for cancelado, ignora
    if (isCancelado(c.statusContrato)) return false;

    // Venda em andamento = sem data de ativação (ativacaoContrato vazia/nula)
    const dAtivacao = parseDataBr(c.ativacaoContrato);
    if (dAtivacao) return false; // Já foi instalada/ativada

    // Se um período específico foi informado, filtra pela data do contrato
    if (ano && mes) {
      const dContrato = parseDataBr(c.dataContrato);
      if (!dContrato) return true; // Mantém no relatório se sem data mas ativo
      if (dContrato.getUTCFullYear() !== ano || dContrato.getUTCMonth() + 1 !== mes) {
        return false;
      }
    }

    return true;
  });

  let valorTotalEstimado = 0;
  const mapaCidade = new Map<string, { quantidade: number; valor: number }>();
  const mapaVendedor = new Map<string, { quantidade: number; valor: number }>();

  const vendas: VendaEmAndamento[] = emAndamento.map((c) => {
    const valor = parseValorBr(c.valServAtivado);
    valorTotalEstimado += valor;

    const cid = (c.cidade || "Não informada").replace(/\s*-\s*[A-Z]{2}\s*$/, "").trim();
    const vend = (c.vendedor1 || "Sem vendedor").trim();

    const itemCid = mapaCidade.get(cid) ?? { quantidade: 0, valor: 0 };
    mapaCidade.set(cid, { quantidade: itemCid.quantidade + 1, valor: itemCid.valor + valor });

    const itemVend = mapaVendedor.get(vend) ?? { quantidade: 0, valor: 0 };
    mapaVendedor.set(vend, { quantidade: itemVend.quantidade + 1, valor: itemVend.valor + valor });

    return {
      id: c.id,
      contrato: c.contrato,
      vendedor: vend,
      cliente: c.nomeCliente || "—",
      cidade: cid,
      servico: c.servicoAtivado || "—",
      valorServico: valor,
      dataContrato: c.dataContrato || "—",
      prazoAtivacao: c.prazoAtivacaoContrato || "—",
      statusContrato: c.statusContrato || "Em Andamento",
    };
  });

  const porCidade = Array.from(mapaCidade.entries())
    .map(([cidade, d]) => ({ cidade, ...d }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const porVendedor = Array.from(mapaVendedor.entries())
    .map(([vendedor, d]) => ({ vendedor, ...d }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    totalCount: vendas.length,
    valorTotalEstimado,
    vendas,
    porCidade,
    porVendedor,
  };
}
