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
    if (res.status === 401) { setToken(null); location.href = '/login'; }
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

export const brl = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const hoje = () => new Date().toISOString().slice(0, 10);
