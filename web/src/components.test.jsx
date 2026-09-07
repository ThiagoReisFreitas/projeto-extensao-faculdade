import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SenhaInput, EstornoModal, ConfirmModal } from './components.jsx';

describe('SenhaInput', () => {
  it('começa oculto e o botão olho alterna o type', async () => {
    const user = userEvent.setup();
    render(<SenhaInput id="s" value="segredo" onChange={() => {}} />);
    const input = document.getElementById('s');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /mostrar senha/i }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /ocultar senha/i }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

describe('EstornoModal', () => {
  it('só habilita "Estornar" com um motivo e repassa o texto', async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue();
    render(<EstornoModal resumo="PIX · R$ 10,00" onConfirmar={onConfirmar} onClose={() => {}} />);

    const btn = screen.getByRole('button', { name: /^estornar$/i });
    expect(btn).toBeDisabled();

    await user.type(screen.getByLabelText(/motivo do estorno/i), 'valor errado');
    expect(btn).toBeEnabled();

    await user.click(btn);
    expect(onConfirmar).toHaveBeenCalledWith('valor errado');
  });
});

describe('ConfirmModal', () => {
  it('"Confirmar" (perigo) tem a classe danger e chama onConfirmar', async () => {
    const user = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue();
    render(<ConfirmModal titulo="Reabrir" mensagem="tem certeza?" confirmarLabel="Reabrir"
      perigo onConfirmar={onConfirmar} onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /^reabrir$/i });
    expect(btn).toHaveClass('danger');
    await user.click(btn);
    expect(onConfirmar).toHaveBeenCalled();
  });

  it('"Cancelar" chama onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConfirmModal mensagem="x" onConfirmar={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
