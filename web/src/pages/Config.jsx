import { useState } from 'react';
import { api } from '../api.js';
import { useList } from '../ui.jsx';
import { useToast } from '../toast.jsx';
import { EmptyState, Modal, Label, CampoAjuda, SenhaInput } from '../components.jsx';
import { Selo, tipoTaxaLabel, vinculoLabel, perfilLabel, pct } from '../rotulos.jsx';

const TAXA_AJUDA =
  'Percentual descontado pela operadora nesse tipo de recebimento. Editar aqui não altera taxas já lançadas em receitas antigas, só as futuras.';

// CRUD generico de cadastro. campos: [{k, label, type, options, ajuda,
//   hideInTable, fmtCell(val), boolLabels:[sim,nao], optionLabel(v)}]
function Cadastro({ titulo, intro, path, campos, novo, cardView }) {
  const { data, err, reload } = useList(path, []);
  const [edit, setEdit] = useState(null);
  const [erro, setErro] = useState('');
  const toast = useToast();
  const fechar = () => { setEdit(null); setErro(''); };
  const cols = campos.filter((c) => !c.hideInTable);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (edit.id) await api.put(`${path}/${edit.id}`, edit);
      else await api.post(path, edit);
      setEdit(null); toast('Salvo'); reload();
    } catch (e) { setErro(e.message); }
  };

  const campo = (c) => {
    const val = edit[c.k] ?? '';
    if (c.k === 'email' && edit.id) {
      return <input type="text" value={val} readOnly className="ro"
        title="O e-mail não muda depois de criado" />;
    }
    if (c.type === 'password') {
      return (
        <SenhaInput id={`f-${c.k}`} value={val} autoComplete="new-password"
          placeholder={edit.id ? 'deixe em branco pra manter a atual' : ''}
          onChange={(e) => setEdit({ ...edit, [c.k]: e.target.value })} />
      );
    }
    if (c.type === 'bool') {
      const [sim, nao] = c.boolLabels || ['Sim', 'Não'];
      return (
        <select value={String(!!edit[c.k])} onChange={(e) => setEdit({ ...edit, [c.k]: e.target.value === 'true' })}>
          <option value="true">{sim}</option><option value="false">{nao}</option>
        </select>
      );
    }
    if (c.type === 'select') {
      return (
        <select value={val} onChange={(e) => setEdit({ ...edit, [c.k]: e.target.value })}>
          {c.options.map((o) => <option key={o} value={o}>{c.optionLabel ? c.optionLabel(o) : o}</option>)}
        </select>
      );
    }
    return <input type={c.type || 'text'} value={val} onChange={(e) => setEdit({ ...edit, [c.k]: e.target.value })} />;
  };

  const cell = (c, row) => {
    if (c.fmtCell) return c.fmtCell(row[c.k]);
    return String(row[c.k] ?? '');
  };

  return (
    <div className="card">
      <h2>{titulo}</h2>
      {intro && <p className="muted" style={{ margin: '0 0 12px' }}>{intro}</p>}
      {err && <div className="err">{err}</div>}

      {(data || []).length && cardView ? (
        <div className="cad-cards">
          {data.map((row) => (
            <div className="cad-card" key={row.id}>
              <div className="cad-card-top">
                <strong>{row.nome}</strong>
                {campos.some((c) => c.k === 'ativo') && cell(campos.find((c) => c.k === 'ativo'), row)}
              </div>
              <p className="cad-card-meta">
                {cols.filter((c) => c.k !== 'nome' && c.k !== 'ativo')
                  .map((c) => `${c.label}: ${c.fmtCell ? c.fmtCell(row[c.k]) : row[c.k]}`).join('  ·  ')}
              </p>
              <button className="link" onClick={() => setEdit({ ...row })}>editar</button>
            </div>
          ))}
        </div>
      ) : (data || []).length ? (
        <div className="scroll">
          <table>
            <thead><tr>{cols.map((c) => (
              <th key={c.k}>
                <span className="th-label">{c.label}{c.ajuda && <CampoAjuda texto={c.ajuda} rotulo={c.label} />}</span>
              </th>
            ))}<th>Ações</th></tr></thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  {cols.map((c) => <td key={c.k}>{cell(c, row)}</td>)}
                  <td><button className="link" onClick={() => setEdit({ ...row })}>editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>
          Nada cadastrado aqui ainda. O que você adicionar passa a aparecer nos formulários de lançamento.
        </EmptyState>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="sec" onClick={() => { setErro(''); setEdit({ ...novo }); }}>+ novo</button>
      </div>

      {edit && (
        <Modal title={`${edit.id ? 'Editar' : 'Novo'} · ${titulo}`} onClose={fechar}>
          <form onSubmit={salvar}>
            {campos.map((c) => (
              <div key={c.k}>
                <Label ajuda={c.ajuda}>{c.label}</Label>
                {campo(c)}
              </div>
            ))}
            {erro && <div className="err">{erro}</div>}
            <div className="row" style={{ marginTop: 16 }}>
              <button type="submit">{edit.id ? 'Salvar' : 'Criar'}</button>
              <button type="button" className="sec" onClick={fechar}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const estadoCampo = (contexto) => ({
  k: 'ativo', label: 'Estado', type: 'bool', boolLabels: ['Em uso', 'Arquivada'],
  fmtCell: (v) => <Selo ativo={v} />,
  ajuda: `Itens arquivados somem dos formulários de ${contexto}, mas continuam corretos nos lançamentos antigos que já usaram eles.`,
});

export default function Config() {
  return (
    <div className="page">
      <h1>Cadastros</h1>
      <p className="page-intro">
        Aqui você define as opções que aparecem nos formulários de lançamento — maquininhas, formas de
        pagamento, categorias de gasto e a equipe. Alterações valem só para lançamentos novos; o que já
        foi lançado não muda.
      </p>
      <div className="cfg">
        <Cadastro titulo="Maquininhas" path="/operadoras" cardView
          intro="As taxas daqui são descontadas automaticamente de cada venda no cartão."
          novo={{ nome: '', taxa_debito: 0, taxa_credito_vista: 0, taxa_credito_parcelado: 0, ativo: true }}
          campos={[
            { k: 'nome', label: 'Nome', ajuda: 'Nome da maquininha ou adquirente, como aparece no seu extrato. Ex: Stone, Cielo, Rede.' },
            { k: 'taxa_debito', label: 'Débito', type: 'number', fmtCell: pct, ajuda: TAXA_AJUDA },
            { k: 'taxa_credito_vista', label: 'Crédito à vista', type: 'number', fmtCell: pct, ajuda: TAXA_AJUDA },
            { k: 'taxa_credito_parcelado', label: 'Crédito parcelado', type: 'number', fmtCell: pct, ajuda: TAXA_AJUDA },
            estadoCampo('lançamento'),
          ]} />
        <Cadastro titulo="Formas de pagamento" path="/formas-pagamento"
          intro="Aparecem como opção na hora de lançar uma receita."
          novo={{ nome: '', requer_operadora: false, tipo_taxa: 'nenhuma', ativo: true }}
          campos={[
            { k: 'nome', label: 'Nome', ajuda: 'Como aparece na tela de lançar receita. Ex: Dinheiro, PIX, Débito.' },
            { k: 'tipo_taxa', label: 'Taxa aplicada', type: 'select',
              options: ['nenhuma', 'debito', 'credito_vista', 'credito_parcelado'],
              optionLabel: tipoTaxaLabel, fmtCell: tipoTaxaLabel,
              ajuda: 'Qual taxa da maquininha se aplica a essa forma de pagamento. "Sem taxa" para dinheiro, PIX e vale.' },
            { k: 'requer_operadora', label: 'Pede maquininha ao lançar', type: 'bool', hideInTable: true,
              ajuda: 'Ligue para formas em cartão (débito, crédito): o formulário passa a pedir qual maquininha processou. Desligue para dinheiro, PIX, etc.' },
            estadoCampo('lançamento'),
          ]} />
        <Cadastro titulo="Categorias de gasto" path="/categorias"
          intro="Aparecem como opção na hora de lançar um gasto e agrupam os relatórios."
          novo={{ nome: '', ativo: true }}
          campos={[
            { k: 'nome', label: 'Nome', ajuda: "Nome da categoria como vai aparecer no formulário de Gastos, por exemplo 'Insumos' ou 'Aluguel'." },
            estadoCampo('Gastos'),
          ]} />
        <Cadastro titulo="Equipe" path="/funcionarios"
          intro="Quem aparece na hora de lançar um pagamento de folha."
          novo={{ nome: '', tipo_vinculo: 'diarista', valor_referencia: 0, ativo: true }}
          campos={[
            { k: 'nome', label: 'Nome', ajuda: 'Nome do funcionário como vai aparecer no formulário de Folha.' },
            { k: 'tipo_vinculo', label: 'Vínculo', type: 'select', options: ['fixo', 'temporario', 'diarista'],
              optionLabel: vinculoLabel, fmtCell: vinculoLabel,
              ajuda: 'Fixo, temporário ou diarista. Fica registrado em cada pagamento no momento em que ele é feito — mudar aqui depois não altera pagamentos já lançados.' },
            { k: 'valor_referencia', label: 'Valor de referência', type: 'number', fmtCell: (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              ajuda: 'Um valor de referência pra facilitar o lançamento (ex: o valor da diária). Você ainda pode digitar um valor diferente na hora de lançar o pagamento.' },
            estadoCampo('Folha'),
          ]} />
        <Cadastro titulo="Acesso e perfis" path="/usuarios"
          intro="Quem pode entrar no sistema. Só o Dono mexe aqui."
          novo={{ nome: '', email: '', senha: '', perfil: 'caixa' }}
          campos={[
            { k: 'nome', label: 'Nome', ajuda: 'Nome de quem vai usar o sistema, mostrado no topo da tela.' },
            { k: 'email', label: 'E-mail', ajuda: 'Usado pra login no sistema. Precisa ser único.' },
            { k: 'senha', label: 'Senha', type: 'password', hideInTable: true,
              ajuda: 'Ao editar, deixe em branco pra manter a senha atual. Preencha só pra definir uma nova.' },
            { k: 'perfil', label: 'Papel', type: 'select', options: ['dono', 'caixa'],
              optionLabel: perfilLabel, fmtCell: perfilLabel,
              ajuda: 'Dono: acesso total, incluindo Cadastros e reabrir dias fechados. Caixa: lança receitas, gastos e pagamentos, sem mexer em configuração.' },
          ]} />
      </div>
    </div>
  );
}
