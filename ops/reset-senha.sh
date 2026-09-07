#!/bin/sh
# Saida de emergencia: redefine a senha de um usuario direto no banco.
# Use quando o Dono ficou trancado pra fora e nao ha quem redefina pela tela.
# Precisa de acesso ao host (docker). Uso:
#   sh ops/reset-senha.sh dono@opensador.local
set -eu
cd "$(dirname "$0")/.."

EMAIL="${1:?uso: sh ops/reset-senha.sh <email>}"

printf 'Nova senha (min. 8 chars): '
stty -echo 2>/dev/null || true
read SENHA
stty echo 2>/dev/null || true
echo

docker compose exec -T api node src/reset-cli.js "$EMAIL" "$SENHA"
