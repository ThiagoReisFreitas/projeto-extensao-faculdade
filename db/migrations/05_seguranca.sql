-- Hardening pre-Funnel (exposicao publica via Tailscale Funnel).

-- Revogacao de sessao: token_version no JWT (auth.js#assinarToken); trocar
-- senha ou "sair de todos os dispositivos" incrementa e invalida tokens
-- antigos na hora, sem esperar o JWT_EXPIRES (12h) expirar sozinho.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;

-- Lockout de conta por usuario (alem do rate-limit por IP em routes/auth.js):
-- atacante distribuido nao e freado so por IP.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_login INT NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMPTZ;

-- Log de auditoria: login, logout, 401/403, estorno, reabertura de dia.
-- usuario_id fica NULL em eventos sem sessao valida (login falho, 401).
CREATE TABLE IF NOT EXISTS eventos_auditoria (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuarios(id),
  tipo TEXT NOT NULL,
  detalhe JSONB,
  ip TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eventos_auditoria_criado_em_idx ON eventos_auditoria (criado_em);
