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
});
