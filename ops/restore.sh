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

docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1 || {
  echo "erro: volume '$UPLOADS_VOLUME' nao existe (defina UPLOADS_VOLUME no .env se o nome do projeto compose for outro)" >&2
  exit 1
}

TMP=""
cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; }
trap cleanup EXIT

# .gpg (backup.sh cifra quando RCLONE_REMOTE esta setado) precisa decifrar
# antes de gunzip/tar — senao falha calado num arquivo binario cifrado.
decifrar_se_preciso() {
  case "$1" in
    *.gpg)
      TMP=$(mktemp -d)
      OUT_PLANO="$TMP/$(basename "${1%.gpg}")"
      gpg --yes --batch -d -o "$OUT_PLANO" "$1"
      echo "$OUT_PLANO"
      ;;
    *) echo "$1" ;;
  esac
}

DB_DUMP_PLANO=$(decifrar_se_preciso "$DB_DUMP")
UP_TAR_PLANO=$(decifrar_se_preciso "$UP_TAR")

echo ">> restaurando banco de $DB_DUMP"
gunzip -c "$DB_DUMP_PLANO" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB"

echo ">> restaurando comprovantes de $UP_TAR"
docker run --rm -v "$UPLOADS_VOLUME":/u -v "$(cd "$(dirname "$UP_TAR_PLANO")" && pwd)":/in:ro alpine \
  sh -c 'cd /u && tar xzf "/in/'"$(basename "$UP_TAR_PLANO")"'"'

echo "restore ok"
