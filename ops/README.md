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

## Checklist de segurança pré-VPS (pendências deixadas de fora do piloto local)

O piloto roda com o proxy preso a `127.0.0.1` (sem TLS). Antes de expor na LAN ou VPS:

1. **TLS no proxy** — copiar `proxy/nginx.tls.conf.example` por cima de `proxy/nginx.conf`,
   montar certificados (self-signed na LAN, Let's Encrypt na VPS) e voltar a porta do `proxy`
   no `docker-compose.yml` para `443:443` / `80:80`.
2. **Comprovantes via URL assinada** — hoje `/comprovantes` aceita `?token=` (o token pode
   vazar em log/histórico). Trocar por URL assinada de curta duração (doc §10).
3. **Revogação de sessão** — JWT vale 12 h e não é revogável fora do `/auth/me`. Adicionar
   `token_version` no usuário e invalidar tokens antigos em troca de senha / desativação.
4. **Lockout de conta** — hoje só há limite por IP no login. Bloquear a conta após N falhas.
5. **Log de auditoria** — registrar login, logout, 401/403 e ações de estorno/reabertura.
6. **ACL por comprovante** — qualquer usuário autenticado lê qualquer arquivo; restringir ao
   dono do lançamento se necessário.
7. **Token no `localStorage`** (front) é roubável por XSS; a CSP no `nginx.spa.conf` mitiga.
   Migração para cookie `HttpOnly` + CSRF fica como evolução.
8. **`bootstrapAdmin`** tem corrida se a API rodar em >1 réplica (não é o caso do compose atual).
