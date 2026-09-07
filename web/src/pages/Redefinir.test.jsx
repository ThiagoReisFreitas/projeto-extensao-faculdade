import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../toast.jsx';
import Redefinir from './Redefinir.jsx';

const res = (body, ok = true) => ({
  ok, status: ok ? 200 : 400,
  headers: { get: () => 'application/json' },
  json: async () => body, text: async () => JSON.stringify(body),
});

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(async () => res({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const setup = () => render(
  <MemoryRouter initialEntries={['/reset/abc123']}>
    <ToastProvider>
      <Routes><Route path="/reset/:token" element={<Redefinir />} /></Routes>
    </ToastProvider>
  </MemoryRouter>,
);

describe('Redefinir', () => {
  it('botão travado até as duas senhas baterem (>=8) e então chama /auth/redefinir', async () => {
    const user = userEvent.setup();
    setup();
    const btn = screen.getByRole('button', { name: /salvar nova senha/i });
    expect(btn).toBeDisabled();

    await user.type(document.getElementById('s1'), 'senhanova1');
    await user.type(document.getElementById('s2'), 'diferente1');
    expect(btn).toBeDisabled();
    expect(screen.getByText(/não batem/i)).toBeInTheDocument();

    await user.clear(document.getElementById('s2'));
    await user.type(document.getElementById('s2'), 'senhanova1');
    expect(btn).toBeEnabled();

    await user.click(btn);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/redefinir', expect.objectContaining({ method: 'POST' }));
  });
});
