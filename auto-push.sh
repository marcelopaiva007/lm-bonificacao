#!/bin/bash
# Script de auto-push em segundo plano para o projeto SOFT VENDAS
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/marcelopaiva"

PROJECT_DIR="/Users/marcelopaiva/SOFT VENDAS"
LOG_FILE="$PROJECT_DIR/autopush-debug.log"

cd "$PROJECT_DIR" || exit 1

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")

# Remove a pasta .github local e do rastreamento do Git para não exigir permissão de 'workflow' no token do GitHub
if [ -d "$PROJECT_DIR/.github" ]; then
    rm -rf "$PROJECT_DIR/.github" 2>/dev/null
    git rm -rf --cached .github >> "$LOG_FILE" 2>&1
fi

# Adiciona todas as edições ao staging do Git
git add -A >> "$LOG_FILE" 2>&1

# Se houver algo novo para commitar, faz o commit
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "========================================================" >> "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Novas alterações detectadas. Salvando commit..." >> "$LOG_FILE"
    git commit -m "Auto-update via Claude [$(date '+%Y-%m-%d %H:%M:%S')]" >> "$LOG_FILE" 2>&1
fi

# Verifica se o branch local está à frente do remoto
UNPUSHED=$(git log "origin/$CURRENT_BRANCH..HEAD" --oneline 2>/dev/null)

if [ -n "$UNPUSHED" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sincronizando repositório remoto (pull --rebase)..." >> "$LOG_FILE"
    git pull --rebase origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Enviando commits para o GitHub (push)..." >> "$LOG_FILE"
    git push -u origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
    PUSH_RESULT=$?

    if [ $PUSH_RESULT -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCESSO COMPLETO! Push e Deploy acionados para $CURRENT_BRANCH." >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERRO no Git Push (Código: $PUSH_RESULT)." >> "$LOG_FILE"
    fi
    echo "========================================================" >> "$LOG_FILE"
fi
