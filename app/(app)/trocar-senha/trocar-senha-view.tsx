"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trocarMinhaSenha } from "@/lib/actions/usuarios";
import type { ActionResult } from "@/lib/constants";
import { Eye, EyeOff, Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const initialState: ActionResult = { ok: true };

export function TrocarSenhaView({
  mustChangePassword,
  username,
}: {
  mustChangePassword: boolean;
  username: string;
}) {
  const router = useRouter();
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const result = await trocarMinhaSenha(prev, fd);
    if (result.ok) {
      setSucesso(true);
      toast.success("Sua senha foi alterada com sucesso!");
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    }
    return result;
  }, initialState);

  return (
    <div className="flex flex-1 items-center justify-center p-4 max-w-lg mx-auto py-12">
      <Card className="w-full border bg-card shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Lock className="size-5" />
            <CardTitle className="text-xl">Alterar Minha Senha</CardTitle>
          </div>
          <CardDescription>
            Olá <strong className="text-foreground">{username}</strong>, informe sua senha atual e escolha uma nova senha segura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mustChangePassword && !sucesso && (
            <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="size-4 text-amber-500" />
              <AlertTitle className="font-semibold">Troca de Senha Obrigatória</AlertTitle>
              <AlertDescription className="text-xs">
                Sua conta possui uma senha temporária definida pelo administrador. Você precisa cadastrar uma nova senha para continuar utilizando o sistema.
              </AlertDescription>
            </Alert>
          )}

          {sucesso ? (
            <div className="space-y-4 py-4 text-center">
              <div className="flex justify-center text-emerald-500">
                <CheckCircle2 className="size-12" />
              </div>
              <h3 className="text-lg font-semibold">Senha Alterada!</h3>
              <p className="text-sm text-muted-foreground">
                Sua senha foi redefinida com sucesso. Redirecionando para o sistema...
              </p>
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senhaAtual">Senha Atual</Label>
                <div className="relative">
                  <Input
                    id="senhaAtual"
                    name="senhaAtual"
                    type={showAtual ? "text" : "password"}
                    required
                    autoFocus
                    placeholder="Sua senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAtual(!showAtual)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showAtual ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="novaSenha">Nova Senha (mínimo 8 caracteres)</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    name="novaSenha"
                    type={showNova ? "text" : "password"}
                    minLength={8}
                    required
                    placeholder="Sua nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNova(!showNova)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNova ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha">Confirme a Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmarSenha"
                    name="confirmarSenha"
                    type={showConfirmar ? "text" : "password"}
                    minLength={8}
                    required
                    placeholder="Repita a nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmar(!showConfirmar)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {!state.ok && state.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Salvando Nova Senha..." : "Salvar Senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
