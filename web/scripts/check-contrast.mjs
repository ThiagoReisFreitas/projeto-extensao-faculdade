// Verifica razao de contraste WCAG dos pares do tema "Petróleo" nos 2 modos.
// Rodar: node scripts/check-contrast.mjs   (sai 1 se algum par abaixo do alvo)
// Alvo: texto de corpo >= 4.5:1 ; chrome/estado >= 3:1.

const L = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// espelha os tokens de web/src/styles.css (Petróleo)
const claro = {
  bg: '#eef2f5', surface: '#ffffff', surfaceTint: '#e2ecf3',
  text: '#0b1a26', muted: '#5a6b78',
  accent: '#0f4c81', accentSoft: '#3f9fd0', accentBright: '#7fd0f5',
  deepField: '#0f4c81', textOnDeep: '#eaf3fa', onAccent: '#eaf3fa',
  danger: '#b03a30',
};
const escuro = {
  bg: '#1a1d1f', surface: '#23282b', surfaceTint: '#2a3033',
  text: '#e6ecf0', muted: '#96a3ac',
  accent: '#3f9fd0', accentSoft: '#7fd0f5', accentBright: '#7fd0f5',
  deepField: '#0f2f47', textOnDeep: '#eaf3fa', onAccent: '#0c2029',
  danger: '#e08b81',
};

// [rotulo, fg, bg, alvo]
const pares = (t) => [
  ['texto/superficie', t.text, t.surface, 4.5],
  ['texto/fundo', t.text, t.bg, 4.5],
  ['muted/superficie', t.muted, t.surface, 4.5],
  ['muted/fundo', t.muted, t.bg, 4.5],
  ['accent/superficie (link)', t.accent, t.surface, 4.5],
  ['danger/superficie', t.danger, t.surface, 4.5],
  ['on-accent/botao primario', t.onAccent, t.accent, 4.5],
  ['text-on-deep/barra', t.textOnDeep, t.deepField, 4.5],
  ['accent/tint (chip on)', t.accent, t.surfaceTint, 3],
  ['dia-head accent/tint', t.accent, t.surfaceTint, 3],
];

let falhou = false;
for (const [modo, t] of [['CLARO', claro], ['ESCURO', escuro]]) {
  console.log(`\n== ${modo} ==`);
  for (const [rot, fg, bg, alvo] of pares(t)) {
    const r = ratio(fg, bg);
    const ok = r >= alvo;
    if (!ok) falhou = true;
    console.log(`${ok ? 'OK ' : 'XX '} ${r.toFixed(2).padStart(5)} (alvo ${alvo})  ${rot}`);
  }
}
if (falhou) { console.error('\nFALHOU: algum par abaixo do alvo de contraste.'); process.exit(1); }
console.log('\nTodos os pares passaram.');
