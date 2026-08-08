"use client";

import { useActionState, use, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LM3DLogo } from "@/components/lm-3d-logo";
import { redefinirSenhaComToken } from "@/lib/actions/recuperacao-senha";
import type { ActionResult } from "@/lib/constants";
import { Eye, EyeOff, CheckCircle2, Lock } from "lucide-react";

const initialState: ActionResult = { ok: true };

export default function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  const [state, formAction, isPending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    fd.append("token", token);
    return await redefinirSenhaComToken(prev, fd);
  }, initialState);

  return (
    <div className="flex flex-1 min-h-screen items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <LM3DLogo />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Redefinir Senha
          </h1>
          <p className="text-sm text-slate-400">
            Digite sua nova senha para reestabelecer o acesso à sua conta
          </p>
        </div>

        <Card className="border-cyan-500/30 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-md shadow-2xl">
          <CardContent className="pt-6">
            {state.ok && state.error === undefined && isPending === false && (state as any).success ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center text-cyan-400">
                  <CheckCircle2 className="size-12" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">Senha alterada com sucesso!</h2>
                <p className="text-sm text-slate-300">
                  Sua senha foi redefinida. Agora você já pode entrar na plataforma com sua nova senha.
                </p>
                <div className="pt-2">
                  <Link href="/login">
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-semibold">
                      Ir para o Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="novaSenha" className="text-slate-300">
                    Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="novaSenha"
                      name="novaSenha"
                      type={showSenha ? "text" : "password"}
                      minLength={8}
                      required
                      autoFocus
                      placeholder="Mínimo 8 caracteres"
                      className="bg-slate-800/50 border-slate-700/50 text-slate-100 placeholder:text-slate-500 pr-10 focus:border-cyan-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmarSenha" className="text-slate-300">
                    Confirme a Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmarSenha"
                      name="confirmarSenha"
                      type={showConfirmar ? "text" : "password"}
                      minLength={8}
                      required
                      placeholder="Repita a nova senha"
                      className="bg-slate-800/50 border-slate-700/50 text-slate-100 placeholder:text-slate-500 pr-10 focus:border-cyan-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmar(!showConfirmar)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {!state.ok && state.error && (
                  <Alert variant="destructive" className="bg-red-950/50 border-red-800/50">
                    <AlertDescription className="text-red-200">{state.error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/30"
                  disabled={isPending}
                >
                  <Lock className="size-4 mr-2" />
                  {isPending ? "Salvando..." : "Salvar Nova Senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
