#!/usr/bin/env bash

# Monitor para index.js: revisa cada 10s y reinicia si no está corriendo.
LOG_DIR="$(pwd)/logs"
MON_LOG="$LOG_DIR/monitor.log"
NODE_LOG="$LOG_DIR/node_index.log"
PID_FILE="$(pwd)/.node_index_pid"
NVM_DIR="$HOME/.nvm"

mkdir -p "$LOG_DIR"

timestamp(){ date -u "+%Y-%m-%d %H:%M:%S UTC"; }

# Cargar nvm si existe
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

echo "$(timestamp) [MONITOR] Iniciado monitor para index.js" >> "$MON_LOG"

while true; do
  echo "$(timestamp) [MONITOR] heartbeat" >> "$MON_LOG"

  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      echo "$(timestamp) [MONITOR] proceso activo PID=$PID" >> "$MON_LOG"
    else
      echo "$(timestamp) [MONITOR] proceso no encontrado (PID=$PID). Intentando reiniciar." >> "$MON_LOG"
      # Intentar usar Node 20 y reiniciar
      if command -v nvm > /dev/null 2>&1; then
        nvm use 20 >/dev/null 2>&1 || nvm install 20 --latest-npm >/dev/null 2>&1 && nvm use 20 >/dev/null 2>&1
      fi
      nohup node index.js > "$NODE_LOG" 2>&1 &
      NEWPID=$!
      echo "$NEWPID" > "$PID_FILE"
      echo "$(timestamp) [MONITOR] reiniciado index.js PID=$NEWPID" >> "$MON_LOG"
    fi
  else
    echo "$(timestamp) [MONITOR] PID file no encontrado. Iniciando index.js." >> "$MON_LOG"
    if command -v nvm > /dev/null 2>&1; then
      nvm use 20 >/dev/null 2>&1 || nvm install 20 --latest-npm >/dev/null 2>&1 && nvm use 20 >/dev/null 2>&1
    fi
    nohup node index.js > "$NODE_LOG" 2>&1 &
    NEWPID=$!
    echo "$NEWPID" > "$PID_FILE"
    echo "$(timestamp) [MONITOR] iniciado index.js PID=$NEWPID" >> "$MON_LOG"
  fi

  # Mantener bucle cada 10 segundos
  sleep 10
done
