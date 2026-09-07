import { useEffect, useState } from 'react';

// preferencia: 'light' | 'dark' | 'system'  (system = sem chave, segue o SO)
const KEY = 'pensador_theme';
const root = document.documentElement;
const mq = () => matchMedia('(prefers-color-scheme: dark)');

export const getPref = () => {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
};

function apply(pref) {
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function setPref(pref) {
  if (pref === 'system') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, pref);
  apply(pref);
}

// se a preferencia for "system", acompanha a troca do SO
export function initTheme() {
  mq().addEventListener('change', () => { if (getPref() === 'system') apply('system'); });
}

export function isDarkNow() {
  const p = getPref();
  return p === 'dark' || (p === 'system' && mq().matches);
}

// re-renderiza quando o tema efetivo muda (troca de preferencia ou do SO)
export function useIsDark() {
  const [dark, setDark] = useState(isDarkNow);
  useEffect(() => {
    const on = () => setDark(isDarkNow());
    const m = mq();
    m.addEventListener('change', on);
    const mo = new MutationObserver(on);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { m.removeEventListener('change', on); mo.disconnect(); };
  }, []);
  return dark;
}

export function useThemePref() {
  const [pref, setLocal] = useState(getPref);
  return [pref, (v) => { setPref(v); setLocal(v); }];
}
