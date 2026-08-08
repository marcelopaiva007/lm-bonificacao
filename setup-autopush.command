#!/bin/bash
# Script de instalação da automação de Auto-Push do macOS
# Dá dois cliques neste arquivo no Finder para ativar a automação em segundo plano.

PLIST_PATH="$HOME/Library/LaunchAgents/com.marcelopaiva.softvendas.autopush.plist"
SCRIPT_PATH="/Users/marcelopaiva/SOFT VENDAS/auto-push.sh"
WATCH_DIR="/Users/marcelopaiva/SOFT VENDAS"

mkdir -p "$HOME/Library/LaunchAgents"
chmod +x "$SCRIPT_PATH"

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.marcelopaiva.softvendas.autopush</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SCRIPT_PATH</string>
    </array>
    <key>WatchPaths</key>
    <array>
        <string>$WATCH_DIR</string>
    </array>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$WATCH_DIR/auto-push.log</string>
    <key>StandardErrorPath</key>
    <string>$WATCH_DIR/auto-push-error.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "--------------------------------------------------------"
echo " SUCCESS! Automação de Deploy Automático Ativada!"
echo "--------------------------------------------------------"
echo "Sempre que o Claude alterar arquivos neste projeto,"
echo "seu Mac fará o Push para o GitHub e a Vercel fará o Deploy"
echo "automaticamente em segundo plano, SEM usar o terminal!"
echo "--------------------------------------------------------"
read -p "Pressione Enter para fechar..."
