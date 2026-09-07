import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api, hoje, brl } from './api.js';
import { useAuth } from './auth.jsx';
import { previewTaxa } from './periodo.js';
import { useList } from './ui.jsx';
import { useToast } from './toast.jsx';
import { FotoInput, Label } from './components.jsx';
import { Money } from './money.jsx';
import { vinculoLabel } from './rotulos.jsx';

const TIPOS = [['receita', 'Receita'], ['gasto', 'Gasto'], ['folha', 'Folha']];

const ativos = (l) => (l.data || []).filter((x) => x.ativo);
const vazio = (l) => !l.loading && ativos(l).length === 0;

const hojeLabel = () => {
  const d = new Date();
  return `hoje · ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const TAXA_CURTA = { debito: 'débito', credito_vista: 'crédito à vista', credito_parcelado: 'crédito parcelado' };
const pctForma = (forma, op) => {
  const p = { debito: op.taxa_debito, credito_vista: op.taxa_credito_vista, credito_parcelado: op.taxa_credito_parcelado }[forma.tipo_taxa];
  return `${Number(p || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%`;
};

const CadastrarLink = ({ texto }) => (
  <p className="muted">{texto} <Link to="/config">Cadastrar agora</Link></p>
);

function Chips({ itens, valor, onPick }) {
  return (
    <div className="chips">
      {itens.map((x) => (
        <button key={x.id} type="button" className={String(valor) === String(x.id) ? 'on' : undefined}
          onClick={() => onPick(String(x.id))}>{x.nome}</button>
      ))}
    </div>
  );
}

// Painel unico de lancamento. Tipo = seletor segmentado, nao rota.
// Desktop: painel lateral. Celular: tela cheia.
export function LancamentoPanel({ tipoInicial = 'receita', iniciais = null, onClose, onLancado }) {
  const toast = useToast();
  const { user } = useAuth();
  const ini = iniciais || {};
  const [tipo, setTipo] = useState(ini.tipo || tipoInicial);
  const [data, setData] = useState(ini.data || hoje());
  const [valor, setValor] = useState(ini.valor != null ? String(ini.valor) : '');
  const [formaId, setFormaId] = useState(ini.formaId != null ? String(ini.formaId) : '');
  const [operadoraId, setOperadoraId] = useState(ini.operadoraId != null ? String(ini.operadoraId) : '');
  const [categoriaId, setCategoriaId] = useState(ini.categoriaId != null ? String(ini.categoriaId) : '');
  const [funcionarioId, setFuncionarioId] = useState(ini.funcionarioId != null ? String(ini.funcionarioId) : '');
  const [obs, setObs] = useState(ini.obs || '');
  const [ref, setRef] = useState(ini.ref || '');
  const [foto, setFoto] = useState(null);
  const [fotoKey, setFotoKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sessao, setSessao] = useState([]);
  const valorRef = useRef(null);

  const formas = useList('/formas-pagamento', []);
  const operadoras = useList('/operadoras', []);
  const categorias = useList('/categorias', []);
  const funcionarios = useList('/funcionarios', []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => valorRef.current?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const forma = (formas.data || []).find((x) => String(x.id) === String(formaId));
  const operadora = (operadoras.data || []).find((x) => String(x.id) === String(operadoraId));
  const prev = previewTaxa(valor, forma, operadora);

  const proximo = () => {
    setValor(''); setObs(''); setRef(''); setFoto(null); setFotoKey((k) => k + 1); setErr('');
    setTimeout(() => valorRef.current?.focus(), 0);
  };

  async function enviar() {
    setErr(''); setBusy(true);
    try {
      let comprovante_path = null;
      if (foto && tipo !== 'folha') {
        ({ comprovante_path } = await api.upload(tipo === 'receita' ? 'receitas' : 'gastos', foto));
      }
      let criado; let label;
      if (tipo === 'receita') {
        criado = await api.post('/receitas', {
          data, valor_bruto: Number(valor), forma_pagamento_id: Number(formaId),
          operadora_id: forma?.requer_operadora ? Number(operadoraId) : null,
          observacao: obs || null, comprovante_path,
        });
        label = `Receita · ${forma?.nome || ''}`;
      } else if (tipo === 'gasto') {
        const cat = ativos(categorias).find((c) => String(c.id) === String(categoriaId));
        criado = await api.post('/gastos', {
          data, valor: Number(valor), categoria_id: Number(categoriaId),
          descricao: obs || null, comprovante_path,
        });
        label = `Gasto · ${cat?.nome || ''}`;
      } else {
        const fn = ativos(funcionarios).find((f) => String(f.id) === String(funcionarioId));
        criado = await api.post('/pagamentos', {
          funcionario_id: Number(funcionarioId), data, valor: Number(valor), periodo_referencia: ref || null,
        });
        label = `Folha · ${fn?.nome || ''}`;
      }
      setSessao((l) => [{ tipo, id: criado.id, label, valor: Number(valor), desfeito: false }, ...l]);
      toast(tipo === 'receita' ? 'Receita lançada' : tipo === 'gasto' ? 'Gasto lançado' : 'Pagamento lançado');
      onLancado?.();
      return true;
    } catch (e) { setErr(e.message); return false; }
    finally { setBusy(false); }
  }

  const salvarEOutro = async (e) => { e.preventDefault(); if (await enviar()) proximo(); };
  const salvarEFechar = async () => { if (await enviar()) onClose(); };

  const desfazer = async (item, idx) => {
    const base = item.tipo === 'receita' ? 'receitas' : item.tipo === 'gasto' ? 'gastos' : 'pagamentos';
    try {
      await api.post(`/${base}/${item.id}/estorno`, { motivo: 'desfeito logo após o lançamento' });
      setSessao((l) => l.map((x, i) => (i === idx ? { ...x, desfeito: true } : x)));
      onLancado?.();
      toast('Lançamento desfeito');
    } catch (e) { toast(e.message, 'err'); }
  };

  const podeSalvar = Number(valor) > 0 && (
    (tipo === 'receita' && formaId && (!forma?.requer_operadora || operadoraId))
    || (tipo === 'gasto' && categoriaId)
    || (tipo === 'folha' && funcionarioId)
  );

  return createPortal(
    <div className="lp-overlay" onClick={onClose}>
      <div className="lp-panel" role="dialog" aria-modal="true" aria-label="Novo lançamento"
        onClick={(e) => e.stopPropagation()}>
        <div className="lp-head">
          <strong>Novo lançamento</strong>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>✕</button>
        </div>

        <form className="lp-body" onSubmit={salvarEOutro}>
          <div className="seg" role="group" aria-label="Tipo de lançamento">
            {TIPOS.map(([v, l]) => (
              <button key={v} type="button" className={tipo === v ? 'on' : undefined}
                aria-pressed={tipo === v} onClick={() => setTipo(v)}>{l}</button>
            ))}
          </div>

          <Label htmlFor="lp-valor">Valor</Label>
          <input ref={valorRef} id="lp-valor" className="lp-valor" inputMode="decimal" placeholder="0,00"
            value={valor} onChange={(e) => setValor(e.target.value.replace(',', '.'))} required />

          <Label htmlFor="lp-data">Data</Label>
          <input id="lp-data" type="date" value={data} max={hoje()}
            onChange={(e) => setData(e.target.value)} required />
          {data === hoje()
            ? <p className="muted" style={{ marginTop: 2 }}>{hojeLabel()}</p>
            : <p className="lp-retro">Lançando em {data.slice(8, 10)}/{data.slice(5, 7)} — dia anterior</p>}

          {tipo === 'receita' && (
            <>
              <Label>Forma de pagamento</Label>
              {vazio(formas)
                ? <CadastrarLink texto="Nenhuma forma de pagamento cadastrada." />
                : <Chips itens={ativos(formas)} valor={formaId}
                    onPick={(id) => { setFormaId(id); setOperadoraId(''); }} />}
              {forma?.requer_operadora && (
                <>
                  <Label>Maquininha</Label>
                  {vazio(operadoras)
                    ? <CadastrarLink texto="Nenhuma maquininha cadastrada." />
                    : <Chips itens={ativos(operadoras)} valor={operadoraId} onPick={setOperadoraId} />}
                  <div className="lp-taxa">
                    {operadora
                      ? <>Taxa {operadora.nome} {TAXA_CURTA[forma.tipo_taxa]} {pctForma(forma, operadora)} = <Money value={-prev.taxa} /> · Entra no caixa: <Money value={prev.liquido} /></>
                      : 'Escolha a maquininha para ver a taxa.'}
                  </div>
                </>
              )}
            </>
          )}

          {tipo === 'gasto' && (
            <>
              <Label htmlFor="lp-cat">Categoria</Label>
              {vazio(categorias)
                ? <CadastrarLink texto="Nenhuma categoria cadastrada." />
                : (
                  <select id="lp-cat" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
                    <option value="">selecione</option>
                    {ativos(categorias).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                )}
            </>
          )}

          {tipo === 'folha' && (
            <>
              <Label htmlFor="lp-func">Funcionário</Label>
              {vazio(funcionarios)
                ? <CadastrarLink texto="Ninguém cadastrado na equipe." />
                : (
                  <select id="lp-func" value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} required>
                    <option value="">selecione</option>
                    {ativos(funcionarios).map((f) => (
                      <option key={f.id} value={f.id}>{f.nome} · {vinculoLabel(f.tipo_vinculo)}</option>
                    ))}
                  </select>
                )}
              <Label htmlFor="lp-ref">Período de referência <span className="muted">(opcional)</span></Label>
              <input id="lp-ref" placeholder='ex: "diária 15/09" ou "mês 09/2026"'
                value={ref} onChange={(e) => setRef(e.target.value)} />
            </>
          )}

          {tipo !== 'folha' && (
            <>
              <Label htmlFor="lp-obs">{tipo === 'gasto' ? 'Descrição' : 'Observação'} <span className="muted">(opcional)</span></Label>
              <input id="lp-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
              <Label>Comprovante <span className="muted">(opcional)</span></Label>
              <FotoInput key={fotoKey} onChange={setFoto} />
            </>
          )}

          {err && <div className="err">{err}</div>}

          <div className="lp-actions">
            <button type="submit" className="primary" disabled={busy || !podeSalvar}>
              {busy ? 'salvando…' : 'Salvar e lançar outro'}
            </button>
            <button type="button" className="secondary" disabled={busy || !podeSalvar} onClick={salvarEFechar}>
              Salvar
            </button>
          </div>

          {sessao.length > 0 && (
            <div className="lp-sessao">
              <span className="muted">Lançados nesta sessão</span>
              <ul>
                {sessao.map((it, i) => (
                  <li key={i} className={it.desfeito ? 'desfeito' : undefined}>
                    <span>{it.label} · {brl(it.valor)}</span>
                    {!it.desfeito && user?.perfil === 'dono' && (
                      <button type="button" className="link" onClick={() => desfazer(it, i)}>desfazer</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}

// Botao flutuante "+ Lançar", sempre acessivel.
export function LancarFab() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="fab" onClick={() => setAberto(true)}>+ Lançar</button>
      {aberto && <LancamentoPanel onClose={() => setAberto(false)} />}
    </>
  );
}
