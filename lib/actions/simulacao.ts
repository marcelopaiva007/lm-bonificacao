"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guard";
import { simularRegra, type ResultadoSimulacao } from "@/lib/gestao";
import type { RegraConfig } from "@/lib/bonificacao";

// Simulação: só calcula, nunca grava. Por isso exige apenas a capacidade de
// definir regra — quem pode mudar a regra pode testar antes.

const faixaSchema = z.object({
  min: z.coerce.number().int().min(0),
  max: z.coerce.number().int().nullable(),
  valor: z.coerce.number().min(0),
});

const entradaSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  cargo: z.string().min(1),
  faixas: z.array(faixaSchema).min(1),
  metaChipQtd: z.coerce.number().int().min(0),
  metaChipValor: z.coerce.number().min(0),
});

export type RespostaSimulacao =
  | { ok: true; resultado: ResultadoSimulacao }
  | { ok: false; error: string };

export async function simular(entrada: unknown): Promise<RespostaSimulacao> {
  await requireAdmin();

  const parsed = entradaSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { periodo, cargo, faixas, metaChipQtd, metaChipValor } = parsed.data;

  const config: RegraConfig = {
    servicos: {
      internet: { tipo: "faixas", faixas },
      ...(metaChipQtd > 0
        ? { chip: { tipo: "meta" as const, metaQtd: metaChipQtd, valor: metaChipValor } }
        : {}),
    },
  };

  const resultado = await simularRegra(periodo, cargo, config);
  return { ok: true, resultado };
}
