"use client";

import { useState, useTransition, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LM3DLogo } from "@/components/lm-3d-logo";
import { Eye, EyeOff, AlertTriangle, Lock, User } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(e.getModifierState("CapsLock"));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        username: formData.get("username"),
        password: formData.get("password"),
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("inativa")) {
          setError("Sua conta está inativa. Entre em contato com o suporte.");
        } else {
          setError("Usuário/E-mail ou senha inválidos.");
        }
        return;
      }

      router.push("/");
      router.refresh();
    });
  }

  return (
    <Card className="glass-card relative overflow-hidden border border-cyan-500/30 bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-cyan-500/20">
      <div className="absolute -right-12 -top-12 size-32 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 size-32 rounded-full bg-blue-600/10 blur-2xl pointer-events-none" />

      <CardContent className="pt-8 pb-8 px-6">
        <div className="space-y-6">
          <div className="text-center">
            <LM3DLogo />
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent tracking-tight">
              L&M Telecom
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              Sistema de Vendas da LM
            </p>
          </div>

          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="size-3.5 text-cyan-400" />
                Usuário ou E-mail
              </Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                placeholder="Digite seu usuário ou e-mail"
                required
                autoFocus
                className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/30 text-xs py-2.5"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="size-3.5 text-cyan-400" />
                  Senha
                </Label>
                <Link
                  href="/recuperar-senha"
                  className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline font-medium"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 pr-10 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/30 text-xs py-2.5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {capsLockOn && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1 font-medium">
                  <AlertTriangle className="size-3" /> Caps Lock está ativado
                </p>
              )}
            </div>
            {error && (
              <Alert variant="destructive" className="bg-rose-950/50 border-rose-800/50 text-rose-200">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-sky-400 hover:from-blue-500 hover:to-cyan-300 text-slate-950 font-bold shadow-lg shadow-cyan-500/30 py-2.5 transition-all duration-300 disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? "Autenticando..." : "Entrar no Sistema"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
