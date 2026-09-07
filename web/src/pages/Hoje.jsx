import { useMemo, useState } from 'react';
import { api, brl, hoje } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useList } from '../ui.jsx';
import { useToast } from '../toast.jsx';
import { Money } from '../money.jsx';
import { EmptyState, EstornoModal, ConfirmModal } from '../components.jsx';
import { LancamentoPanel } from '../lancamento.jsx';
import { FechamentoModal } from './Fechamento.jsx';

const dataExtenso = () => {
  const d = new Date();
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
  const dm = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${dm}`;
};
const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export default function Hoje() {
  const d = hoje();
  const toast = useToast();
  const { user } = useAuth();
  const [painel, setPainel] = useState(null); // { tipoInicial, iniciais? }
  const [fechModal, setFechModal] = useState(false);
  const [estModal, setEstModal] = useState(null); // { linha, corrigir }
  const [confReabrir, setConfReabrir] = useState(false);

  const resumo = useList(`/fluxo/resumo?de=${d}&ate=${d}`, [d]);
  const receitas = useList(`/receitas?de=${d}&ate=${d}`, [d]);
  const gastos = useList(`/gastos?de=${d}&ate=${d}`, [d]);
  const pagamentos = useList(`/pagamentos?de=${d}&ate=${d}`, [d]);
  const fech = useList(`/fechamentos/${d}`, [d]);

  const recarregar = () => { resumo.reload(); receitas.reload(); gastos.reload(); pagamentos.reload(); };

  const linhas = useMemo(() => {
    const r = (receitas.data || []).map((x) => ({
      key: `r${x.id}`, tipo: 'receita', id: x.id, ts: x.criado_em, estorno: !!x.estorno_de_id,
      desc: `${x.forma_pagamento_nome}${x.operadora_nome ? ` · ${x.operadora_nome}` : ''}`,
      valor: Number(x.valor_liquido),
      dup: {
        tipo: 'receita', valor: x.valor_bruto, formaId: x.forma_pagamento_id,
        operadoraId: x.operadora_id, data: String(x.data).slice(0, 10), obs: x.observacao,
      },
    }));
    const g = (gastos.data || []).map((x) => ({
      key: `g${x.id}`, tipo: 'gasto', id: x.id, ts: x.criado_em, estorno: !!x.estorno_de_id,
      desc: `${x.categoria_nome}${x.descricao ? ` · ${x.descricao}` : ''}`,
      valor: -Number(x.valor),
      dup: {
        tipo: 'gasto', valor: x.valor, categoriaId: x.categoria_id,
        data: String(x.data).slice(0, 10), obs: x.descricao,
      },
    }));
    const p = (pagamentos.data || []).map((x) => ({
      key: `p${x.id}`, tipo: 'folha', id: x.id, ts: x.criado_em, estorno: !!x.estorno_de_id,
      desc: `Folha · ${x.funcionario_nome}`,
      valor: -Number(x.valor),
      dup: {
        tipo: 'folha', valor: x.valor, funcionarioId: x.funcionario_id,
        data: String(x.data).slice(0, 10), ref: x.periodo_referencia,
      },
    }));
    return [...r, ...g, ...p].sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  }, [receitas.data, gastos.data, pagamentos.data]);

  const r = resumo.data || {};
  const fechado = !!fech.data?.fechado;

  const confirmarEstorno = async (motivo) => {
    const { linha, corrigir } = estModal;
    const base = linha.tipo === 'receita' ? 'receitas' : linha.tipo === 'gasto' ? 'gastos' : 'pagamentos';
    try {
      await api.post(`/${base}/${linha.id}/estorno`, { motivo });
      setEstModal(null);
      toast(corrigir ? 'Estornado — agora relance corrigido' : 'Lançamento estornado');
      recarregar();
      if (corrigir) setPainel({ iniciais: linha.dup });
    } catch (e) { toast(e.message, 'err'); throw e; }
  };

  const fazerReabrir = async () => {
    try {
      await api.post(`/fechamentos/${d}/reabrir`);
      setConfReabrir(false);
      toast('Dia reaberto');
      fech.reload(); recarregar();
    } catch (e) { toast(e.message, 'err'); throw e; }
  };



  return (
    <div className="hoje">
      <div className="hoje-top">
        <h1>{dataExtenso()}</h1>
        <span className={`selo-dia ${fechado ? 'fechado' : 'aberto'}`}>
          {fechado ? '🔒 DIA FECHADO' : 'DIA ABERTO'}
        </span>
      </div>

      <div className="hoje-atalhos">
        <button type="button" onClick={() => setPainel({ tipoInicial: 'receita' })}>+ Receita</button>
        <button type="button" onClick={() => setPainel({ tipoInicial: 'gasto' })}>+ Gasto</button>
        <button type="button" onClick={() => setPainel({ tipoInicial: 'folha' })}>+ Pagamento</button>
      </div>

      <div className="hoje-corpo">
        <div className="card hoje-lista">
          <h2>Lançado hoje</h2>
          {linhas.length ? (
            <ul>
              {linhas.map((l) => (
                <li key={l.key} className={l.estorno ? 'estornado' : undefined}>
                  <span className="hora">{hora(l.ts)}</span>
                  <span className="desc">{l.desc}</span>
                  <span className="val"><Money value={l.valor} /></span>
                  {!l.estorno && !fechado && (
                    <span className="acoes">
                      <button className="link" onClick={() => setPainel({ iniciais: l.dup })}>duplicar</button>
                      {user?.perfil === 'dono' && <>
                        <button className="link" onClick={() => setEstModal({ linha: l, corrigir: true })}>corrigir</button>
                        <button className="link" onClick={() => setEstModal({ linha: l, corrigir: false })}>estornar</button>
                      </>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState action={<button type="button" onClick={() => setPainel({ tipoInicial: 'receita' })}>+ Receita</button>}>
              Nenhum lançamento hoje ainda. Comece pela primeira venda.
            </EmptyState>
          )}
        </div>

        <div className="card hoje-conta">
          <h2>A conta do dia</h2>
          <dl>
            <div><dt>Receita bruta</dt><dd><Money value={r.receita_bruta} /></dd></div>
            <div><dt>Taxas de cartão</dt><dd><Money value={-Number(r.taxas || 0)} /></dd></div>
            <div><dt>Gastos</dt><dd><Money value={-Number(r.gasto || 0)} /></dd></div>
            <div><dt>Folha</dt><dd><Money value={-Number(r.folha || 0)} /></dd></div>
          </dl>
          <div className="hoje-sobra">
            <span>SOBRA DO DIA</span>
            <strong><Money value={r.saldo} sign /></strong>
          </div>
          {fechado
            ? (user?.perfil === 'dono'
                ? <>
                    <button type="button" className="sec" onClick={() => setConfReabrir(true)}>Reabrir o dia</button>
                    <p className="muted" style={{ marginTop: 6 }}>A reabertura fica registrada com seu nome.</p>
                  </>
                : <p className="muted">Dia fechado. Só o Dono reabre.</p>)
            : <>
                <button type="button" onClick={() => setFechModal(true)}>Fechar o dia</button>
                <p className="muted" style={{ marginTop: 6 }}>Trava edições. Só o Dono reabre.</p>
              </>}
        </div>
      </div>

      {fechModal && (
        <FechamentoModal data={d} onClose={() => setFechModal(false)}
          onFechado={() => { setFechModal(false); fech.reload(); recarregar(); }} />
      )}

      {estModal && (
        <EstornoModal
          resumo={`${estModal.linha.desc} · ${brl(Math.abs(estModal.linha.valor))}`}
          onConfirmar={confirmarEstorno}
          onClose={() => setEstModal(null)} />
      )}

      {confReabrir && (
        <ConfirmModal
          titulo="Reabrir o dia"
          mensagem="O dia volta a aceitar lançamentos e edições. A reabertura fica registrada com seu nome."
          confirmarLabel="Reabrir"
          onConfirmar={fazerReabrir}
          onClose={() => setConfReabrir(false)} />
      )}

      {painel && (
        <LancamentoPanel
          tipoInicial={painel.tipoInicial}
          iniciais={painel.iniciais}
          onClose={() => setPainel(null)}
          onLancado={recarregar}
        />
      )}
    </div>
  );
}
