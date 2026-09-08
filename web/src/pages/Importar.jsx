import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useList } from '../ui.jsx';
import { useToast } from '../toast.jsx';
import { Label } from '../components.jsx';

// dropdown proprio: o <select> nativo do Firefox/Linux ignora CSS e abre a lista
// com a fonte gigante do tema do SO. options = [{ value, label }].
function Selecao({ id, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const fora = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const atual = options.find((o) => String(o.value) === String(value));
  return (
    <div className="sel" ref={ref}>
      <button type="button" id={id} className="sel-btn" aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <span>{atual ? atual.label : options[0]?.label}</span>
        <span className="caret" aria-hidden>▾</span>
      </button>
      {open && (
        <ul className="sel-list" role="listbox">
          {options.map((o) => (
            <li key={String(o.value)} role="option" aria-selected={String(o.value) === String(value)}
              className={String(o.value) === String(value) ? 'on' : undefined}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TIPOS = [['receitas', 'Receitas'], ['gastos', 'Gastos'], ['pagamentos', 'Pagamentos']];
const NOME_TIPO = { receitas: 'receitas', gastos: 'gastos', pagamentos: 'pagamentos' };

// [chave no nosso banco, rótulo, obrigatório?, ajuda]
const CAMPOS = {
  receitas: [
    ['data', 'Data', true, 'Coluna do arquivo com a data da venda/recebimento.'],
    ['valor_bruto', 'Valor bruto', true, 'Coluna com o valor recebido ANTES de descontar a taxa da maquininha. A taxa é calculada aqui pelo sistema.'],
    ['forma_pagamento', 'Forma de pagamento', true, 'Coluna com a forma (Dinheiro, PIX, Débito...). O texto precisa bater com as formas cadastradas em Cadastros. Use "padrão" para preencher quando a célula estiver vazia.'],
    ['operadora', 'Maquininha', false, 'Coluna com a operadora do cartão (Stone, Cielo...). Só faz sentido para Débito/Crédito.'],
    ['observacao', 'Observação', false, 'Coluna opcional de texto livre (ex: nº da mesa, comanda).'],
  ],
  gastos: [
    ['data', 'Data', true, 'Coluna do arquivo com a data do gasto.'],
    ['valor', 'Valor', true, 'Coluna com o valor do gasto.'],
    ['categoria', 'Categoria', true, 'Coluna com a categoria (Insumos, Aluguel, Energia...). O texto precisa bater com as categorias cadastradas. Use "padrão" para quando a célula estiver vazia.'],
    ['descricao', 'Descrição', false, 'Coluna opcional de texto livre (ex: fornecedor, nº da nota).'],
  ],
  pagamentos: [
    ['data', 'Data', true, 'Coluna do arquivo com a data do pagamento.'],
    ['valor', 'Valor', true, 'Coluna com o valor pago ao funcionário.'],
    ['funcionario', 'Funcionário', true, 'Coluna com o nome do funcionário. Precisa bater com um funcionário cadastrado em Equipe.'],
    ['periodo_referencia', 'Período de referência', false, 'Coluna opcional (ex: "semana 1", "1ª quinzena").'],
  ],
};

// campo -> chave da opção de "padrão" e lista de onde tirar as opções
const DEFAULTS = {
  forma_pagamento: { chave: 'forma_default_id', lista: 'formas' },
  categoria: { chave: 'categoria_default_id', lista: 'categorias' },
  funcionario: { chave: 'funcionario_default_id', lista: 'funcionarios' },
};

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const ANO_ATUAL = new Date().getFullYear();
const OPCOES_INICIAIS = { formato_data: 'br', formato_valor: 'br' };

export default function Importar() {
  const toast = useToast();
  const [tipo, setTipo] = useState('gastos');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { colunas, amostra, total, abas, cabecalho_linha }
  const [mapa, setMapa] = useState({});
  const [opcoes, setOpcoes] = useState(OPCOES_INICIAIS);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [resultado, setResultado] = useState(null); // { inseridos|simulado, erros, ignoradas, casamentos }
  const [concluido, setConcluido] = useState(false); // import gravado com sucesso

  // opcoes atuais sem recriar analisar a cada tecla; timer p/ debounce do "cabeçalho na linha"
  const opcoesRef = useRef(opcoes);
  useEffect(() => { opcoesRef.current = opcoes; }, [opcoes]);
  const cabTimer = useRef(null);
  useEffect(() => () => clearTimeout(cabTimer.current), []);

  const listas = {
    categorias: useList('/categorias', []).data || [],
    formas: useList('/formas-pagamento', []).data || [],
    funcionarios: useList('/funcionarios', []).data || [],
  };

  const reset = () => { setPreview(null); setMapa({}); setResultado(null); setConcluido(false); };
  const recomecar = () => {
    setFile(null); setOpcoes(OPCOES_INICIAIS); reset();
  };
  const escolherTipo = (t) => { setTipo(t); reset(); };
  const pegarArquivo = (f) => { setFile(f || null); reset(); };
  const soltar = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) pegarArquivo(f);
  };

  // lê colunas/amostra. aceita override das opcoes (aba / linha do cabeçalho mudam a leitura).
  const analisar = async (over) => {
    if (!file) return;
    const op = { ...opcoesRef.current, ...over };
    if (over) setOpcoes(op);
    setBusy(true); setResultado(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', file, file.name);
      fd.append('opcoes', JSON.stringify(op));
      const p = await api.postForm(`/importacao/${tipo}/preview`, fd);
      setPreview(p);
      if (!over) {
        const auto = {};
        for (const [k] of CAMPOS[tipo]) {
          const alvo = norm(k);
          const hit = p.colunas.find((c) => norm(c).includes(alvo) || alvo.includes(norm(c)));
          if (hit) auto[k] = hit;
        }
        setMapa(auto);
      }
    } catch (e) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const temDefault = (k) => DEFAULTS[k] && opcoes[DEFAULTS[k].chave];
  const faltando = useMemo(
    () => CAMPOS[tipo].filter(([k,, ob]) => ob && !mapa[k] && !temDefault(k)).map(([, l]) => l),
    [tipo, mapa, opcoes],
  );

  // simular=true -> só valida e devolve diagnóstico; senão importa (grava no banco).
  const enviar = async (simular) => {
    setBusy(true); setResultado(null);
    try {
      const fd = new FormData();
      fd.append('arquivo', file, file.name);
      fd.append('mapa', JSON.stringify(mapa));
      fd.append('opcoes', JSON.stringify({ ...opcoes, simular: simular || undefined }));
      const res = await api.postForm(`/importacao/${tipo}`, fd);
      setResultado(res);
      if (res.simulado) {
        toast(res.erros.length ? `${res.erros.length} linha(s) com problema` : `${res.ok} linha(s) prontas`, res.erros.length ? 'err' : 'ok');
      } else {
        setConcluido(true);
        toast(`Importação concluída — ${res.inseridos} registro(s) salvos`);
      }
    } catch (e) {
      if (e.data && Array.isArray(e.data.erros)) setResultado(e.data);
      else toast(e.message, 'err');
    } finally { setBusy(false); }
  };

  const mostrarResultado = resultado
    && (resultado.simulado || resultado.inseridos > 0 || (resultado.erros && resultado.erros.length));

  return (
    <div className="page">
      <h1>Importar de outro sistema</h1>
      <p className="page-intro">
        Traga receitas, gastos ou pagamentos de uma planilha (CSV ou Excel) de um controle
        anterior. Você escolhe qual coluna do seu arquivo corresponde a cada campo. Se qualquer
        linha obrigatória tiver problema, nada é importado — corrija e tente de novo.
      </p>

      <div className="card">
        <h2>1. Arquivo</h2>
        <Label ajuda="Escolha o que a planilha contém. Isso define quais campos você vai mapear a seguir.">
          Tipo de registro
        </Label>
        <div className="seg" role="group" aria-label="Tipo de registro">
          {TIPOS.map(([v, l]) => (
            <button key={v} type="button" className={tipo === v ? 'on' : undefined}
              onClick={() => escolherTipo(v)}>{l}</button>
          ))}
        </div>

        <Label htmlFor="imp-file" ajuda="Arquivo .csv ou Excel (.xlsx / .xls) exportado do seu controle anterior. Arraste para a área abaixo ou clique em Escolher arquivo.">
          Planilha CSV ou Excel
        </Label>
        <div className="dropzone" data-over={dragOver || undefined}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={soltar}>
          <p className="dz-hint">
            {file ? <>Arquivo: <b>{file.name}</b></> : 'Arraste o arquivo aqui ou escolha:'}
          </p>
          <input id="imp-file" type="file" accept=".csv,.xlsx,.xls,text/csv"
            onChange={(e) => pegarArquivo(e.target.files[0])} />
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" disabled={!file || busy} onClick={() => analisar()}>
            {busy && !preview ? 'lendo…' : 'Ler colunas'}
          </button>
        </div>
      </div>

      {preview && !concluido && (
        <div className="card">
          <h2>2. Mapeamento — {preview.total} linha(s)</h2>

          {preview.abas?.length > 1 && (
            <>
              <Label ajuda="Para arquivos Excel com mais de uma aba, escolha a aba onde estão os lançamentos.">
                Aba da planilha
              </Label>
              <div className="seg" role="group" aria-label="Aba da planilha">
                {preview.abas.map((a) => (
                  <button key={a} type="button"
                    className={(opcoes.aba || preview.abas[0]) === a ? 'on' : undefined}
                    onClick={() => analisar({ aba: a })}>{a}</button>
                ))}
              </div>
            </>
          )}
          <div style={{ maxWidth: 220 }}>
            <Label htmlFor="imp-cab" ajuda="Número da linha onde estão os títulos das colunas. O sistema tenta achar sozinho; ajuste se a prévia abaixo vier torta.">
              Cabeçalho na linha
            </Label>
            <input id="imp-cab" type="number" min="1"
              value={opcoes.linha_cabecalho ?? preview.cabecalho_linha ?? 1}
              onChange={(e) => {
                const v = Number(e.target.value) || 1;
                setOpcoes((o) => ({ ...o, linha_cabecalho: v }));
                clearTimeout(cabTimer.current);
                cabTimer.current = setTimeout(() => analisar({ linha_cabecalho: v }), 450);
              }} />
          </div>

          {CAMPOS[tipo].map(([k, rot, ob, ajuda]) => (
            <div key={k}>
              <Label htmlFor={`map-${k}`} ajuda={ajuda}>{rot}{ob ? ' *' : ' (opcional)'}</Label>
              <Selecao id={`map-${k}`} value={mapa[k] || ''}
                onChange={(v) => setMapa({ ...mapa, [k]: v })}
                options={[{ value: '', label: '— nenhuma —' },
                  ...preview.colunas.map((c) => ({ value: c, label: c }))]} />
              {DEFAULTS[k] && (
                <div style={{ marginTop: 6 }}>
                  <Selecao value={opcoes[DEFAULTS[k].chave] || ''}
                    onChange={(v) => setOpcoes({ ...opcoes, [DEFAULTS[k].chave]: v })}
                    options={[{ value: '', label: 'usar padrão quando a coluna estiver vazia…' },
                      ...listas[DEFAULTS[k].lista].map((x) => ({ value: x.id, label: `padrão: ${x.nome}` }))]} />
                </div>
              )}
            </div>
          ))}

          <Label ajuda="Como as datas estão escritas no arquivo. Ex: 31/12/2026 é DD/MM/AAAA.">
            Formato de data
          </Label>
          <div className="seg" role="group" aria-label="Formato de data">
            {[['br', 'DD/MM/AAAA'], ['iso', 'AAAA-MM-DD'], ['us', 'MM/DD/AAAA']].map(([v, l]) => (
              <button key={v} type="button" className={opcoes.formato_data === v ? 'on' : undefined}
                onClick={() => setOpcoes({ ...opcoes, formato_data: v })}>{l}</button>
            ))}
          </div>

          <Label ajuda="Como os números estão escritos. 1.234,56 é o padrão do Brasil; 1,234.56 é o padrão dos EUA.">
            Formato de valor
          </Label>
          <div className="seg" role="group" aria-label="Formato de valor">
            {[['br', '1.234,56'], ['us', '1,234.56']].map(([v, l]) => (
              <button key={v} type="button" className={opcoes.formato_valor === v ? 'on' : undefined}
                onClick={() => setOpcoes({ ...opcoes, formato_valor: v })}>{l}</button>
            ))}
          </div>

          <div style={{ maxWidth: 220 }}>
            <Label htmlFor="ano-pad" ajuda="Se alguma data vier só como dia/mês (ex: 05/09), o sistema completa com este ano.">
              Ano quando faltar na data
            </Label>
            <input id="ano-pad" type="number"
              value={opcoes.ano_padrao ?? ANO_ATUAL}
              onChange={(e) => setOpcoes({ ...opcoes, ano_padrao: Number(e.target.value) || ANO_ATUAL })} />
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
          <p className="page-intro" style={{ marginTop: 12 }}>
            <b>Validar</b> só confere o arquivo e não grava nada. <b>Importar</b> grava os
            registros no banco de uma vez — se qualquer linha obrigatória falhar, nada é gravado.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="ghost" disabled={busy || faltando.length > 0}
              onClick={() => enviar(true)}>
              {busy ? 'verificando…' : 'Validar antes de importar'}
            </button>
            <button type="button" disabled={busy || faltando.length > 0} onClick={() => enviar(false)}>
              {busy ? 'importando…' : `Importar ${preview.total} linha(s)`}
            </button>
          </div>
        </div>
      )}

      {mostrarResultado && (
        <div className="card">
          <h2>3. Resultado</h2>

          {concluido && resultado.inseridos >= 0 && (
            <div className="imp-feito">
              <p className="money--pos">
                <b>Importação concluída.</b> {resultado.inseridos} lançamento(s) de {NOME_TIPO[tipo]} foram
                gravados no banco. Não há aprovação nem etapa seguinte.
              </p>
              <ol className="imp-passos">
                <li>
                  <b>Onde ver:</b> na página <b>Livro-caixa</b>, na data que estava na planilha
                  (não necessariamente hoje). Se os lançamentos forem de outro mês, troque o mês lá em cima;
                  filtre por <b>{tipo === 'receitas' ? 'Receitas' : tipo === 'gastos' ? 'Gastos' : 'Folha'}</b> para
                  achar mais rápido.
                </li>
                <li>Eles também entram no <b>Painel</b> e no fechamento do dia de cada lançamento.</li>
                <li>
                  Importou errado ou em duplicidade? Abra o lançamento no Livro-caixa e clique em <b>estornar</b>
                  (só o Dono). Estorne um a um — não existe "desfazer importação".
                </li>
              </ol>
              <div className="row" style={{ marginTop: 12 }}>
                <Link to="/livro-caixa" style={{ flex: '1 1 160px' }}>
                  <button type="button" style={{ width: '100%' }}>Ver no Livro-caixa</button>
                </Link>
                <button type="button" className="ghost" onClick={recomecar}>Importar outro arquivo</button>
              </div>
            </div>
          )}

          {resultado.simulado && (
            <p className={resultado.erros.length ? 'err' : 'money--pos'}>
              {resultado.erros.length
                ? `${resultado.erros.length} linha(s) com problema — corrija o arquivo/opções antes de importar.`
                : `Tudo certo: ${resultado.ok} linha(s) prontas. Nada foi gravado ainda — clique em "Importar" para salvar.`}
            </p>
          )}
          {!resultado.simulado && !concluido && (
            <p className="err">Nada foi importado — {resultado.erros.length} linha(s) com problema:</p>
          )}

          {resultado.erros?.length > 0 && (
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
          )}

          {resultado.casamentos?.length > 0 && (
            <>
              <p style={{ marginTop: 12 }}>Aproximações usadas (confira se estão certas):</p>
              <ul>
                {resultado.casamentos.map((c, i) => (
                  <li key={i}>{c.campo}: <b>{c.de || '(vazio)'}</b> → <b>{c.para}</b></li>
                ))}
              </ul>
            </>
          )}

          {resultado.ignoradas?.length > 0 && (
            <p className="muted" style={{ marginTop: 12 }}>
              {resultado.ignoradas.length} linha(s) ignorada(s) por parecerem total/resumo:{' '}
              linha(s) {resultado.ignoradas.map((x) => x.linha).join(', ')}.
            </p>
          )}

        </div>
      )}
    </div>
  );
}
