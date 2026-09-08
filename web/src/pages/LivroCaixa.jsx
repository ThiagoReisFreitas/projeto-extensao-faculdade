import { useMemo, useState } from 'react';
import { api, brl, hoje } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useList } from '../ui.jsx';
import { useToast } from '../toast.jsx';
import { Money } from '../money.jsx';
import { EmptyState, EstornoModal, ConfirmModal } from '../components.jsx';
import { LancamentoPanel } from '../lancamento.jsx';
import { juntarEstornos } from '../estorno.js';

const mesAtual = () => hoje().slice(0, 7);
const mesRange = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return { de: `${m}-01`, ate: new Date(y, mo, 0).toISOString().slice(0, 10) };
};
const diaLabel = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
  return `${wd} · ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

const FILTROS = [
  ['tudo', 'Tudo'], ['receitas', 'Receitas'], ['gastos', 'Gastos'],
  ['folha', 'Folha'], ['cartao', 'Só cartão'],
];

function Barras({ titulo, dados, cor }) {
  if (!dados.length) return null;
  const max = Math.max(...dados.map((d) => Math.abs(d.valor))) || 1;
  return (
    <div className="card">
      <h2>{titulo}</h2>
      <ul className="barras">
        {dados.map((d) => (
          <li key={d.nome}>
            <span className="barras-nome">{d.nome}</span>
            <span className="barras-track"><i style={{ width: `${(Math.abs(d.valor) / max) * 100}%`, background: cor }} /></span>
            <span className="barras-val">{brl(Math.abs(d.valor))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LivroCaixa() {
  const [mes, setMes] = useState(mesAtual());
  const [custom, setCustom] = useState(null); // { de, ate } | null
  const [filtro, setFiltro] = useState('tudo');
  const [busca, setBusca] = useState('');
  const [estMov, setEstMov] = useState(null); // { mov, corrigir }
  const [painelIni, setPainelIni] = useState(null);
  const [confReabrir, setConfReabrir] = useState(null); // data 'YYYY-MM-DD' | null
  const { user } = useAuth();
  const toast = useToast();
  const dono = user?.perfil === 'dono';

  const { de, ate } = custom || mesRange(mes);
  const qs = `?de=${de}&ate=${ate}`;

  const receitas = useList(`/receitas${qs}`, [de, ate]);
  const gastos = useList(`/gastos${qs}`, [de, ate]);
  const pagamentos = useList(`/pagamentos${qs}`, [de, ate]);
  const fechamentos = useList(`/fechamentos${qs}`, [de, ate]);

  const recarregar = () => {
    receitas.reload(); gastos.reload(); pagamentos.reload(); fechamentos.reload();
  };

  const confirmarEstorno = async (motivo) => {
    const { mov, corrigir } = estMov;
    const base = mov.tipo === 'receita' ? 'receitas' : mov.tipo === 'gasto' ? 'gastos' : 'pagamentos';
    try {
      await api.post(`/${base}/${mov.id}/estorno`, { motivo });
      setEstMov(null);
      toast(corrigir ? 'Estornado — agora relance corrigido' : 'Lançamento estornado');
      recarregar();
      if (corrigir) setPainelIni(mov.dup);
    } catch (e) { toast(e.message, 'err'); throw e; }
  };

  const fazerReabrir = async () => {
    try {
      await api.post(`/fechamentos/${confReabrir}/reabrir`);
      setConfReabrir(null);
      toast('Dia reaberto'); recarregar();
    } catch (e) { toast(e.message, 'err'); throw e; }
  };

  const fechados = useMemo(
    () => new Set((fechamentos.data || []).filter((f) => !f.reaberto_em).map((f) => String(f.data).slice(0, 10))),
    [fechamentos.data],
  );

  // mescla + ordena + saldo acumulado (sobre TODOS os movimentos, antes de filtrar).
  // Estorno: junta o lançamento original com a sua reversão numa linha só, riscada,
  // que soma 0 no caixa — em vez de mostrar as duas pontas soltas.
  const movs = useMemo(() => {
    const raw = [
      ...(receitas.data || []).map((x) => ({
        tipo: 'receita', cartao: !!x.operadora_id, data: String(x.data).slice(0, 10), ts: x.criado_em, id: x.id,
        estornoDeId: x.estorno_de_id, motivo: x.motivo_estorno, forma: x.forma_pagamento_nome,
        desc: `${x.forma_pagamento_nome}${x.operadora_nome ? ` · ${x.operadora_nome}` : ''}`,
        valor: Number(x.valor_liquido),
        dup: {
          tipo: 'receita', valor: x.valor_bruto, formaId: x.forma_pagamento_id,
          operadoraId: x.operadora_id, data: String(x.data).slice(0, 10), obs: x.observacao,
        },
      })),
      ...(gastos.data || []).map((x) => ({
        tipo: 'gasto', cartao: false, data: String(x.data).slice(0, 10), ts: x.criado_em, id: x.id,
        estornoDeId: x.estorno_de_id, motivo: x.motivo_estorno, forma: '—',
        desc: `${x.categoria_nome}${x.descricao ? ` · ${x.descricao}` : ''}`, valor: -Number(x.valor),
        dup: {
          tipo: 'gasto', valor: x.valor, categoriaId: x.categoria_id,
          data: String(x.data).slice(0, 10), obs: x.descricao,
        },
      })),
      ...(pagamentos.data || []).map((x) => ({
        tipo: 'folha', cartao: false, data: String(x.data).slice(0, 10), ts: x.criado_em, id: x.id,
        estornoDeId: x.estorno_de_id, motivo: x.motivo_estorno, forma: '—',
        desc: `Folha · ${x.funcionario_nome}`, valor: -Number(x.valor),
        dup: {
          tipo: 'folha', valor: x.valor, funcionarioId: x.funcionario_id,
          data: String(x.data).slice(0, 10), ref: x.periodo_referencia,
        },
      })),
    ];

    const it = juntarEstornos(raw)
      .sort((a, b) => `${a.data}${a.ts}`.localeCompare(`${b.data}${b.ts}`));
    let acc = 0;
    return it.map((m) => { acc += m.valor; return { ...m, saldo: acc }; });
  }, [receitas.data, gastos.data, pagamentos.data]);

  // ids de lançamentos estornados — tirados dos totais por forma/categoria
  const alvosEstornados = useMemo(() => {
    const f = (arr) => new Set((arr || []).filter((x) => x.estorno_de_id).map((x) => x.estorno_de_id));
    return { receitas: f(receitas.data), gastos: f(gastos.data) };
  }, [receitas.data, gastos.data]);

  const filtrados = movs.filter((m) => {
    if (filtro === 'receitas' && m.tipo !== 'receita') return false;
    if (filtro === 'gastos' && m.tipo !== 'gasto') return false;
    if (filtro === 'folha' && m.tipo !== 'folha') return false;
    if (filtro === 'cartao' && !m.cartao) return false;
    if (busca && !m.desc.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const dias = useMemo(() => {
    const map = new Map();
    filtrados.forEach((m) => { if (!map.has(m.data)) map.set(m.data, []); map.get(m.data).push(m); });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([data, ms]) => ({ data, ms, total: ms.reduce((s, m) => s + m.valor, 0), fechado: fechados.has(data) }));
  }, [filtrados, fechados]);

  const entradaPorForma = useMemo(() => {
    const map = new Map();
    (receitas.data || [])
      .filter((x) => !x.estorno_de_id && !alvosEstornados.receitas.has(x.id))
      .forEach((x) => {
        map.set(x.forma_pagamento_nome, (map.get(x.forma_pagamento_nome) || 0) + Number(x.valor_liquido));
      });
    return [...map.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [receitas.data, alvosEstornados]);

  const saidaPorCategoria = useMemo(() => {
    const map = new Map();
    (gastos.data || [])
      .filter((x) => !x.estorno_de_id && !alvosEstornados.gastos.has(x.id))
      .forEach((x) => {
        map.set(x.categoria_nome, (map.get(x.categoria_nome) || 0) + Number(x.valor));
      });
    return [...map.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  }, [gastos.data, alvosEstornados]);

  return (
    <div className="page">
      <div className="lc-top">
        <h1>Livro-caixa</h1>
        <a href={`/api/fluxo/export.csv${qs}`}><button className="sec" type="button">Exportar CSV</button></a>
      </div>

      <div className="card lc-controles">
        <div className="lc-periodo">
          {custom ? (
            <>
              <label>De<input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} /></label>
              <label>Até<input type="date" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} /></label>
              <button className="link" type="button" onClick={() => setCustom(null)}>voltar ao mês</button>
            </>
          ) : (
            <>
              <label>Mês<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
              <button className="link" type="button" onClick={() => setCustom(mesRange(mes))}>período personalizado</button>
            </>
          )}
        </div>
        <div className="chips">
          {FILTROS.map(([v, l]) => (
            <button key={v} type="button" className={filtro === v ? 'on' : undefined} onClick={() => setFiltro(v)}>{l}</button>
          ))}
        </div>
        <input className="lc-busca" type="search" placeholder="Buscar na descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {dias.length ? (
        <div className="extrato">
          {dias.map((d) => (
            <div className="dia" key={d.data}>
              <div className="dia-head">
                <span>
                  {diaLabel(d.data)}
                  {d.fechado && <span className="dia-lock"> 🔒 FECHADO</span>}
                  {d.fechado && dono && (
                    <button type="button" className="link" style={{ marginLeft: 8 }}
                      onClick={() => setConfReabrir(d.data)}>reabrir</button>
                  )}
                </span>
                <Money value={d.total} sign />
              </div>
              {d.ms.map((m) => (
                <div className={`extrato-linha${m.estornado ? ' estornado' : ''}`} key={`${m.tipo}${m.id}`}
                  title={m.estornado && m.motivo ? `Estornado: ${m.motivo}` : undefined}>
                  <span className="el-data">{m.data.slice(8, 10)}/{m.data.slice(5, 7)}</span>
                  <span className="el-desc">{m.desc}{m.estornado ? ' — estornado' : ''}</span>
                  <span className="el-forma">{m.forma}</span>
                  <span className="el-valor"><Money value={m.valorMostrar} /></span>
                  <span className="el-saldo"><Money value={m.saldo} /></span>
                  {!m.estornado && !d.fechado && dono && (
                    <span className="el-acoes">
                      <button className="link" onClick={() => setEstMov({ mov: m, corrigir: true })}>corrigir</button>
                      <button className="link" onClick={() => setEstMov({ mov: m, corrigir: false })}>estornar</button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>Nenhum lançamento no período. Ajuste o mês ou os filtros acima.</EmptyState>
      )}

      <Barras titulo="Entrada por forma de pagamento" dados={entradaPorForma} cor="var(--accent)" />
      <Barras titulo="Saída por categoria" dados={saidaPorCategoria} cor="var(--danger)" />

      {estMov && (
        <EstornoModal
          resumo={`${estMov.mov.desc} · ${brl(Math.abs(estMov.mov.valor))}`}
          onConfirmar={confirmarEstorno}
          onClose={() => setEstMov(null)} />
      )}
      {painelIni && (
        <LancamentoPanel iniciais={painelIni}
          onClose={() => setPainelIni(null)} onLancado={recarregar} />
      )}
      {confReabrir && (
        <ConfirmModal
          titulo="Reabrir o dia"
          mensagem={`Reabrir o caixa de ${confReabrir.slice(8, 10)}/${confReabrir.slice(5, 7)}? Volta a aceitar edições e fica registrado com seu nome.`}
          confirmarLabel="Reabrir"
          onConfirmar={fazerReabrir}
          onClose={() => setConfReabrir(null)} />
      )}
    </div>
  );
}
