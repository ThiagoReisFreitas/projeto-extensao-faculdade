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

// dropdown proprio: clica no botao do campo e depois na opcao
const escolher = async (user, labelRe, optName) => {
  await user.click(screen.getByLabelText(labelRe));
  await user.click(await screen.findByRole('option', { name: optName }));
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/importacao/') && String(url).includes('/preview')) {
      return res({ colunas: ['Quando', 'Quanto', 'Tipo'], amostra: [{ Quando: '01/09/2026', Quanto: '10,00', Tipo: 'Insumos' }], total: 1, abas: [], cabecalho_linha: 1 });
    }
    return res([]); // /categorias, /formas-pagamento, /funcionarios
  }));
});
afterEach(() => vi.unstubAllGlobals());

const setup = () => render(<ToastProvider><Importar /></ToastProvider>);

describe('Importar', () => {
  it('após ler o CSV mostra os campos de mapeamento e trava o import enquanto faltar campo', async () => {
    const user = userEvent.setup();
    setup();

    const file = new File(['Quando;Quanto;Tipo\n01/09/2026;10,00;Insumos'], 'gastos.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('Planilha CSV ou Excel'), file);
    await user.click(screen.getByRole('button', { name: /ler colunas/i }));

    expect(await screen.findByLabelText(/^Data \*/i)).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: /importar 1 linha/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/falta mapear/i)).toBeInTheDocument();

    await escolher(user, /^Data \*/i, 'Quando');
    await escolher(user, /^Valor \*/i, 'Quanto');
    await escolher(user, /^Categoria \*/i, 'Tipo');
    expect(btn).toBeEnabled();
  });

  it('"Validar antes de importar" mostra diagnóstico (aproximações + linhas ignoradas) sem importar', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('/preview')) {
        return res({ colunas: ['Quando', 'Quanto', 'Tipo'], amostra: [{ Quando: '01/09', Quanto: '10,00', Tipo: 'gás' }], total: 2, abas: [], cabecalho_linha: 1 });
      }
      if (String(url).includes('/importacao/gastos')) {
        return res({ simulado: true, ok: 1, erros: [], ignoradas: [{ linha: 2, motivo: 'linha de total/resumo' }], casamentos: [{ campo: 'categoria', de: 'gás', para: 'Gas' }] });
      }
      return res([]);
    }));

    setup();
    await user.upload(screen.getByLabelText('Planilha CSV ou Excel'), new File(['x'], 'g.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: /ler colunas/i }));
    await escolher(user, /^Data \*/i, 'Quando');
    await escolher(user, /^Valor \*/i, 'Quanto');
    await escolher(user, /^Categoria \*/i, 'Tipo');

    await user.click(screen.getByRole('button', { name: /validar antes de importar/i }));

    expect(await screen.findByText(/Tudo certo:/i)).toBeInTheDocument();
    expect(screen.getByText(/Aproximações usadas/i)).toBeInTheDocument();
    expect(screen.getByText(/1 linha\(s\) ignorada/i)).toBeInTheDocument();
  });
});
