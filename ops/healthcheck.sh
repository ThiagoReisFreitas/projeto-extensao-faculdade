#!/bin/sh
# RNF09 - cron a cada 5 min. Alerta so na virada (no ar <-> fora do ar).
# Telegram: exportar TELEGRAM_TOKEN e TELEGRAM_CHAT. Sem eles, so loga.
set -eu

# carrega .env se rodando da raiz do repo (pega TELEGRAM_TOKEN/TELEGRAM_CHAT de la)
[ -f .env ] && . ./.env

URL=${HEALTH_URL:-http://localhost:8080/api/health}
STATE=${STATE_FILE:-/tmp/pensador-health.down}

notify() {
  echo "$(date '+%F %T') $1"
  if [ -n "${TELEGRAM_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT:-}" ]; then
    curl -s "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
      --data-urlencode "chat_id=$TELEGRAM_CHAT" \
      --data-urlencode "text=$1" >/dev/null || true
  fi
}

if curl -fsS --max-time 10 "$URL" 2>/dev/null | grep -q '"ok":true'; then
  [ -f "$STATE" ] && { notify "O Pensador voltou ao ar ($URL)"; rm -f "$STATE"; }
  exit 0
else
  [ -f "$STATE" ] || { notify "O Pensador FORA DO AR ($URL)"; : > "$STATE"; }
  exit 1
fi
