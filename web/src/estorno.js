// Junta cada lançamento original com a sua linha de reversão (estorno) numa única
// linha: `estornado: true`, `valor: 0` (não mexe no saldo), `valorMostrar` = valor
// original para exibir riscado. Evita mostrar as duas pontas soltas no livro-caixa.
// Entrada: itens já normalizados com { tipo, id, estornoDeId, motivo, valor, ... }.
export function juntarEstornos(raw) {
  const k = (t, id) => `${t}:${id}`;
  const revPorAlvo = new Map(); // "tipo:idOriginal" -> linha de reversão
  raw.forEach((m) => { if (m.estornoDeId != null) revPorAlvo.set(k(m.tipo, m.estornoDeId), m); });
  const ehReversao = new Set(raw.filter((m) => m.estornoDeId != null).map((m) => k(m.tipo, m.id)));

  const out = [];
  raw.forEach((m) => {
    if (ehReversao.has(k(m.tipo, m.id))) return; // é a reversão: já entra junto no original
    const rev = revPorAlvo.get(k(m.tipo, m.id));
    if (rev) out.push({ ...m, estornado: true, motivo: rev.motivo, valorMostrar: m.valor, valor: 0 });
    else out.push({ ...m, valorMostrar: m.valor });
  });
  // reversão cujo lançamento original está fora do período carregado: mostra sozinha
  revPorAlvo.forEach((rev) => {
    const temAlvo = raw.some((m) => k(m.tipo, m.id) === k(rev.tipo, rev.estornoDeId));
    if (!temAlvo) out.push({ ...rev, estornado: true, valorMostrar: rev.valor });
  });
  return out;
}
