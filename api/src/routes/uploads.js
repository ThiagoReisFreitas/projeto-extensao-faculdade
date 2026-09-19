import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { assinarComprovante } from '../auth.js';
import { comprovantePathValido, extensaoImagem } from '../validacao.js';

const BASE = '/app/uploads';
const TIPOS = ['receitas', 'gastos'];

// memoryStorage: precisamos do buffer p/ checar os bytes magicos antes de gravar.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES) || 2 * 1024 * 1024,
    files: 1,
    parts: 15,
  },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new HttpError(400, 'apenas imagens'));
    cb(null, true);
  },
});

const r = express.Router();

r.post('/:tipo', (req, res, next) => {
  if (!TIPOS.includes(req.params.tipo)) return next(new HttpError(400, 'tipo invalido'));
  upload.single('arquivo')(req, res, async (err) => {
    try {
      if (err) throw err.status ? err : new HttpError(400, err.message);
      if (!req.file) throw new HttpError(400, 'arquivo obrigatorio (campo "arquivo")');
      // MIME e do cliente; conferimos a assinatura real do arquivo e usamos a
      // extensao correspondente (nunca salvar JPEG/PNG/GIF sob nome .webp).
      const ext = extensaoImagem(req.file.buffer);
      if (!ext) throw new HttpError(400, 'arquivo nao parece uma imagem');

      const d = new Date();
      const dir = path.join(BASE, req.params.tipo, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
      await mkdir(dir, { recursive: true });
      const nome = `${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, nome), req.file.buffer);
      res.status(201).json({ comprovante_path: path.relative(BASE, path.join(dir, nome)) });
    } catch (e) {
      next(e instanceof HttpError ? e : new HttpError(400, e.message));
    }
  });
});

// gera a URL assinada de curta duracao pra exibir um comprovante ja gravado.
// Dono ve qualquer comprovante; Caixa/Gerencia so ve o do lancamento que ele
// mesmo criou (ACL por comprovante — nao ha campo de "dono do lancamento"
// alem de usuario_id, entao a checagem e feita direto nas duas tabelas).
r.get('/comprovante-url', ah(async (req, res) => {
  const caminho = String(req.query.path || '');
  if (!comprovantePathValido(caminho)) throw new HttpError(400, 'comprovante_path invalido');

  if (req.user.perfil !== 'dono') {
    const { rows } = await q(
      `SELECT 1 FROM receitas WHERE comprovante_path = $1 AND usuario_id = $2
       UNION ALL
       SELECT 1 FROM gastos WHERE comprovante_path = $1 AND usuario_id = $2`,
      [caminho, req.user.id],
    );
    if (!rows[0]) throw new HttpError(403, 'sem acesso a este comprovante');
  }

  res.json({ url: assinarComprovante(caminho) });
}));

export default r;
