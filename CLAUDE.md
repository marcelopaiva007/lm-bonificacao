@AGENTS.md

## Versionamento e registro de mudanças

Cada mudança publicada precisa ficar registrada por versão e data:

1. **Suba o número** em `package.json` (SemVer): correção → patch (`1.9.x`),
   recurso → minor (`1.x.0`), quebra → major (`x.0.0`).
2. **Adicione uma entrada no topo** de `lib/changelog.ts` — é o que a tela
   `/novidades` mostra — com o mesmo número e a data em `aaaa-mm-dd` (fuso BR).
3. **Espelhe** a entrada em `CHANGELOG.md`.

O selo `v<número> · <data>` no login e no rodapé do menu vem de `lib/versao.ts`
(número do `package.json` + data do build da Vercel). Mantenha `package.json` e o
topo de `lib/changelog.ts` sempre com o mesmo número.
