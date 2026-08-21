# Registro de versões

Todas as mudanças relevantes do sistema, por versão e data (fuso de Brasília).
Segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
[SemVer](https://semver.org/lang/pt-BR/).

> **Fonte de verdade:** `lib/changelog.ts` (é o que a tela **/novidades** mostra).
> Ao publicar uma versão, atualize os dois — e o número em `package.json`.
> Correção → _patch_ (1.9.x) · recurso → _minor_ (1.x.0) · quebra → _major_ (x.0.0).

## [1.9.0] — 2026-08-21

### Adicionado
- **Registro de versões:** a tela **Novidades**, este CHANGELOG e o selo de
  versão (`v… · data`) de volta na tela de entrada e no rodapé do menu.
- **Telas restauradas:** Gestão, Pagamentos, Registro de Alterações, Batimento e
  Duplicados. Menu religado e **Metas** de volta à lista.

### Alterado
- A reestruturação de 15/08 (que reorganizou a importação do Elleven e havia
  removido as telas acima) foi mantida no que corrigiu; as telas que ela tirou
  do ar voltaram por cima da versão atual, sem mexer no banco de dados.

### Corrigido
- Número de versão realinhado à linhagem 1.8.x — o build de 15/08 havia zerado
  o número para `0.2.1` por engano.

## [1.8.2] — 2026-08-08

### Alterado
- Ajustes na coleta automática do Elleven — as coletas que vinham falhando
  saíram da agenda diária para não atrapalhar as que funcionam.
