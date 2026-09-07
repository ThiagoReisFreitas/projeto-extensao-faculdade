import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useThemePref } from './theme.js';
import { comprimir } from './img.js';

/* ---- icones inline (traco = currentColor) ---- */
const Sun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);
const Monitor = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>
);
const Camera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
  </svg>
);
const Inbox = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const Eye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9 9 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-1.7 2.7M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a9 9 0 0 0 5.4-1.8M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" />
  </svg>
);

// alternador de tema em 3 estados. Usado no menu da conta e no login.
// icone no header: 1 clique cicla o tema. Automatico -> Claro -> Escuro -> ...
export function ThemeToggleIcon() {
  const [pref, setPref] = useThemePref();
  const proximo = { system: 'light', light: 'dark', dark: 'system' };
  const rotulo = { system: 'Tema: automático (segue o sistema)', light: 'Tema: claro', dark: 'Tema: escuro' };
  const Icone = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;
  return (
    <button type="button" className="icon-btn" title={rotulo[pref]}
      aria-label={`${rotulo[pref]}. Clicar para trocar.`}
      onClick={() => setPref(proximo[pref])}>
      <Icone />
    </button>
  );
}

export function EmptyState({ children, action }) {
  return (
    <div className="empty">
      <Inbox />
      <span>{children || 'Nenhum lançamento no período'}</span>
      {action}
    </div>
  );
}

// Input de foto: botao estilizado + compressao no ato + miniatura.
// onChange recebe o File webp comprimido (ou null ao remover).
export function FotoInput({ onChange, label = 'Adicionar foto' }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const webp = await comprimir(file);
      setPreview((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(webp); });
      onChange(webp);
    } finally { setBusy(false); }
  };

  const clear = () => {
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
    onChange(null);
  };

  if (preview) {
    return (
      <div className="foto-prev">
        <img src={preview} alt="Prévia do comprovante" />
        <button type="button" className="link" onClick={clear}>remover foto</button>
      </div>
    );
  }
  return (
    <label className="foto-btn">
      <Camera />
      {busy ? 'comprimindo…' : label}
      <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
    </label>
  );
}

// Campo de senha com botao "olho" pra revelar/ocultar. Usado no Login e nos Cadastros.
export function SenhaInput({ id, value, onChange, autoComplete = 'new-password', required = false, placeholder }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="senha-campo">
      <input id={id} type={ver ? 'text' : 'password'} autoComplete={autoComplete}
        value={value} onChange={onChange} required={required} placeholder={placeholder} />
      <button type="button" className="senha-olho" aria-pressed={ver}
        aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVer((v) => !v)}>
        {ver ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

const X = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// Modal reutilizavel: overlay escurece o fundo, card centralizado.
// Fecha (descarta) por: botao X, botao Cancelar do conteudo, clique no overlay, Esc.
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// Confirmacao de estorno com motivo obrigatorio. Substitui o prompt() nas telas.
// onConfirmar(motivo) -> Promise; o modal cuida do estado "enviando".
export function EstornoModal({ resumo, onConfirmar, onClose }) {
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const enviar = async () => {
    setBusy(true);
    try { await onConfirmar(motivo.trim()); }
    catch { setBusy(false); }
  };
  return (
    <Modal title="Estornar lançamento" onClose={onClose}>
      {resumo && <p className="muted" style={{ margin: '0 0 4px' }}>{resumo}</p>}
      <Label htmlFor="mot-estorno">Motivo do estorno</Label>
      <textarea id="mot-estorno" rows={3} value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="ex: valor digitado errado, lançamento em duplicidade" />
      <p className="muted" style={{ marginTop: 6 }}>
        O lançamento não é apagado: entra uma linha de estorno vinculada, com este motivo.
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" disabled={busy || !motivo.trim()} onClick={enviar}>
          {busy ? 'estornando…' : 'Estornar'}
        </button>
        <button type="button" className="sec" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

// Confirmacao sim/nao interna (substitui o confirm() do navegador).
export function ConfirmModal({ titulo = 'Confirmar', mensagem, confirmarLabel = 'Confirmar', perigo = false, onConfirmar, onClose }) {
  const [busy, setBusy] = useState(false);
  const ir = async () => {
    setBusy(true);
    try { await onConfirmar(); }
    catch { setBusy(false); }
  };
  return (
    <Modal title={titulo} onClose={onClose}>
      {mensagem && <p style={{ margin: '0 0 4px' }}>{mensagem}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className={perigo ? 'danger' : undefined} disabled={busy} onClick={ir}>
          {busy ? 'aguarde…' : confirmarLabel}
        </button>
        <button type="button" className="sec" disabled={busy} onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

// Layout de duas colunas (form + lista) compartilhado por Receitas, Gastos e Folha.
// align-items:start (no CSS de .page) garante que as colunas comecam na mesma linha.
export function SplitPage({ title, listTitle = 'Lançamentos no período', form, list }) {
  return (
    <div className="page page--split">
      <div className="col-form">
        <h1>{title}</h1>
        {form}
      </div>
      <div className="col-list">
        <h2 className="col-title">{listTitle}</h2>
        {list}
      </div>
    </div>
  );
}

// Ajuda contextual: icone "?" ao lado do rotulo. Abre no CLIQUE (funciona no toque),
// fecha em clique-fora / Esc / clicar de novo. Fechado por padrao.
export function CampoAjuda({ texto, rotulo = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      const w = Math.min(240, window.innerWidth * 0.72);
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) });
    };
    place();
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="ajuda">
      <button ref={btnRef} type="button" className="ajuda-btn" aria-expanded={open}
        aria-label={rotulo ? `Ajuda sobre ${rotulo}` : 'Ajuda'}
        onClick={() => setOpen((o) => !o)}>?</button>
      {open && pos && createPortal(
        <span ref={popRef} className="ajuda-pop" role="tooltip"
          style={{ top: pos.top, left: pos.left }}>{texto}</span>,
        document.body,
      )}
    </span>
  );
}

// Drop-in do <label>: mesmo texto + "?" opcional. Usar em todos os formularios.
export function Label({ htmlFor, ajuda, children }) {
  return (
    <div className="lbl-row">
      <label htmlFor={htmlFor}>{children}</label>
      {ajuda ? <CampoAjuda texto={ajuda} rotulo={typeof children === 'string' ? children : ''} /> : null}
    </div>
  );
}
