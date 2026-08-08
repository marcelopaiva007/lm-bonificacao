#!/bin/bash
# Script de auto-push em segundo plano para o projeto SOFT VENDAS
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/marcelopaiva"

PROJECT_DIR="/Users/marcelopaiva/SOFT VENDAS"
LOG_FILE="/tmp/softvendas-autopush.log"

cd "$PROJECT_DIR" || exit 1

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")

# 1. Verifica se existem arquivos alterados (ignorando arquivos temporários)
UNCOMMITTED=$(git status --porcelain 2>/dev/null | grep -v "autopush" | grep -v "auto-push")

# 2. Verifica se existem commits locais pendentes de envio
UNPUSHED=$(git log "origin/$CURRENT_BRANCH..HEAD" --oneline 2>/dev/null)

if [ -n "$UNCOMMITTED" ] || [ -n "$UNPUSHED" ]; then
    echo "========================================================" >> "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Alterações detectadas no projeto SOFT VENDAS." >> "$LOG_FILE"

    # Remove pasta .github se existir
    rm -rf "$PROJECT_DIR/.github" 2>/dev/null

    # Adiciona todas as alterações de código
    git add -A >> "$LOG_FILE" 2>&1

    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Salvando commit..." >> "$LOG_FILE"
        git commit -m "Auto-update via Claude [$(date '+%Y-%m-%d %H:%M:%S')]" >> "$LOG_FILE" 2>&1
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sincronizando e enviando para o GitHub (master + main)..." >> "$LOG_FILE"
    git pull --rebase origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1

    # Envia para a branch atual (master)
    git push -u origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
    PUSH_RESULT=$?

    # Garante o envio também para a branch 'main' (caso a Vercel esteja configurada para a 'main')
    git push origin "$CURRENT_BRANCH:main" >> "$LOG_FILE" 2>&1

    if [ $PUSH_RESULT -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCESSO! Push realizado para master e main no GitHub." >> "$LOG_FILE"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy automático na Vercel acionado!" >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERRO no Git Push. Código: $PUSH_RESULT" >> "$LOG_FILE"
    fi
    echo "========================================================" >> "$LOG_FILE"
fi
