"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LM3DLogo } from "@/components/lm-3d-logo";
import { solicitarRecuperacaoSenha } from "@/lib/actions/recuperacao-senha";
import type { ActionResult } from "@/lib/constants";
import { ArrowLeft, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

const initialState: ActionResult & { resetLink?: string } = { ok: true };

export default function RecuperarSenhaPage() {
  const [copied, setCopied] = useState(false);

  const [state, formAction, isPending] = useActionState(async (prev: any, fd: FormData) => {
    return await solicitarRecuperacaoSenha(prev, fd);
  }, initialState);

  const isSuccess = state.ok && state.resetLink !== undefined;

  function copyLink() {
    if (!state.resetLink) return;
    const fullUrl = `${window.location.origin}${state.resetLink}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Link de redefinição copiado!");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div className="flex flex-1 min-h-screen items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <LM3DLogo />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Recuperação de Senha
          </h1>
          <p className="text-sm text-slate-400">
            Digite seu e-mail ou nome de usuário para gerar o link de redefinição
          </p>
        </div>

        <Card className="border-cyan-500/30 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-md shadow-2xl">
          <CardContent className="pt-6">
            {isSuccess ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center text-cyan-400">
                  <CheckCircle2 className="size-12" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">Instruções enviadas!</h2>
                <p className="text-sm text-slate-300">
                  Se os dados informados corresponderem a uma conta ativa, o link de recuperação de senha foi gerado:
                </p>

                {state.resetLink && (
                  <div className="p-3 bg-slate-900 border border-cyan-500/40 rounded-md text-left space-y-2">
                    <p className="text-xs text-slate-400 font-mono break-all">
                      {typeof window !== "undefined" ? window.location.origin : ""}{state.resetLink}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyLink}
                      className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Copy className="size-4 mr-2" />
                      {copied ? "Link Copiado!" : "Copiar Link de Redefinição"}
                    </Button>
                  </div>
                )}

                <div className="pt-2">
                  <Link href="/login">
                    <Button variant="ghost" className="w-full text-slate-300 hover:text-slate-100">
                      <ArrowLeft className="size-4 mr-2" />
                      Voltar para o Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form action={formAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identificador" className="text-slate-300">
                    Usuário ou E-mail
                  </Label>
                  <Input
                    id="identificador"
                    name="identificador"
                    placeholder="Seu login ou e-mail cadastrado"
                    required
                    autoFocus
                    className="bg-slate-800/50 border-slate-700/50 text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/30"
                  />
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
                  {isPending ? "Processando..." : "Gerar Link de Recuperação"}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-sm text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    <ArrowLeft className="size-4 mr-1" />
                    Voltar para o login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
