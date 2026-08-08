import { requireUser } from "@/lib/auth-guard";
import { TrocarSenhaView } from "./trocar-senha-view";

export default async function TrocarSenhaPage() {
  const user = await requireUser();

  return (
    <TrocarSenhaView
      mustChangePassword={!!user.mustChangePassword}
      username={user.username ?? user.name ?? ""}
    />
  );
}
