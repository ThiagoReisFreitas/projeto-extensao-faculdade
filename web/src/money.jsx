import { brl } from './api.js';

// "1.234,56" (digitado no padrao BR, com separador de milhar) -> 1234.56.
// So trocar a 1a virgula por ponto (sem tirar os pontos de milhar) quebra em
// qualquer valor >= 1000; NaN vira 0 pra nao travar silenciosamente o form.
export function parseBRL(s) {
  const limpo = String(s ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

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
