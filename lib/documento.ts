// Validação de CPF e CNPJ pelos dígitos verificadores — pega documento fictício
// (ex.: 123.456.789-10) e digitado errado, que a checagem de "11 dígitos" deixava
// passar. Recebe o valor com ou sem máscara.

function digitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export function validarCpf(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // 000..., 111... — todos iguais
  const dv = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  if (dv(d.slice(0, 9), 10) !== Number(d[9])) return false;
  return dv(d.slice(0, 10), 11) === Number(d[10]);
}

export function validarCnpj(valor: string): boolean {
  const d = digitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string, pesos: number[]): number => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (dv(d.slice(0, 12), p1) !== Number(d[12])) return false;
  return dv(d.slice(0, 13), p2) === Number(d[13]);
}

export type TipoDocumento = "CPF" | "CNPJ";

/** "CPF" (pessoa física) ou "CNPJ" (empresa) se válido; null se inválido. */
export function tipoDocumento(valor: string): TipoDocumento | null {
  if (validarCpf(valor)) return "CPF";
  if (validarCnpj(valor)) return "CNPJ";
  return null;
}

export function documentoValido(valor: string): boolean {
  return tipoDocumento(valor) !== null;
}

/** Aplica a máscara conforme o tamanho (11 = CPF, 14 = CNPJ). */
export function formatarDocumento(valor: string | null | undefined): string {
  const d = digitos(valor ?? "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
}
