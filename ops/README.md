# ops/ — backup e monitoramento (RNF03 / RNF09)

Scripts POSIX shell. Precisam de `docker` + `docker compose` no host; `rclone` e `curl` opcionais.
Rodam a partir da raiz do repo (fazem `cd` sozinhos). Leem `.env` se existir.

## Antes de subir: `.env`

Segredos vivem SO no `.env` (não versionado). `docker compose up` recusa subir sem ele.

    ./ops/gen-env.sh      # gera .env com JWT_SECRET / senha de banco / ADMIN_SENHA aleatorios

Anote a senha do Dono que o script imprime — ela só aparece uma vez.

## Backup

    sh ops/backup.sh

Gera em `./backups/` (configurável com `BACKUP_DIR`):
- `db-<stamp>.sql.gz` — `pg_dump --clean --if-exists`
- `uploads-<stamp>.tar.gz` — volume de comprovantes

Retenção local: `KEEP_DAYS` (padrão 21). Cópia externa: setar `RCLONE_REMOTE` (ex: `gdrive:pensador`)
depois de `rclone config`. Sem isso, o backup fica só no disco local — **não cumpre a RNF03**
(a regra exige cópia fora do notebook).

O dump `db-*.sql.gz` contém **todos os dados financeiros + os hashes de senha**. É gravado com
permissão `600`. Para copiar pra nuvem, **cifre**: setar `BACKUP_GPG_RECIPIENT` no `.env`
(o script passa a gerar `db-*.sql.gz.gpg`).

## Restore

    sh ops/restore.sh backups/db-<stamp>.sql.gz backups/uploads-<stamp>.tar.gz

Testar restauração de tempos em tempos (backup nunca testado não vale nada — seção 7.7 do doc).

## Migração notebook → VPS (checklist seção 7.5)

1. `sh ops/backup.sh` no notebook → copiar o par de arquivos pra VPS
2. subir o compose na VPS → `sh ops/restore.sh <db> <uploads>`
3. domínio + SSL (Let's Encrypt) — só na VPS, não coberto aqui

## Healthcheck

    sh ops/healthcheck.sh

Alerta só na virada de estado. Telegram: exportar `TELEGRAM_TOKEN` e `TELEGRAM_CHAT`.

## Redefinição de senha

**No dia a dia:** o Dono redefine a senha de qualquer usuário em Cadastros › Acesso e perfis
(editar o usuário → campo Senha). O Login não tem "Esqueci a senha" no piloto.

**Emergência (o Dono se trancou pra fora):** quem tem acesso ao host roda

    sh ops/reset-senha.sh dono@opensador.local

Pede a senha nova (oculta) e grava direto no banco, pelo container da API. Funciona mesmo
se a aplicação estiver sem ninguém logado.

**Último recurso:** `docker compose down -v` apaga tudo e o `bootstrapAdmin` recria o Dono a
partir de `ADMIN_EMAIL`/`ADMIN_SENHA` do `.env` — **perde todos os dados**, só use se não
houver backup.

**Ligar o "Esqueci a senha" (fase VPS):** basta setar `RESEND_API_KEY` (e `MAIL_FROM`) no
`.env` e redeployar. O backend passa a enviar o e-mail de verdade (via resend.com) e o botão
aparece sozinho no Login — **nenhuma mudança de código**. Outro provider (SMTP/SES): trocar só
a função `enviarEmail` em `api/src/email.js`.

## Cron

Ver `ops/crontab.example`.

## Checklist de segurança pré-Funnel/VPS (pendências deixadas de fora do piloto local)

O piloto roda com o proxy preso a `127.0.0.1` (sem TLS). Exposição planejada via
**Tailscale Funnel** (TLS terminado na borda da Tailscale, sem precisar de domínio/porta
própria) — item 1 abaixo não se aplica a esse caminho, só a uma VPS tradicional com domínio.

1. ~~TLS no proxy~~ — só necessário numa VPS tradicional com domínio próprio; via Tailscale
   Funnel o TLS é terminado na borda da Tailscale, nada a fazer aqui. Se um dia for VPS+domínio,
   copiar `proxy/nginx.tls.conf.example` por cima de `proxy/nginx.conf` e voltar a porta do
   `proxy` no `docker-compose.yml` para `443:443`/`80:80`.
2. ~~Comprovantes via URL assinada~~ — feito. `/comprovantes` agora exige `?exp=&sig=` (HMAC,
   TTL de 5 min, `auth.js#assinarComprovante`/`verificarAssinaturaComprovante`); a URL é obtida
   via `GET /uploads/comprovante-url?path=...` (autenticado, com ACL — ver item 6).
3. ~~Revogação de sessão~~ — feito. `usuarios.token_version` (migration `05_seguranca.sql`) no
   payload do JWT; trocar senha (`/auth/redefinir` e `PUT /usuarios/:id`) incrementa e invalida
   tokens antigos na hora, sem esperar o `JWT_EXPIRES` (12h).
4. ~~Lockout de conta~~ — feito. Além do limite por IP, 5 falhas seguidas bloqueiam a conta por
   15 min (`usuarios.tentativas_login`/`bloqueado_ate`, `routes/auth.js`).
5. ~~Log de auditoria~~ — feito. Tabela `eventos_auditoria` (migration `05_seguranca.sql`) via
   `api/src/auditoria.js#registrarEvento`: login, login falho, 401/403 (middleware de erro em
   `index.js`), estorno de receita/gasto/pagamento, reabertura de dia.
6. ~~ACL por comprovante~~ — feito. Dono lê qualquer comprovante; Caixa/Gerência só o do
   lançamento que ele mesmo criou (`routes/uploads.js#/comprovante-url`).
7. **Token no `localStorage`** (front) é roubável por XSS; a CSP no `nginx.spa.conf` mitiga
   (ainda com `'unsafe-inline'` em `script-src` — endurecer pra nonce/hash fica como evolução).
   Migração para cookie `HttpOnly` + CSRF também fica como evolução.
8. **`bootstrapAdmin`** tem corrida se a API rodar em >1 réplica (não é o caso do compose atual).
9. **`docker-compose.override.yml`** (dev-only, publica 5432/3000 no host) não pode existir no
   host que for expor via Funnel — nada no compose impede isso automaticamente, é checklist
   manual antes do primeiro `docker compose up` ali.
10. **`trust proxy`** (`index.js`, hoje `1`) assume só o nginx como proxy na frente. Ao ligar o
    Funnel, testar de fora da rede local que `req.ip`/rate-limit continuam vendo o IP público
    real do cliente (não o do nó da Tailscale) — ajustar o número se o Funnel adicionar um hop
    próprio de `X-Forwarded-For`.

**Migração 05 (token_version/lockout/auditoria) num volume de banco já existente:** o
`docker-entrypoint-initdb.d` só roda em volume novo. Se o Postgres do piloto já tiver dado, aplicar
manualmente: `docker compose exec -T db psql -U pensador -d pensador < db/migrations/05_seguranca.sql`.
