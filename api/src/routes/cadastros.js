import express from 'express';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { somenteDono, bcrypt } from '../auth.js';
import { senhaForte, restariaAlgumDono } from '../validacao.js';

// CRUD generico p/ tabelas de dimensao simples. table/cols sao controlados
// pelo codigo (nao entrada do usuario) -> seguro interpolar identificadores.
// Sem DELETE: desativar = PUT com ativo=false (doc secao 3.6).
function crudRouter({ table, cols }) {
  const r = express.Router();

  r.get('/', ah(async (_req, res) => {
    const { rows } = await q(`SELECT * FROM ${table} ORDER BY id`);
    res.json(rows);
  }));

  r.post('/', somenteDono, ah(async (req, res) => {
    const vals = cols.map((c) => req.body[c]);
    const ph = cols.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await q(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${ph}) RETURNING *`, vals,
    );
    res.status(201).json(rows[0]);
  }));

  r.put('/:id', somenteDono, ah(async (req, res) => {
    // so atualiza colunas presentes no body (evita NULL em campo NOT NULL num PUT parcial)
    const usar = cols.filter((c) => req.body[c] !== undefined);
    if (!usar.length) throw new HttpError(400, 'nada para atualizar');
    const set = usar.map((c, i) => `${c} = $${i + 1}`).join(',');
    const vals = [...usar.map((c) => req.body[c]), req.params.id];
    const { rows } = await q(
      `UPDATE ${table} SET ${set} WHERE id = $${vals.length} RETURNING *`, vals,
    );
    if (!rows.length) throw new HttpError(404, 'registro nao encontrado');
    res.json(rows[0]);
  }));

  return r;
}

export const operadorasRouter = crudRouter({
  table: 'operadoras_cartao',
  cols: ['nome', 'taxa_debito', 'taxa_credito_vista', 'taxa_credito_parcelado', 'ativo'],
});

export const formasPagamentoRouter = crudRouter({
  table: 'formas_pagamento',
  cols: ['nome', 'requer_operadora', 'tipo_taxa', 'ativo'],
});

export const categoriasRouter = crudRouter({
  table: 'categorias_gasto',
  cols: ['nome', 'ativo'],
});

export const funcionariosRouter = crudRouter({
  table: 'funcionarios',
  cols: ['nome', 'tipo_vinculo', 'valor_referencia', 'ativo'],
});

// usuarios: precisa hash de senha -> nao usa o crud generico
export const usuariosRouter = (() => {
  const r = express.Router();
  r.use(somenteDono);

  r.get('/', ah(async (_req, res) => {
    const { rows } = await q('SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY id');
    res.json(rows);
  }));

  r.post('/', ah(async (req, res) => {
    const { nome, email, senha, perfil } = req.body || {};
    if (!nome || !email || !senha || !perfil) throw new HttpError(400, 'nome, email, senha e perfil obrigatorios');
    if (!['dono', 'caixa'].includes(perfil)) throw new HttpError(400, 'perfil invalido');
    if (!senhaForte(senha)) throw new HttpError(400, 'senha precisa de pelo menos 8 caracteres');
    const hash = await bcrypt.hash(senha, 10);
    try {
      const { rows } = await q(
        `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1,$2,$3,$4)
         RETURNING id, nome, email, perfil, ativo`,
        [nome, email, hash, perfil],
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'email ja cadastrado');
      throw e;
    }
  }));

  r.put('/:id', ah(async (req, res) => {
    const { nome, perfil, ativo, senha } = req.body || {};
    if (perfil !== undefined && !['dono', 'caixa'].includes(perfil)) throw new HttpError(400, 'perfil invalido');
    if (senha && !senhaForte(senha)) throw new HttpError(400, 'senha precisa de pelo menos 8 caracteres');

    // nao deixa a alteracao zerar os donos ativos (lockout)
    if (perfil === 'caixa' || ativo === false) {
      const { rows: us } = await q('SELECT id, perfil, ativo FROM usuarios');
      if (!restariaAlgumDono(us, { id: req.params.id, perfil, ativo })) {
        throw new HttpError(409, 'precisa sobrar pelo menos um Dono ativo');
      }
    }

    const sets = [];
    const vals = [];
    if (nome !== undefined) { vals.push(nome); sets.push(`nome = $${vals.length}`); }
    if (perfil !== undefined) { vals.push(perfil); sets.push(`perfil = $${vals.length}`); }
    if (ativo !== undefined) { vals.push(ativo); sets.push(`ativo = $${vals.length}`); }
    if (senha) { vals.push(await bcrypt.hash(senha, 10)); sets.push(`senha_hash = $${vals.length}`); }
    if (!sets.length) throw new HttpError(400, 'nada para atualizar');
    vals.push(req.params.id);
    const { rows } = await q(
      `UPDATE usuarios SET ${sets.join(',')} WHERE id = $${vals.length}
       RETURNING id, nome, email, perfil, ativo`, vals,
    );
    if (!rows.length) throw new HttpError(404, 'usuario nao encontrado');
    res.json(rows[0]);
  }));

  return r;
})();
