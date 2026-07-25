import { requireUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { ROLES_CONTABIL_LEITURA as ROLES_LEITURA, ROLES_CONTABIL_EDICAO as ROLES_EDICAO } from "@/lib/contabil";

export async function requireContabilAccess() {
  const user = await requireUser();
  if (!ROLES_LEITURA.includes(user.role)) redirect("/");
  return user;
}

export async function requireContabilEditor() {
  const user = await requireUser();
  if (!ROLES_EDICAO.includes(user.role)) redirect("/contabil");
  return user;
}

