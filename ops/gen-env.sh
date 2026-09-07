#!/bin/sh
# Gera .env na raiz com segredos aleatorios. Nao sobrescreve um .env existente.
set -eu
cd "$(dirname "$0")/.."

[ -f .env ] && { echo ".env ja existe — nao vou sobrescrever. Apague-o antes se quiser regenerar."; exit 1; }

rand() { openssl rand -hex "$1"; }

PGUSER=pensador
PGDB=pensador
PGPASS=$(rand 18)               # 36 chars hex
JWT=$(rand 32)                  # 64 chars hex
ADMIN_EMAIL=${ADMIN_EMAIL:-dono@opensador.local}
ADMIN_SENHA=${ADMIN_SENHA:-$(rand 9)}   # 18 chars hex se nao vier do ambiente

cat > .env <<EOF
POSTGRES_USER=$PGUSER
POSTGRES_PASSWORD=$PGPASS
POSTGRES_DB=$PGDB
DATABASE_URL=postgres://$PGUSER:$PGPASS@db:5432/$PGDB

JWT_SECRET=$JWT
JWT_EXPIRES=12h

ADMIN_NOME=Dono
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_SENHA=$ADMIN_SENHA

UPLOAD_MAX_BYTES=2097152
EOF

chmod 600 .env
echo ".env criado."
echo "  Login inicial:  $ADMIN_EMAIL"
echo "  Senha inicial:  $ADMIN_SENHA   <-- anote agora, nao sera mostrada de novo"
