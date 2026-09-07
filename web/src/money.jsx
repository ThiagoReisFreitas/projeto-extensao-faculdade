import { brl } from './api.js';

// Um valor monetario, um formato: "R$ 1.204,50", sempre.
// Negativo com sinal "−" explicito (distinguivel sem cor) + cor de alerta.
// sign=true colore de positivo quando > 0 (usar so onde o sinal e semantico: saldo).
export function Money({ value, sign = false }) {
  const n = Number(value || 0);
  const neg = n < 0;
  const cls = neg ? 'money--neg' : sign && n > 0 ? 'money--pos' : '';
  return (
    <span className={`money ${cls}`.trim()}>{neg ? '−' : ''}{brl(Math.abs(n))}</span>
  );
}
