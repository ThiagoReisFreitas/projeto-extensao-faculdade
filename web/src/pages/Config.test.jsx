import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../toast.jsx';
import Config from './Config.jsx';

const jsonRes = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

beforeEach(() => {
  // toda lista carrega vazia
  vi.stubGlobal('fetch', vi.fn(async () => jsonRes([])));
});
afterEach(() => vi.unstubAllGlobals());

const renderConfig = () => render(<ToastProvider><Config /></ToastProvider>);

describe('Cadastros', () => {
  it('seção vazia mostra exatamente um botão "+ novo" (sem o duplicado do estado-vazio)', async () => {
    renderConfig();
    // 5 seções, todas vazias -> 1 botão cada, nunca 2
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '+ novo' })).toHaveLength(5);
    });
  });

  it('o formulário de novo usuário tem o botão de mostrar senha', async () => {
    const user = userEvent.setup();
    renderConfig();
    const botoes = await screen.findAllByRole('button', { name: '+ novo' });
    await user.click(botoes[4]); // última seção = "Acesso e perfis"
    const dialog = await screen.findByRole('dialog', { name: /Acesso e perfis/i });
    expect(within(dialog).getByRole('button', { name: /mostrar senha/i })).toBeInTheDocument();
  });

  it('rebaixar o único Dono ativo é bloqueado no cliente, sem chamar a API', async () => {
    const user = userEvent.setup();
    const dono = { id: 1, nome: 'Dono', email: 'dono@x.com', perfil: 'dono', ativo: true };
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      if (String(url).includes('/usuarios') && (!opts?.method || opts.method === 'GET')) return jsonRes([dono]);
      if (String(url).includes('/usuarios') && opts?.method === 'PUT') {
        throw new Error('nao deveria chamar a API — o cliente ja devia ter bloqueado');
      }
      return jsonRes([]);
    }));

    renderConfig();
    const editar = await screen.findByRole('button', { name: 'editar' });
    await user.click(editar);
    const dialog = await screen.findByRole('dialog', { name: /Acesso e perfis/i });
    const combos = within(dialog).getAllByRole('combobox');
    const perfilSelect = combos.find((el) => Array.from(el.options).some((o) => o.value === 'dono'));
    await user.selectOptions(perfilSelect, 'caixa');
    await user.click(within(dialog).getByRole('button', { name: /salvar/i }));

    expect(await within(dialog).findByText(/pelo menos um Dono ativo/i)).toBeInTheDocument();
  });
});
