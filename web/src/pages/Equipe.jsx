import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ultimos30 } from '../periodo.js';
import { useList } from '../ui.jsx';
import { useToast } from '../toast.jsx';
import { Link } from 'react-router-dom';
import { Money } from '../money.jsx';
import { EmptyState, EstornoModal } from '../components.jsx';
import { vinculoLabel } from '../rotulos.jsx';
import { LancamentoPanel } from '../lancamento.jsx';

export default function Equipe() {
  const [p, setP] = useState(ultimos30());
  const [painel, setPainel] = useState(false);
  const [estId, setEstId] = useState(null); // id do pagamento a estornar
  const { user } = useAuth();
  const toast = useToast();
  const funcionarios = useList('/funcionarios', []);
  const lista = useList(`/pagamentos?de=${p.de}&ate=${p.ate}`, [p.de, p.ate]);
  const resumo = useList(`/fluxo/folha?de=${p.de}&ate=${p.ate}`, [p.de, p.ate]);

  const recarregar = () => { lista.reload(); resumo.reload(); };
  const semEquipe = !funcionarios.loading && (funcionarios.data || []).filter((x) => x.ativo).length === 0;

  const confirmarEstorno = async (motivo) => {
    try {
      await api.post(`/pagamentos/${estId}/estorno`, { motivo });
      setEstId(null); toast('Pagamento estornado'); recarregar();
    } catch (e) { toast(e.message, 'err'); throw e; }
  };

  return (
    <div className="page">
      <div className="lc-top">
        <h1>Equipe</h1>
        {!semEquipe && <button className="sec" type="button" onClick={() => setPainel(true)}>+ Pagamento</button>}
      </div>

      {semEquipe ? (
        <EmptyState action={<Link to="/config">Cadastrar equipe</Link>}>
          Ninguém cadastrado na equipe ainda. Cadastre os funcionários em Cadastros › Equipe para poder lançar pagamentos.
        </EmptyState>
      ) : (
        <>
          <div className="card row">
            <div><label>De</label><input type="date" value={p.de} onChange={(e) => setP({ ...p, de: e.target.value })} /></div>
            <div><label>Até</label><input type="date" value={p.ate} onChange={(e) => setP({ ...p, ate: e.target.value })} /></div>
          </div>

          <div className="card">
            <h2>Custo por vínculo no período</h2>
            {(resumo.data || []).length ? (
              <div className="scroll"><table><tbody>
                {resumo.data.map((x, i) => (
                  <tr key={i}><td>{vinculoLabel(x.tipo_vinculo)}</td><td className="num"><Money value={x.total} /></td></tr>
                ))}
              </tbody></table></div>
            ) : (
              <EmptyState action={<button type="button" onClick={() => setPainel(true)}>Lançar pagamento</button>}>
                O custo da equipe por vínculo (fixo, temporário, diarista) aparece aqui, somando os pagamentos do período.
              </EmptyState>
            )}
          </div>

          <div className="card">
            <h2>Pagamentos no período</h2>
            {(lista.data || []).length ? (
              <div className="scroll">
                <table>
                  <thead><tr><th>Data</th><th>Funcionário</th><th>Vínculo</th><th>Referência</th><th className="num">Valor</th><th>Por</th><th></th></tr></thead>
                  <tbody>
                    {lista.data.map((x) => (
                      <tr key={x.id} className={x.estorno_de_id ? 'estornado' : undefined}>
                        <td>{String(x.data).slice(0, 10)}</td>
                        <td>{x.funcionario_nome}</td>
                        <td>{vinculoLabel(x.tipo_vinculo_snapshot)}</td>
                        <td>{x.periodo_referencia || '—'}</td>
                        <td className="num"><Money value={x.valor} /></td>
                        <td className="muted">{x.usuario_nome || '—'}</td>
                        <td>{!x.estorno_de_id && user?.perfil === 'dono' && <button className="link" onClick={() => setEstId(x.id)}>estornar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState action={<button type="button" onClick={() => setPainel(true)}>Lançar o primeiro pagamento</button>}>
                Os pagamentos de folha lançados neste período aparecem aqui.
              </EmptyState>
            )}
            {lista.err && <div className="err">{lista.err}</div>}
          </div>
        </>
      )}

      {painel && (
        <LancamentoPanel tipoInicial="folha" onClose={() => setPainel(false)} onLancado={recarregar} />
      )}

      {estId != null && (
        <EstornoModal onConfirmar={confirmarEstorno} onClose={() => setEstId(null)} />
      )}
    </div>
  );
}
