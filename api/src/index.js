import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import { HttpError } from './http.js';
import {
  authObrigatorio, authHeaderOuQuery, bootstrapAdmin, somenteDono, assertConfigSeguranca,
} from './auth.js';
import authRoutes from './routes/auth.js';
import {
  operadorasRouter, formasPagamentoRouter, categoriasRouter,
  funcionariosRouter, usuariosRouter,
} from './routes/cadastros.js';
import receitasRoutes from './routes/receitas.js';
import gastosRoutes from './routes/gastos.js';
import pagamentosRoutes from './routes/pagamentos.js';
import fechamentosRoutes from './routes/fechamentos.js';
import fluxoRoutes from './routes/fluxo.js';
import uploadsRoutes from './routes/uploads.js';
import importacaoRoutes from './routes/importacao.js';

assertConfigSeguranca(); // aborta antes de servir se JWT_SECRET/ADMIN_SENHA nao prestarem

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // atras do nginx: usa X-Forwarded-For real p/ rate-limit

// CORS: em producao o front chama /api na mesma origem (nginx) -> nada de CORS.
// dev cross-porta: setar CORS_ORIGIN=http://localhost:5173 no .env
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false }));
app.use(express.json({ limit: '200kb' }));

// headers de seguranca em toda resposta (inclui /comprovantes)
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

// rate-limit global modesto (alem do especifico de login em routes/auth.js)
const limiter = (limit) => rateLimit({ windowMs: 5 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false });
app.use(limiter(300));

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});

app.use('/auth', authRoutes);

// comprovantes: static do volume de uploads, atras de auth (RNF01 — dado sensivel)
app.use('/comprovantes', authHeaderOuQuery, express.static('/app/uploads', {
  fallthrough: false,
  setHeaders(res) {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
  },
}));

// tudo abaixo exige login
app.use(authObrigatorio);
app.use('/usuarios', usuariosRouter);
app.use('/operadoras', operadorasRouter);
app.use('/formas-pagamento', formasPagamentoRouter);
app.use('/categorias', categoriasRouter);
app.use('/funcionarios', funcionariosRouter);
app.use('/receitas', receitasRoutes);
app.use('/gastos', gastosRoutes);
app.use('/pagamentos', pagamentosRoutes);
app.use('/fechamentos', fechamentosRoutes);
app.use('/fluxo', fluxoRoutes);
app.use('/uploads', limiter(40), uploadsRoutes);
app.use('/importacao', limiter(120), somenteDono, importacaoRoutes);

app.use((_req, res) => res.status(404).json({ error: 'rota nao encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  // 500 nao vaza detalhe interno (erro do pg, nome de constraint) pro cliente
  res.status(status).json({ error: status === 500 ? 'erro interno' : (err.message || 'erro') });
});

const PORT = process.env.PORT || 3000;
bootstrapAdmin()
  .then(() => app.listen(PORT, () => console.log(`API on :${PORT}`)))
  .catch((e) => { console.error('falha no boot', e); process.exit(1); });
