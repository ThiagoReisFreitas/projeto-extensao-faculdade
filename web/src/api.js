const TOKEN_KEY = 'pensador_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t, manter = true) => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (t) (manter ? localStorage : sessionStorage).setItem(TOKEN_KEY, t);
};

async function req(method, path, body, isForm) {
  const headers = {};
  const tok = getToken();
  if (tok) headers.Authorization = `Bearer ${tok}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    // 401 numa tentativa de login e so senha errada -> deixa o form mostrar o erro,
    // nao forca reload (isso apagaria o erro exibido e qualquer formulario aberto).
    if (res.status === 401 && path !== '/auth/login') {
      setToken(null);
      sessionStorage.setItem('pensador_sessao_expirada', '1');
      location.href = '/login';
    }
    const err = new Error((data && data.error) || `erro ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  put: (p, b) => req('PUT', p, b),
  postForm: (p, fd) => req('POST', p, fd, true),
  upload: (tipo, file) => {
    const fd = new FormData();
    fd.append('arquivo', file, 'comprovante.webp');
    return req('POST', `/uploads/${tipo}`, fd, true);
  },
};

// baixa uma rota autenticada que devolve arquivo (ex.: export.csv) — <a href> puro
// nao manda o Bearer token, entao isso busca com fetch e dispara o download via blob.
export async function baixarArquivo(path, nomeFallback = 'arquivo') {
  const tok = getToken();
  const res = await fetch(`/api${path}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      sessionStorage.setItem('pensador_sessao_expirada', '1');
      location.href = '/login';
    }
    throw new Error(`erro ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const nome = /filename="?([^"]+)"?/.exec(cd)?.[1] || nomeFallback;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const brl = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const hoje = () => new Date().toISOString().slice(0, 10);
