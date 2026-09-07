import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useIsDark } from '../theme.js';
import { SenhaInput } from '../components.jsx';
import { useToast } from '../toast.jsx';
import logoTinta from '../assets/logo-pensador-tinta.png';
import logoBranco from '../assets/logo-pensador.png';

export default function Redefinir() {
  const { token } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const dark = useIsDark();
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const podeSalvar = s1.length >= 8 && s1 === s2;

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await api.post('/auth/redefinir', { token, senha: s1 });
      toast('Senha redefinida — entre com a nova senha');
      nav('/login', { replace: true });
    } catch (e) {
      setErr(/expirad|invalid|400/i.test(e.message)
        ? 'Este link expirou ou não é mais válido. Peça um novo em "Esqueci a senha".'
        : e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src={dark ? logoBranco : logoTinta} alt="O Pensador" className="login-logo" />
        <h1 style={{ textAlign: 'center' }}>Nova senha</h1>

        {err && <div className="err" role="alert" style={{ marginBottom: 12 }}>{err}</div>}

        <form className="card" onSubmit={submit}>
          <label htmlFor="s1">Nova senha <span className="muted">(mínimo 8 caracteres)</span></label>
          <SenhaInput id="s1" autoComplete="new-password" required value={s1} onChange={(e) => setS1(e.target.value)} />

          <label htmlFor="s2">Repita a nova senha</label>
          <SenhaInput id="s2" autoComplete="new-password" required value={s2} onChange={(e) => setS2(e.target.value)} />
          {s2 && s1 !== s2 && <p className="err" style={{ margin: '6px 0 0' }}>As senhas não batem.</p>}

          <div style={{ marginTop: 16 }}>
            <button disabled={busy || !podeSalvar}>{busy ? 'salvando…' : 'Salvar nova senha'}</button>
          </div>
          <button type="button" className="link" style={{ marginTop: 10 }} onClick={() => nav('/login')}>
            Voltar para o login
          </button>
        </form>
      </div>
    </div>
  );
}
