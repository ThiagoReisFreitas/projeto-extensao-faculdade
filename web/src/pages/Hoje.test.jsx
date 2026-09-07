import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../toast.jsx';

let perfilAtual = 'dono';
let diaFechado = true;
vi.mock('../auth.jsx', () => ({
  useAuth: () => ({ user: { nome: 'T', perfil: perfilAtual }, login: vi.fn(), logout: vi.fn() }),
}));

import Hoje from './Hoje.jsx';

const res = (body) => ({
  ok: true, status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body, text: async () => JSON.stringify(body),
});

const receitaFake = {
  id: 1, criado_em: '2026-01-01T10:00:00Z', estorno_de_id: null,
  forma_pagamento_nome: 'PIX', operadora_nome: null,
  valor_liquido: 10, valor_bruto: 10, forma_pagamento_id: 2, operadora_id: null,
  data: '2026-01-01', observacao: null,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/fechamentos/')) return res({ data: '2026-01-01', fechado: diaFechado, registro: {} });
    if (u.includes('/fluxo/resumo')) return res({});
    if (u.includes('/receitas')) return res(diaFechado ? [] : [receitaFake]);
    return res([]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

const renderHoje = () => render(
  <MemoryRouter><ToastProvider><Hoje /></ToastProvider></MemoryRouter>,
);

describe('Hoje — reabrir dia fechado', () => {
  it('Dono vê "Reabrir o dia"', async () => {
    perfilAtual = 'dono'; diaFechado = true;
    renderHoje();
    expect(await screen.findByRole('button', { name: /reabrir o dia/i })).toBeInTheDocument();
  });

  it('Caixa não vê o botão de reabrir', async () => {
    perfilAtual = 'caixa'; diaFechado = true;
    renderHoje();
    await waitFor(() => expect(screen.getByText(/só o dono reabre/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /reabrir/i })).not.toBeInTheDocument();
  });
});

describe('Hoje — estorno só p/ Dono', () => {
  it('Dono vê "estornar" e "corrigir" na linha lançada', async () => {
    perfilAtual = 'dono'; diaFechado = false;
    renderHoje();
    expect(await screen.findByRole('button', { name: /^estornar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^corrigir$/i })).toBeInTheDocument();
  });

  it('Caixa não vê "estornar"/"corrigir" (só "duplicar")', async () => {
    perfilAtual = 'caixa'; diaFechado = false;
    renderHoje();
    expect(await screen.findByRole('button', { name: /^duplicar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^estornar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^corrigir$/i })).not.toBeInTheDocument();
  });
});
