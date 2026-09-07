import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useList } from '../ui.jsx';
import { useToast } from '../toast.jsx';

const TIPOS = [['receitas', 'Receitas'], ['gastos', 'Gastos'], ['pagamentos', 'Pagamentos']];

// [chave no nosso banco, rótulo, obrigatório?]
const CAMPOS = {
  receitas: [
    ['data', 'Data', true], ['valor_bruto', 'Valor bruto', true],
    ['forma_pagamento', 'Forma de pagamento', true], ['operadora', 'Maquininha', false],
    ['observacao', 'Observação', false],
  ],
  gastos: [
    ['data', 'Data', true], ['valor', 'Valor', true],
    ['categoria', 'Categoria', true], ['descricao', 'Descrição', false],
  ],
  pagamentos: [
    ['data', 'Data', true], ['valor', 'Valor', true],
    ['funcionario', 'Funcionário', true], ['periodo_referencia', 'Período de referência', false],
  ],
};

// campo -> chave da opção de "padrão" e lista de onde tirar as opções
const DEFAULTS = {
  forma_pagamento: { chave: 'forma_default_id', lista: 'formas' },
  categoria: { chave: 'categoria_default_id', lista: 'categorias' },
  funcionario: { chave: 'funcionario_default_id', lista: 'funcionarios' },
};

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');

export default function Importar() {
  const toast = useToast();
  const [tipo, setTipo] = useState('gastos');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { colunas, amostra, total }
  const [mapa, setMapa] = useState({});
  const [opcoes, setOpcoes] = useState({ formato_data: 'br', formato_valor: 'br' });
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState(null); // { inseridos, erros }

  const listas = {
    categorias: useList('/categorias', []).data || [],
    formas: useList('/formas-pagamento', []).data || [],
    funcionarios: useList('/funcionarios', []).data || [],
  };

  const reset = () => { setPreview(null); setMapa({}); setResultado(null); };
  const escolherTipo = (t) => { setTipo(t); reset(); };

  const analisar = async () => {
    if (!file) return;
    setBusy(true); setResultado(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', file, file.name);
      const p = await api.postForm(`/importacao/${tipo}/preview`, fd);
      setPreview(p);
      const auto = {};
      for (const [k] of CAMPOS[tipo]) {
        const alvo = norm(k);
        const hit = p.colunas.find((c) => norm(c).includes(alvo) || alvo.includes(norm(c)));
        if (hit) auto[k] = hit;
      }
      setMapa(auto);
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const temDefault = (k) => DEFAULTS[k] && opcoes[DEFAULTS[k].chave];
  const faltando = useMemo(
    () => CAMPOS[tipo].filter(([k,, ob]) => ob && !mapa[k] && !temDefault(k)).map(([, l]) => l),
    [tipo, mapa, opcoes],
  );

  const importar = async () => {
    setBusy(true); setResultado(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', file, file.name);
      fd.append('mapa', JSON.stringify(mapa));
      fd.append('opcoes', JSON.stringify(opcoes));
      const res = await api.postForm(`/importacao/${tipo}`, fd);
      setResultado(res);
      toast(`${res.inseridos} registro(s) importado(s)`);
    } catch (e) {
      if (e.data && Array.isArray(e.data.erros)) setResultado(e.data);
      else toast(e.message, 'err');
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <h1>Importar de outro sistema</h1>
      <p className="page-intro">
        Traga receitas, gastos ou pagamentos de uma planilha (CSV) de um controle anterior. Você
        escolhe qual coluna do seu arquivo corresponde a cada campo. Se qualquer linha tiver
        problema, nada é importado — corrija o arquivo e tente de novo.
      </p>

      <div className="card">
        <h2>1. Arquivo</h2>
        <div className="seg" role="group" aria-label="Tipo de registro">
          {TIPOS.map(([v, l]) => (
            <button key={v} type="button" className={tipo === v ? 'on' : undefined}
              onClick={() => escolherTipo(v)}>{l}</button>
          ))}
        </div>
        <label htmlFor="imp-file">Planilha CSV</label>
        <input id="imp-file" type="file" accept=".csv,text/csv"
          onChange={(e) => { setFile(e.target.files[0] || null); reset(); }} />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" disabled={!file || busy} onClick={analisar}>
            {busy && !preview ? 'lendo…' : 'Ler colunas'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="card">
          <h2>2. Mapeamento — {preview.total} linha(s)</h2>
          {CAMPOS[tipo].map(([k, rot, ob]) => (
            <div key={k}>
              <label htmlFor={`map-${k}`}>{rot}{ob ? ' *' : ' (opcional)'}</label>
              <select id={`map-${k}`} value={mapa[k] || ''}
                onChange={(e) => setMapa({ ...mapa, [k]: e.target.value })}>
                <option value="">— nenhuma —</option>
                {preview.colunas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {DEFAULTS[k] && (
                <select style={{ marginTop: 6 }} value={opcoes[DEFAULTS[k].chave] || ''}
                  onChange={(e) => setOpcoes({ ...opcoes, [DEFAULTS[k].chave]: e.target.value })}>
                  <option value="">usar padrão quando a coluna estiver vazia…</option>
                  {listas[DEFAULTS[k].lista].map((x) => (
                    <option key={x.id} value={x.id}>padrão: {x.nome}</option>
                  ))}
                </select>
              )}
            </div>
          ))}

          <div className="row" style={{ marginTop: 12 }}>
            <label htmlFor="fmt-data">Formato de data
              <select id="fmt-data" value={opcoes.formato_data}
                onChange={(e) => setOpcoes({ ...opcoes, formato_data: e.target.value })}>
                <option value="br">DD/MM/AAAA</option>
                <option value="iso">AAAA-MM-DD</option>
                <option value="us">MM/DD/AAAA</option>
              </select>
            </label>
            <label htmlFor="fmt-valor">Formato de valor
              <select id="fmt-valor" value={opcoes.formato_valor}
                onChange={(e) => setOpcoes({ ...opcoes, formato_valor: e.target.value })}>
                <option value="br">1.234,56</option>
                <option value="us">1,234.56</option>
              </select>
            </label>
          </div>

          <div className="scroll" style={{ marginTop: 12 }}>
            <table>
              <thead><tr>{preview.colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {preview.amostra.slice(0, 8).map((row, i) => (
                  <tr key={i}>{preview.colunas.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          {faltando.length > 0 && (
            <p className="err">Falta mapear: {faltando.join(', ')}.</p>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" disabled={busy || faltando.length > 0} onClick={importar}>
              {busy ? 'importando…' : `Importar ${preview.total} linha(s)`}
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="card">
          <h2>3. Resultado</h2>
          {resultado.inseridos > 0 ? (
            <p className="money--pos">{resultado.inseridos} registro(s) importado(s) com sucesso.</p>
          ) : (
            <>
              <p className="err">Nada foi importado — {resultado.erros.length} linha(s) com problema:</p>
              <div className="scroll" style={{ maxHeight: 240 }}>
                <table>
                  <thead><tr><th>Linha</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {resultado.erros.map((e, i) => (
                      <tr key={i}><td className="num">{e.linha}</td><td>{e.motivo}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
