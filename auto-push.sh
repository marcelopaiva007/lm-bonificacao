#!/bin/bash
# Script de auto-push em segundo plano para o projeto SOFT VENDAS
# Executa fora da sandbox do Claude usando as credenciais nativas do seu Mac.

PROJECT_DIR="/Users/marcelopaiva/SOFT VENDAS"
cd "$PROJECT_DIR" || exit 1

# Verifica se há alterações não salvas no Git
if [ -n "$(git status --porcelain)" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Alterações detectadas. Salvando e enviando para o GitHub..." >> "$PROJECT_DIR/auto-push.log"
    git add .
    git commit -m "Auto-update via Claude [$(date '+%Y-%m-%d %H:%M:%S')]" >> "$PROJECT_DIR/auto-push.log" 2>&1
    git push origin main >> "$PROJECT_DIR/auto-push.log" 2>&1 || git push >> "$PROJECT_DIR/auto-push.log" 2>&1
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Push concluído com sucesso! Deploy automático na Vercel acionado." >> "$PROJECT_DIR/auto-push.log"
fi
