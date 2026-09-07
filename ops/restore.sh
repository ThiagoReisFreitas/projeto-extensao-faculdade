#!/bin/sh
# Restaura um par de backups. Uso:
#   ops/restore.sh backups/db-STAMP.sql.gz backups/uploads-STAMP.tar.gz
# O dump foi feito com --clean --if-exists, entao pode restaurar por cima do banco atual.
set -eu

cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env
[ $# -eq 2 ] || { echo "uso: restore.sh <db-*.sql.gz> <uploads-*.tar.gz>"; exit 1; }

DB_DUMP=$1
UP_TAR=$2
PGUSER=${POSTGRES_USER:-pensador}
PGDB=${POSTGRES_DB:-pensador}
UPLOADS_VOLUME=${UPLOADS_VOLUME:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')_uploads_data}

echo ">> restaurando banco de $DB_DUMP"
gunzip -c "$DB_DUMP" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB"

echo ">> restaurando comprovantes de $UP_TAR"
docker run --rm -v "$UPLOADS_VOLUME":/u -v "$(pwd)":/in:ro alpine \
  sh -c 'cd /u && tar xzf "/in/'"$UP_TAR"'"'

echo "restore ok"
