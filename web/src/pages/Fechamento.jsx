import { useMemo, useState } from 'react';
import { api, brl } from '../api.js';
import { useList } from '../ui.jsx';
import { useToast } from '../toast.jsx';
import { Modal } from '../components.jsx';
import { Money } from '../money.jsx';

const n = (v) => Number(String(v).replace(',', '.')) || 0;

// Modal de conferencia. data = 'YYYY-MM-DD'. onFechado() ao concluir.
export function FechamentoModal({ data, onClose, onFechado }) {
  const toast = useToast();
  const receitas = useList(`/receitas?de=${data}&ate=${data}`, [data]);
  const gastos = useList(`/gastos?de=${data}&ate=${data}`, [data]);
  const pagamentos = useList(`/pagamentos?de=${data}&ate=${data}`, [data]);
  const categorias = useList('/categorias', []);
  const [conferido, setConferido] = useState({});
  const [busy, setBusy] = useState(false);

  const grupos = useMemo(() => {
    const naoCartao = new Map();
    let cartao = 0;
    (receitas.data || []).filter((x) => !x.estorno_de_id).forEach((x) => {
      if (x.operadora_id) cartao += Number(x.valor_bruto);
      else naoCartao.set(x.forma_pagamento_nome, (naoCartao.get(x.forma_pagamento_nome) || 0) + Number(x.valor_bruto));
    });
    const arr = [...naoCartao.entries()].map(([label, sistema]) => ({ label, sistema }));
    if (cartao > 0) arr.push({ label: 'Cartão (bruto)', sistema: cartao });
    return arr;
  }, [receitas.data]);

  const valConf = (g) => (conferido[g.label] === undefined ? g.sistema : n(conferido[g.label]));
  const difTotal = grupos.reduce((s, g) => s + (valConf(g) - g.sistema), 0);
  const temDif = Math.abs(difTotal) >= 0.005;

  const lancs = (receitas.data || []).filter((x) => !x.estorno_de_id).length
    + (gastos.data || []).filter((x) => !x.estorno_de_id).length;
  const semComprovante = [
    ...(receitas.data || []).filter((x) => !x.estorno_de_id),
    ...(gastos.data || []).filter((x) => !x.estorno_de_id),
  ].filter((x) => !x.comprovante_path).length;
  const folhaLista = (pagamentos.data || []).filter((x) => !x.estorno_de_id);
  const folhaTotal = folhaLista.reduce((s, x) => s + Number(x.valor), 0);
  const gastosLista = (gastos.data || []).filter((x) => !x.estorno_de_id);
  const gastosTotal = gastosLista.reduce((s, x) => s + Number(x.valor), 0);
  const receitaLiq = (receitas.data || []).filter((x) => !x.estorno_de_id)
    .reduce((s, x) => s + Number(x.valor_liquido), 0);
  const resultado = receitaLiq - gastosTotal - folhaTotal;

  const conferenciaPayload = () => grupos.map((g) => ({
    forma: g.label, valor_sistema: g.sistema, valor_conferido: valConf(g),
  }));

  async function fechar({ comQuebra } = {}) {
    setBusy(true);
    try {
      if (comQuebra && difTotal < 0) {
        const cat = (categorias.data || []).find((c) => c.nome === 'Quebra de caixa');
        if (!cat) throw new Error('categoria "Quebra de caixa" não encontrada nos cadastros');
        await api.post('/gastos', {
          data, valor: Math.abs(difTotal), categoria_id: cat.id,
          descricao: `Quebra de caixa · conferência ${data.slice(8, 10)}/${data.slice(5, 7)}`,
        });
      }
      await api.post('/fechamentos', { data, conferencia: conferenciaPayload() });
      toast('Dia fechado');
      onFechado();
    } catch (e) { toast(e.message, 'err'); setBusy(false); }
  }

  return (
    <Modal title={`Fechar o dia · ${data.slice(8, 10)}/${data.slice(5, 7)}`} onClose={onClose}>
      <div className="fech">
        <div className="scroll">
          <table className="fech-tab">
            <thead><tr><th>Recebimento</th><th className="num">No sistema</th><th className="num">Conferido</th></tr></thead>
            <tbody>
              {grupos.length === 0 && <tr><td colSpan={3} className="muted">Nenhuma receita hoje.</td></tr>}
              {grupos.map((g) => {
                const dif = valConf(g) - g.sistema;
                return (
                  <tr key={g.label} className={Math.abs(dif) >= 0.005 ? 'fech-dif' : undefined}>
                    <td>{g.label}</td>
                    <td className="num"><Money value={g.sistema} /></td>
                    <td className="num">
                      <input inputMode="decimal" value={conferido[g.label] ?? String(g.sistema)}
                        onChange={(e) => setConferido({ ...conferido, [g.label]: e.target.value })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {temDif && (
          <div className="fech-aviso">
            Diferença de <Money value={difTotal} /> na conferência.
            {difTotal < 0
              ? ' Registrar como quebra de caixa, corrigir um lançamento ou fechar assim mesmo?'
              : ' Sobra de caixa — corrigir um lançamento ou fechar assim mesmo?'}
          </div>
        )}

        <div className="fech-bloco">
          <h3>Gastos do dia</h3>
          {gastosLista.length ? (
            <ul className="fech-lista">
              {gastosLista.map((x) => (
                <li key={x.id}>
                  <span>{x.categoria_nome}{x.descricao ? ` · ${x.descricao}` : ''}</span>
                  <Money value={-Number(x.valor)} />
                </li>
              ))}
              <li className="fech-lista-total"><span>Total de gastos</span><Money value={-gastosTotal} /></li>
            </ul>
          ) : <p className="muted">Nenhum gasto no dia.</p>}
        </div>

        <div className="fech-bloco">
          <h3>Folha do dia</h3>
          {folhaLista.length ? (
            <ul className="fech-lista">
              {folhaLista.map((x) => (
                <li key={x.id}>
                  <span>{x.funcionario_nome}{x.periodo_referencia ? ` · ${x.periodo_referencia}` : ''}</span>
                  <Money value={-Number(x.valor)} />
                </li>
              ))}
              <li className="fech-lista-total"><span>Total de folha</span><Money value={-folhaTotal} /></li>
            </ul>
          ) : <p className="muted">Nenhum pagamento de folha no dia.</p>}
        </div>

        <div className="fech-resultado">
          <span>RESULTADO DO DIA</span>
          <strong><Money value={resultado} sign /></strong>
        </div>

        <ul className="fech-sanidade">
          <li>{lancs} lançamento{lancs === 1 ? '' : 's'} · {semComprovante} sem comprovante</li>
        </ul>

        <div className="fech-acoes">
          {temDif && difTotal < 0 && (
            <button type="button" disabled={busy} onClick={() => fechar({ comQuebra: true })}>
              Registrar quebra e fechar
            </button>
          )}
          <button type="button" disabled={busy}
            className={temDif ? 'sec' : undefined} onClick={() => fechar()}>
            {temDif ? 'Fechar assim mesmo' : 'Fechar o dia'}
          </button>
          <button type="button" className="sec" disabled={busy} onClick={onClose}>Cancelar</button>
        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          Depois de fechado, o Caixa não edita lançamentos do dia. O Dono pode reabrir — a reabertura fica registrada.
        </p>
      </div>
    </Modal>
  );
}
