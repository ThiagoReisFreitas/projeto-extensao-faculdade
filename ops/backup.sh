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

mkdir -p "$OUT"

DB_FILE="$OUT/db-$STAMP.sql.gz"
docker compose exec -T db pg_dump -U "$PGUSER" -d "$PGDB" --clean --if-exists | gzip > "$DB_FILE"

# cifra o dump se BACKUP_GPG_RECIPIENT estiver setado (recomendado p/ copia externa)
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --yes --batch -e -r "$BACKUP_GPG_RECIPIENT" -o "$DB_FILE.gpg" "$DB_FILE"
  rm -f "$DB_FILE"
  DB_FILE="$DB_FILE.gpg"
fi

docker run --rm -v "$UPLOADS_VOLUME":/u:ro -v "$(cd "$OUT" && pwd)":/out alpine \
  tar czf "/out/uploads-$STAMP.tar.gz" -C /u .

chmod 600 "$DB_FILE" "$OUT/uploads-$STAMP.tar.gz"

find "$OUT" -name 'db-*'             -mtime +"$KEEP_DAYS" -delete
find "$OUT" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$DB_FILE"                   "$RCLONE_REMOTE" --quiet
  rclone copy "$OUT/uploads-$STAMP.tar.gz" "$RCLONE_REMOTE" --quiet
fi

echo "backup ok: $STAMP  ($OUT)"
