import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../toast.jsx';
import Importar from './Importar.jsx';

const res = (body, ok = true, status = 200) => ({
  ok, status,
  headers: { get: () => 'application/json' },
  json: async () => body, text: async () => JSON.stringify(body),
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/importacao/') && String(url).includes('/preview')) {
      return res({ colunas: ['Quando', 'Quanto', 'Tipo'], amostra: [{ Quando: '01/09/2026', Quanto: '10,00', Tipo: 'Insumos' }], total: 1 });
    }
    return res([]); // /categorias, /formas-pagamento, /funcionarios
  }));
});
afterEach(() => vi.unstubAllGlobals());

const setup = () => render(<ToastProvider><Importar /></ToastProvider>);

describe('Importar', () => {
  it('após ler o CSV mostra os selects de mapeamento e trava o import enquanto faltar campo', async () => {
    const user = userEvent.setup();
    setup();

    const file = new File(['Quando;Quanto;Tipo\n01/09/2026;10,00;Insumos'], 'gastos.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/planilha csv/i), file);
    await user.click(screen.getByRole('button', { name: /ler colunas/i }));

    const selData = await screen.findByLabelText(/^Data \*/i);
    expect(selData).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Quando' }).length).toBeGreaterThan(0);

    const btn = screen.getByRole('button', { name: /importar 1 linha/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/falta mapear/i)).toBeInTheDocument();

    await user.selectOptions(selData, 'Quando');
    await user.selectOptions(screen.getByLabelText(/^Valor \*/i), 'Quanto');
    await user.selectOptions(screen.getByLabelText(/^Categoria \*/i), 'Tipo');
    expect(btn).toBeEnabled();
  });
});
