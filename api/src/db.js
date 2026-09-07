import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000, // mata query travada -> nao segura conexao do pool
});

// helper: query curto
export const q = (text, params) => pool.query(text, params);
