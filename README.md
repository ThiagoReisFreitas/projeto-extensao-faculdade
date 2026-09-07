# Sistema de Controle Financeiro — O Pensador (PEX)

Controle financeiro para restaurante (self-service + churrascaria). Node/Express + Postgres + React, tudo em Docker. Ver `requisitos-sistema-financeiro-o-pensador.md`.

## Subir

    docker compose up -d --build

O compose tem defaults embutidos, entao sobe sem `.env`. Para piloto real, crie o
`.env` e troque os segredos:

    cp .env.example .env      # ajuste ADMIN_SENHA e JWT_SECRET

Se um boot anterior falhou e deixou o volume do banco sujo, zere antes:

    docker compose down -v && docker compose up -d --build

- App: http://localhost:8080
- Login inicial: `ADMIN_EMAIL` / `ADMIN_SENHA` do `.env` (Dono criado no 1º boot).

## Serviços (docker-compose)

| serviço | o que é |
|---|---|
| `db` | Postgres 16. Migrations em `db/migrations/*.sql` rodam automático no 1º boot (volume `db_data`). |
| `api` | Express, porta interna 3000. Uploads no volume `uploads_data`. |
| `web` | build React servido por Nginx. |
| `proxy` | Nginx público na porta 8080 → `/api/*` na api, resto no web. |

## Resetar o banco (re-roda migrations + seed)

    docker compose down -v && docker compose up -d --build

## Testes da API

    cd api && npm install && npm test     # cobre o cálculo de taxa

## Estrutura

    db/migrations/   01_schema  02_views  03_seed
    api/src/         index.js, auth, taxa, fechamento, routes/*
    web/src/         pages/*, api.js, auth.jsx

## Módulos entregues

Auth (2 perfis) · Cadastros (operadoras, formas de pagamento, categorias, funcionários, usuários — só Dono) · Receitas (c/ taxa de operadora + foto) · Gastos (c/ foto) · Folha (fixo/temporário/diarista) · Fluxo de caixa (dashboard + gráficos + CSV) · Fechamento diário · Estorno com motivo · Comprovantes servidos atrás de auth (`/api/comprovantes/...`).

## Backup e monitoramento

`ops/backup.sh` (dump do `db` + tar de comprovantes, retenção, rclone opcional), `ops/restore.sh`, `ops/healthcheck.sh` (RNF09). Cron em `ops/crontab.example`. Ver `ops/README.md` e seção 7.7 do doc.
