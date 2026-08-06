import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";
import { versaoDoSistema } from "@/lib/versao";

export default function LoginPage() {
  const versao = versaoDoSistema();

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Logo width={240} height={64} className="h-14 w-auto" />
          <p className="text-sm text-muted-foreground">
            Sistema de Bonificação de Vendas
          </p>
        </div>
        <LoginForm />
        {/* Na tela de entrada porque é onde alguém checa a versão sem
            conseguir entrar — suporte pergunta isso antes de qualquer coisa. */}
        <p className="text-center text-[11px] tabular-nums text-muted-foreground/70">
          {versao.rotulo}
        </p>
      </div>
    </div>
  );
}
