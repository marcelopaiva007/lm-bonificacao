#!/bin/bash
# Script de auto-push em segundo plano para o projeto SOFT VENDAS
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/marcelopaiva"

PROJECT_DIR="/Users/marcelopaiva/SOFT VENDAS"
LOG_FILE="$PROJECT_DIR/autopush-debug.log"

cd "$PROJECT_DIR" || exit 1

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")

echo "========================================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando verificação de Auto-Push..." >> "$LOG_FILE"

# 1. Desfaz commits locais pendentes que incluam arquivos .github sem perder código
git fetch origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
git reset origin/"$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1

# 2. Remove pasta .github se existir
rm -rf "$PROJECT_DIR/.github" 2>/dev/null

# 3. Adiciona todos os arquivos reais de código
git add -A >> "$LOG_FILE" 2>&1

# 4. Faz commit limpo se houver alterações no projeto
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Criando commit limpo do código..." >> "$LOG_FILE"
    git commit -m "Auto-update via Claude [$(date '+%Y-%m-%d %H:%M:%S')]" >> "$LOG_FILE" 2>&1
fi

# 5. Envia o push para o GitHub
UNPUSHED=$(git log "origin/$CURRENT_BRANCH..HEAD" --oneline 2>/dev/null)

if [ -n "$UNPUSHED" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Enviando alterações para o GitHub (git push)..." >> "$LOG_FILE"
    git push -u origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
    PUSH_RESULT=$?

    if [ $PUSH_RESULT -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCESSO ABSOLUTO! Push realizado com sucesso no branch $CURRENT_BRANCH." >> "$LOG_FILE"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] O deploy na Vercel foi iniciado automaticamente!" >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERRO no Git Push. Código: $PUSH_RESULT" >> "$LOG_FILE"
    fi
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nenhuma alteração pendente para enviar." >> "$LOG_FILE"
fi
echo "========================================================" >> "$LOG_FILE"
