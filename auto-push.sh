#!/bin/bash
# Script de auto-push em segundo plano para o projeto SOFT VENDAS
PROJECT_DIR="/Users/marcelopaiva/SOFT VENDAS"
LOG_FILE="/tmp/softvendas-autopush.log"

cd "$PROJECT_DIR" || exit 1

# Pega o nome do branch atual (ex: master ou main)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")

# Ignora arquivos de log e temporários para não ficar em loop
if git status --porcelain | grep -v "auto-push" | grep -q .; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Alterações detectadas no branch $CURRENT_BRANCH. Enviando..." >> "$LOG_FILE"
    git add .
    git commit -m "Auto-update via Claude [$(date '+%Y-%m-%d %H:%M:%S')]" >> "$LOG_FILE" 2>&1
    git push -u origin "$CURRENT_BRANCH" >> "$LOG_FILE" 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Push concluído no branch $CURRENT_BRANCH!" >> "$LOG_FILE"
fi
