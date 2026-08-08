<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Versão do sistema: sobe em todo PR

Todo PR que muda o que roda em produção **sobe a `version` do `package.json`** —
sempre, no mesmo commit da mudança:

- `patch` (0.4.0 → 0.4.1) para correção de bug e ajuste de tela;
- `minor` (0.4.0 → 0.5.0) para funcionalidade nova ou mudança de comportamento
  (inclui mudança de regra de bonificação);
- `major` só em quebra grande do jeito de usar o sistema.

Motivo: a etiqueta no rodapé do menu lateral (`lib/versao.ts`, também na tela de
login) mostra `v<versão> · <commit>`, e é por ela que a diretoria responde
"estou vendo a versão nova ou a antiga?" sem abrir o GitHub. O commit sozinho
não serve para conversa — ninguém decora sha. Se a versão não sobe, duas
entregas diferentes aparecem com o mesmo número na tela.

Quando o PR mexe em **cálculo de bonificação**, diga no corpo do PR qual mês é
afetado e se exige recálculo do fechamento — é a informação que a diretoria usa
para decidir se reabre o mês.

# O erro de tipo morre aqui, não na Vercel

`git push` roda `npm run type-check` sozinho (hook `pre-push` do husky, ~5 s).
Não contorne com `--no-verify`.

Motivo: em 07/08/2026 sete deploys de produção seguidos falharam na Vercel pelo
**mesmo** erro de tipo — um `select` do Prisma sem o campo `nome` que a página
lia. Cada tentativa custou ~50 s de build, e entre uma e outra o master ficou
sem deploy bom. O `next build` já reprova erro de tipo (e o `next.config.ts`
não tem `ignoreBuildErrors` — não coloque): o que faltava era descobrir isso
aqui, em segundos, antes de o master ir para produção.
