#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20
export PATH="$HOME/.local/bin:$PATH"
echo "🤖 Iniciando CERBERO-BOT..."
node --experimental-global-webcrypto index.js
