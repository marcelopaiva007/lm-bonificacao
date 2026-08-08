#!/bin/bash
# Script de auto-push em segundo plano para o projeto SOFT VENDAS
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/marcelopaiva"

PROJECT_DIR="/Users/marcelopaiva/SOFT VENDAS"
LOG_FILE="$PROJECT_DIR/autopush-debug.log"

cd "$PROJECT_DIR" || exit 1

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")

# Verifica alterações ignorando os próprios logs da automação
UNCOMMITTED=$(git status --porcelain 2>/dev/null | grep -v "autopush-debug.log" | grep -v "auto-push")

if [ -n "$UNCOMMITTED" ]; then
    echo "========================================================" >> "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Alterações detectadas no branch $CURRENT_BRANCH." >> "$LOG_FILE"
    git add . >> "$LOG_FILE" 2>&1
    git commit -m "Auto-update via Claude [$(date '+%Y-%m-%d %H:%M:%S')]" >> "$LOG_FILE" 2>&1
    git push -u origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
    PUSH_RESULT=$?
    if [ $PUSH_RESULT -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCESSO! Push realizado para $CURRENT_BRANCH." >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERRO no Git Push. Código de saída: $PUSH_RESULT" >> "$LOG_FILE"
    fi
    echo "========================================================" >> "$LOG_FILE"
fi
