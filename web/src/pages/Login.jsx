import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useIsDark } from '../theme.js';
import { ThemeToggleIcon, SenhaInput } from '../components.jsx';
import logoTinta from '../assets/logo-pensador-tinta.png';
import logoBranco from '../assets/logo-pensador.png';

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const dark = useIsDark();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [manter, setManter] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ajuda, setAjuda] = useState(false);
  const [recado, setRecado] = useState('');
  const [resetEmail, setResetEmail] = useState(false); // e-mail de reset ligado no servidor?

  // liga o "Esqueci a senha" só quando o servidor tem envio de e-mail configurado
  useEffect(() => {
    api.get('/auth/config').then((c) => setResetEmail(!!c.resetEmail)).catch(() => {});
  }, []);

  if (user) { nav('/', { replace: true }); return null; }

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await login(email, senha, manter); nav('/', { replace: true }); }
    catch (e) {
      setErr(/credenc|invalid|senha|401/i.test(e.message) ? 'E-mail ou senha incorretos.' : e.message);
    } finally { setBusy(false); }
  };

  const esqueci = async () => {
    setRecado(''); setBusy(true);
    try {
      await api.post('/auth/esqueci', { email });
      setRecado('Se o e-mail existir, enviamos um link para redefinir a senha. Verifique a caixa de entrada.');
    } catch (e) { setRecado(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-tema"><ThemeToggleIcon /></div>
        <img src={dark ? logoBranco : logoTinta} alt="O Pensador — Restaurante" className="login-logo" />
        <p className="muted" style={{ margin: '0 0 16px', textAlign: 'center' }}>Controle de caixa do dia.</p>

        {err && <div className="err" role="alert" style={{ marginBottom: 12 }}>{err}</div>}

        <form className="card" onSubmit={submit}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" inputMode="email" autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />

          <label htmlFor="senha">Senha</label>
          <SenhaInput id="senha" autoComplete="current-password" required
            value={senha} onChange={(e) => setSenha(e.target.value)} />

          <label className="check">
            <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} />
            Manter conectado
          </label>

          <div style={{ marginTop: 16 }}>
            <button disabled={busy}>{busy ? 'entrando…' : 'Entrar'}</button>
          </div>

          <button type="button" className="link" style={{ marginTop: 10 }}
            onClick={() => { setAjuda((v) => !v); setRecado(''); }}>
            {resetEmail ? 'Esqueci a senha' : 'Não consigo entrar'}
          </button>

          {ajuda && !resetEmail && (
            <p className="muted" style={{ marginTop: 6 }}>
              As contas são do Dono. Se esqueceu a senha, peça a ele — ele redefine em
              Cadastros › Acesso e perfis e te passa a nova.
            </p>
          )}
          {ajuda && resetEmail && (
            <div style={{ marginTop: 8 }}>
              <p className="muted" style={{ margin: '0 0 6px' }}>Informe seu e-mail e enviaremos um link.</p>
              <div className="row">
                <input type="email" inputMode="email" placeholder="seu e-mail"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="button" className="sec" disabled={busy || !email} onClick={esqueci}>
                  Enviar link
                </button>
              </div>
              {recado && <p className="muted" style={{ marginTop: 6 }}>{recado}</p>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
