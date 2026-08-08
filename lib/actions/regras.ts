"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapacidade } from "@/lib/auth-guard";
import { registrarAlteracao } from "@/lib/auditoria";
import { CARGOS } from "@/lib/constants";
import type { ActionResult } from "@/lib/constants";
import type { Prisma } from "@/app/generated/prisma/client";

const SERVICO_KEYS = [
  "internet",
  "chip",
  "gps",
  "tv",
  "streaming",
  "telefoniaFixa",
  "demaisServicos",
] as const;

const faixaSchema = z.object({
  min: z.coerce.number(),
  max: z.coerce.number().nullable(),
  valor: z.coerce.number(),
});

const servicoRegraSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("faixas"), faixas: z.array(faixaSchema).min(1) }),
  z.object({ tipo: z.literal("meta"), metaQtd: z.coerce.number(), valor: z.coerce.number() }),
  z.object({ tipo: z.literal("porVenda"), valor: z.coerce.number() }),
  z.object({ tipo: z.literal("percentualValor"), percentual: z.coerce.number() }),
]);

const supervisorSchema = z.object({
  metaPorPessoa: z.coerce.number(),
  larguraPorPessoa: z.coerce.number(),
  valoresFaixa: z.array(z.coerce.number()).min(1),
});

const configSchema = z.object({
  servicos: z.record(z.enum(SERVICO_KEYS), servicoRegraSchema),
  supervisor: supervisorSchema.optional(),
});

const regraSchema = z.object({
  cargo: z.enum(["VENDEDOR_EXTERNO", "ATENDIMENTO_ADM", "SUPERVISOR", "TECNICO", "VENDEDOR_AGREGADO", "RESPONSAVEL_SETOR", "OUTRO_SETOR"]),
  vigenciaInicio: z.string().min(1, "Informe a data de início da vigência"),
  observacoes: z.string().trim().optional(),
});

export async function createRegraBonificacao(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireCapacidade("EDITAR_REGRA");

  const parsed = regraSchema.safeParse({
    cargo: formData.get("cargo"),
    vigenciaInicio: formData.get("vigenciaInicio"),
    observacoes: formData.get("observacoes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  let configRaw: unknown;
  try {
    configRaw = JSON.parse(String(formData.get("config") ?? "{}"));
  } catch {
    return { ok: false, error: "Configuração inválida (JSON malformado)." };
  }
  const configParsed = configSchema.safeParse(configRaw);
  if (!configParsed.success) {
    return { ok: false, error: `Configuração inválida: ${configParsed.error.issues[0].message}` };
  }

  const [ano, mes, dia] = parsed.data.vigenciaInicio.split("-").map(Number);
  const vigenciaInicio = new Date(Date.UTC(ano, mes - 1, dia));
  if (Number.isNaN(vigenciaInicio.getTime())) {
    return { ok: false, error: "Data de início inválida." };
  }

  const diaAnterior = new Date(vigenciaInicio);
  diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);

  // A regra que está saindo de vigência, guardada para o registro: é ela que
  // pagou os meses anteriores, e é o que uma contestação vai querer comparar.
  const regraAnterior = await prisma.regraBonificacao.findFirst({
    where: { cargo: parsed.data.cargo, vigenciaFim: null },
    orderBy: { vigenciaInicio: "desc" },
  });

  await prisma.$transaction(async (tx) => {
    await tx.regraBonificacao.updateMany({
      where: { cargo: parsed.data.cargo, vigenciaFim: null },
      data: { vigenciaFim: diaAnterior },
    });

    await tx.regraBonificacao.create({
      data: {
        cargo: parsed.data.cargo,
        vigenciaInicio,
        vigenciaFim: null,
        config: configParsed.data as unknown as Prisma.InputJsonValue,
        observacoes: parsed.data.observacoes || null,
      },
    });
  });

  const cargoLabel =
    CARGOS.find((c) => c.value === parsed.data.cargo)?.label ?? parsed.data.cargo;

  await registrarAlteracao({
    acao: "REGRA_CRIADA",
    usuarioId: user.id,
    usuarioNome: user.name ?? user.username,
    alvo: cargoLabel,
    resumo:
      `Nova regra de bonificação para ${cargoLabel}, valendo a partir de ` +
      `${vigenciaInicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` +
      `${regraAnterior ? " (a anterior foi encerrada no dia anterior)" : ""}.`,
    antes: regraAnterior?.config ?? null,
    depois: configParsed.data,
  });

  revalidatePath("/regras");
  return { ok: true };
}
