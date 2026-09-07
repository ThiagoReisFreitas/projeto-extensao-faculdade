# API - Pensador (PEX)

Node 22 + Express + Postgres. ESM puro, sem ORM (queries em `pg`, agregacao em views).

## Rodar
Faz parte do `docker-compose` da raiz. Sozinho:

    npm install
    DATABASE_URL=postgres://... JWT_SECRET=xxx npm run dev

## Testes
    npm test        # node:test - cobre o calculo de taxa (money path)

## Rotas (todas sob /api via proxy)
- `POST /auth/login` -> { token, user }
- `GET  /auth/me`
- Cadastros (GET todos; POST/PUT so Dono): `/usuarios` `/operadoras` `/formas-pagamento` `/categorias` `/funcionarios`
- `/receitas` `/gastos` `/pagamentos`  (GET ?de=&ate=; POST; PUT so Dono; `POST /:id/estorno {motivo}`)
- `/fechamentos` (GET, `GET /:data`, `POST {data}`, `POST /:data/reabrir` so Dono)
- `/fluxo/diario|operadora|categoria|folha|resumo` (?de=&ate=) e `/fluxo/export.csv`
- `POST /uploads/:tipo` (tipo = receitas|gastos, campo multipart `arquivo`) -> { comprovante_path }
- `GET  /comprovantes/<comprovante_path>` — imagem, auth via header OU `?token=` (p/ <img>/<a>)

## Notas de modelagem
- Fato imutavel: `valor_taxa`/`valor_liquido` gravados no lancamento, nunca recalculados por job.
- Estorno = novo lancamento espelhado negativo com `estorno_de_id` + `motivo_estorno`. Sem DELETE.
- Dia fechado (`fechamentos_diarios` sem `reaberto_em`) bloqueia escrita ate o Dono reabrir.
- `formas_pagamento.tipo_taxa` (add em relacao ao doc) liga a forma a qual taxa da operadora aplica.
