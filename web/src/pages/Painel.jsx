import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { brl, hoje } from '../api.js';
import { useList } from '../ui.jsx';
import { useIsDark } from '../theme.js';
import { Money } from '../money.jsx';
import { EmptyState } from '../components.jsx';

// ponytail: mesAtual/mesRange duplicados de LivroCaixa; extrair p/ periodo.js se um 3o uso aparecer.
const mesAtual = () => hoje().slice(0, 7);
const mesRange = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return { de: `${m}-01`, ate: new Date(y, mo, 0).toISOString().slice(0, 10) };
};
const nomeMes = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// cores de serie a partir dos tokens do tema (recharts nao resolve var() em fill/stroke)
function useTokens() {
  const dark = useIsDark();
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement);
    const g = (n) => s.getPropertyValue(n).trim();
    return {
      accent: g('--accent'), accentSoft: g('--accent-soft'), accentBright: g('--accent-bright'),
      positive: g('--positive'), danger: g('--danger'), muted: g('--muted'),
    };
  }, [dark]);
}

const num = (v) => Number(v || 0);

export default function Painel() {
  const [mes, setMes] = useState(mesAtual());
  const { de, ate } = mesRange(mes);
  const qs = `?de=${de}&ate=${ate}`;
  const t = useTokens();

  const resumo = useList(`/fluxo/resumo${qs}`, [de, ate]);
  const diario = useList(`/fluxo/diario${qs}`, [de, ate]);
  const operadora = useList(`/fluxo/operadora${qs}`, [de, ate]);
  const categoria = useList(`/fluxo/categoria${qs}`, [de, ate]);

  const r = resumo.data || {};
  const kpis = [
    ['Receita líquida', num(r.receita_liquida)],
    ['Gastos', num(r.gasto)],
    ['Folha', num(r.folha)],
    ['Saldo', num(r.saldo)],
  ];

  const barras = useMemo(() => (diario.data || []).map((d) => ({
    dia: String(d.data).slice(8, 10),
    Receita: num(d.total_receita_liquida),
    Saídas: num(d.total_gasto) + num(d.total_folha),
  })), [diario.data]);

  const pizza = useMemo(
    () => (operadora.data || []).map((o) => ({ nome: o.operadora, valor: num(o.liquido) })).filter((o) => o.valor > 0),
    [operadora.data],
  );
  const pizzaCores = [t.accent, t.accentSoft, t.accentBright, t.muted, t.danger];
  const pizzaTotal = pizza.reduce((s, o) => s + o.valor, 0);

  const cats = useMemo(
    () => (categoria.data || []).map((c) => ({ nome: c.categoria, valor: num(c.total) })).filter((c) => c.valor > 0),
    [categoria.data],
  );
  const catMax = Math.max(...cats.map((c) => c.valor), 1);

  const vazio = !resumo.loading && !num(r.receita_bruta) && !num(r.gasto) && !num(r.folha);

  return (
    <div className="page painel">
      <div className="lc-top">
        <h1>Painel</h1>
        <a href={`/api/fluxo/export.csv${qs}`}><button className="sec" type="button">Exportar CSV</button></a>
      </div>
      <p className="page-intro">Visão analítica de {nomeMes(mes)}. Os números são calculados no servidor; aqui só se plota.</p>

      <div className="card lc-controles">
        <div className="lc-periodo">
          <label>Mês<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
        </div>
      </div>

      {vazio ? (
        <EmptyState>Nenhum lançamento em {nomeMes(mes)}. Escolha outro mês.</EmptyState>
      ) : (
        <>
          <div className="card painel-hero">
            <span className="hero-lbl">Saldo do período</span>
            <span className={`hero-num ${num(r.saldo) < 0 ? 'neg' : 'pos'}`}>{brl(num(r.saldo))}</span>
            <span className="painel-hero-sub">
              Receita bruta {brl(num(r.receita_bruta))} · taxas −{brl(num(r.taxas))}
            </span>
          </div>

          <div className="grid">
            {kpis.map(([label, valor]) => (
              <div className="kpi" key={label}>
                <span>{label}</span>
                <b><Money value={valor} sign={label === 'Saldo'} /></b>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Fluxo diário</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barras} barGap={2}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} width={44}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip formatter={(v) => brl(v)} labelFormatter={(d) => `Dia ${d}`} />
                  <Bar dataKey="Receita" fill={t.accent} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Saídas" fill={t.accentSoft} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="legend">
              <span><i style={{ background: t.accent }} />Receita líquida</span>
              <span><i style={{ background: t.accentSoft }} />Saídas (gasto + folha)</span>
            </div>
          </div>

          <div className="painel-grid cols-2">
            <div className="card">
              <h2>Entrada por operadora</h2>
              {pizza.length ? (
                <>
                  <div className="chart-wrap chart-wrap--donut">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius="62%" outerRadius="100%"
                          paddingAngle={2} stroke="none">
                          {pizza.map((_, i) => <Cell key={i} fill={pizzaCores[i % pizzaCores.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => brl(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <span>Líquido</span>
                      <b>{brl(pizzaTotal)}</b>
                    </div>
                  </div>
                  <div className="legend">
                    {pizza.map((o, i) => (
                      <span key={o.nome}><i style={{ background: pizzaCores[i % pizzaCores.length] }} />{o.nome}</span>
                    ))}
                  </div>
                </>
              ) : <p className="muted">Sem entradas por operadora no período.</p>}
            </div>

            <div className="card">
              <h2>Saída por categoria</h2>
              {cats.length ? (
                <ul className="barras">
                  {cats.map((c) => (
                    <li key={c.nome}>
                      <span className="barras-nome">{c.nome}</span>
                      <span className="barras-track"><i style={{ width: `${(c.valor / catMax) * 100}%`, background: t.danger }} /></span>
                      <span className="barras-val">{brl(c.valor)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">Sem gastos no período.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
