import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../toast.jsx';
import { FechamentoModal } from './Fechamento.jsx';

const res = (body) => ({
  ok: true, status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body, text: async () => JSON.stringify(body),
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/receitas')) {
      return res([{ id: 1, estorno_de_id: null, forma_pagamento_nome: 'PIX', operadora_id: null, valor_bruto: 100, valor_liquido: 100, comprovante_path: 'x' }]);
    }
    if (u.includes('/gastos')) {
      return res([{ id: 5, estorno_de_id: null, categoria_nome: 'Insumos', descricao: 'batata', valor: 30, comprovante_path: null }]);
    }
    if (u.includes('/pagamentos')) {
      return res([{ id: 8, estorno_de_id: null, funcionario_nome: 'Maria', periodo_referencia: 'diária', valor: 45 }]);
    }
    return res([]); // /categorias
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('FechamentoModal', () => {
  it('lista gastos e folha e mostra o resultado do dia', async () => {
    render(
      <ToastProvider>
        <FechamentoModal data="2026-09-03" onClose={() => {}} onFechado={() => {}} />
      </ToastProvider>,
    );

    expect(await screen.findByText(/gastos do dia/i)).toBeInTheDocument();
    expect(screen.getByText(/Insumos · batata/)).toBeInTheDocument();
    expect(screen.getByText(/folha do dia/i)).toBeInTheDocument();
    expect(screen.getByText(/Maria · diária/)).toBeInTheDocument();
    expect(screen.getByText(/resultado do dia/i)).toBeInTheDocument();
    // 100 receita liq - 30 gasto - 45 folha = 25
    expect(screen.getByText('R$ 25,00')).toBeInTheDocument();
  });
});
