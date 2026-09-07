import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../http.js';
import { imagemValida } from '../validacao.js';

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
      // MIME e do cliente; conferimos a assinatura real do arquivo.
      if (!imagemValida(req.file.buffer)) throw new HttpError(400, 'arquivo nao parece uma imagem');

      const d = new Date();
      const dir = path.join(BASE, req.params.tipo, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
      await mkdir(dir, { recursive: true });
      const nome = `${randomUUID()}.webp`;
      await writeFile(path.join(dir, nome), req.file.buffer);
      res.status(201).json({ comprovante_path: path.relative(BASE, path.join(dir, nome)) });
    } catch (e) {
      next(e instanceof HttpError ? e : new HttpError(400, e.message));
    }
  });
});

export default r;
