import { useEffect, useState } from 'react';
import { api } from './api.js';

// carrega uma lista e reexpoe reload()
export function useList(path, deps = []) {
  const [data, setData] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    api.get(path).then(setData).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(reload, deps); // eslint-disable-line
  return { data, err, loading, reload, setData };
}

// form controlado simples
export function useForm(initial) {
  const [v, setV] = useState(initial);
  const bind = (k) => ({
    value: v[k] ?? '',
    onChange: (e) => setV({ ...v, [k]: e.target.value }),
  });
  return [v, setV, bind];
}
