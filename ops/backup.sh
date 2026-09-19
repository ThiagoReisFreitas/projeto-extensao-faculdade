#!/bin/sh
# RNF03 - backup diario. Rodar a partir da raiz do repo (usa `docker compose`).
# Dump do Postgres (--clean p/ restore idempotente) + tar do volume de comprovantes.
# Copia pra fora do notebook via rclone se RCLONE_REMOTE estiver setado.
set -eu
umask 077   # backups so p/ o dono do arquivo (contem dados financeiros + hashes)

cd "$(dirname "$0")/.."
[ -f .env ] && . ./.env

OUT=${BACKUP_DIR:-./backups}
KEEP_DAYS=${KEEP_DAYS:-21}
PGUSER=${POSTGRES_USER:-pensador}
PGDB=${POSTGRES_DB:-pensador}
UPLOADS_VOLUME=${UPLOADS_VOLUME:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')_uploads_data}
STAMP=$(date +%Y%m%d-%H%M%S)

# RCLONE_REMOTE manda o backup pra fora da maquina (nuvem de terceiro) — sem
# BACKUP_GPG_RECIPIENT isso sairia como dump de senha/dados financeiros em
# texto claro. Falha cedo em vez de mandar sem cifra.
if [ -n "${RCLONE_REMOTE:-}" ] && [ -z "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "erro: RCLONE_REMOTE setado sem BACKUP_GPG_RECIPIENT — o backup sairia da maquina sem cifra. Defina BACKUP_GPG_RECIPIENT (gpg --full-generate-key) ou remova RCLONE_REMOTE." >&2
  exit 1
fi

mkdir -p "$OUT"

# se o volume nao existir, `docker run -v` cria um vazio na hora e o backup
# "funciona" sem guardar nada — falha alto em vez disso.
docker volume inspect "$UPLOADS_VOLUME" >/dev/null 2>&1 || {
  echo "erro: volume '$UPLOADS_VOLUME' nao existe (defina UPLOADS_VOLUME no .env se o nome do projeto compose for outro)" >&2
  exit 1
}

DB_FILE="$OUT/db-$STAMP.sql.gz"
docker compose exec -T db pg_dump -U "$PGUSER" -d "$PGDB" --clean --if-exists | gzip > "$DB_FILE"

# cifra o dump se BACKUP_GPG_RECIPIENT estiver setado (recomendado p/ copia externa)
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --yes --batch -e -r "$BACKUP_GPG_RECIPIENT" -o "$DB_FILE.gpg" "$DB_FILE"
  rm -f "$DB_FILE"
  DB_FILE="$DB_FILE.gpg"
fi

UPLOADS_FILE="$OUT/uploads-$STAMP.tar.gz"
docker run --rm -v "$UPLOADS_VOLUME":/u:ro -v "$(cd "$OUT" && pwd)":/out alpine \
  tar czf "/out/uploads-$STAMP.tar.gz" -C /u .

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --yes --batch -e -r "$BACKUP_GPG_RECIPIENT" -o "$UPLOADS_FILE.gpg" "$UPLOADS_FILE"
  rm -f "$UPLOADS_FILE"
  UPLOADS_FILE="$UPLOADS_FILE.gpg"
fi

chmod 600 "$DB_FILE" "$UPLOADS_FILE"

find "$OUT" -name 'db-*'      -mtime +"$KEEP_DAYS" -delete
find "$OUT" -name 'uploads-*' -mtime +"$KEEP_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$DB_FILE"      "$RCLONE_REMOTE" --quiet
  rclone copy "$UPLOADS_FILE" "$RCLONE_REMOTE" --quiet
fi

echo "backup ok: $STAMP  ($OUT)"
