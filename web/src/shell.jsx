import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ThemeToggleIcon } from './components.jsx';
import logoBranco from './assets/logo-pensador.png';

// itens de navegacao: fonte unica, usada so aqui.
// short = rotulo curto pra barra inferior no celular.
const NAV = [
  { to: '/', end: true, label: 'Hoje', short: 'Hoje' },
  { to: '/livro-caixa', label: 'Livro-caixa', short: 'Caixa' },
  { to: '/painel', label: 'Painel', short: 'Painel' },
  { to: '/folha', label: 'Equipe', short: 'Equipe' },
  { to: '/config', label: 'Cadastros', short: 'Cadastros', dono: true },
  { to: '/importar', label: 'Importar', short: 'Importar', dono: true },
];

const cls = (extra = '') => ({ isActive }) => `navlink${isActive ? ' on' : ''}${extra}`;

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

export function Sidebar() {
  const { user } = useAuth();
  const [mais, setMais] = useState(false);
  const ref = useRef(null);
  const itens = NAV.filter((i) => !i.dono || user?.perfil === 'dono');
  const extras = itens.slice(2); // Equipe, Cadastros -> escondidos no celular, entram em "Mais"

  useEffect(() => {
    if (!mais) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setMais(false); };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [mais]);

  return (
    <nav className="sidebar" aria-label="Navegação principal">
      {itens.map((i, idx) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={cls(idx >= 2 ? ' navlink-extra' : '')}>
          <span className="nl-full">{i.label}</span>
          <span className="nl-short">{i.short}</span>
        </NavLink>
      ))}
      {extras.length > 0 && (
        <div className="mais" ref={ref}>
          <button type="button" className="navlink mais-btn" aria-expanded={mais}
            onClick={() => setMais((v) => !v)}>Mais</button>
          {mais && (
            <div className="mais-menu" onClick={() => setMais(false)}>
              {extras.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className={cls()}>{i.label}</NavLink>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="acct" ref={ref}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <UserIcon />
        <span className="acct-name">{user?.nome}</span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="acct-head">{user?.nome}<span>{user?.perfil}</span></div>
          <button type="button" role="menuitem" className="acct-item" onClick={logout}>Sair</button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user } = useAuth();
  return (
    <header className="appbar">
      <span className="brand">
        <img src={logoBranco} alt="O Pensador" className="brand-logo" />
        <span className="brand-role">{user?.perfil === 'dono' ? 'Dono' : 'Caixa'}</span>
      </span>
      <div className="appbar-right">
        <ThemeToggleIcon />
        <AccountMenu />
      </div>
    </header>
  );
}
