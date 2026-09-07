import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';
import { initTheme } from './theme.js';
import { ToastProvider } from './toast.jsx';
import { AuthProvider, Protected } from './auth.jsx';
import Layout from './pages/Layout.jsx';
import Login from './pages/Login.jsx';
import Redefinir from './pages/Redefinir.jsx';
import Hoje from './pages/Hoje.jsx';
import Painel from './pages/Painel.jsx';
import LivroCaixa from './pages/LivroCaixa.jsx';
import Equipe from './pages/Equipe.jsx';
import Config from './pages/Config.jsx';
import Importar from './pages/Importar.jsx';

initTheme();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset/:token" element={<Redefinir />} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route index element={<Hoje />} />
              <Route path="painel" element={<Painel />} />
              <Route path="livro-caixa" element={<LivroCaixa />} />
              <Route path="folha" element={<Equipe />} />
              <Route path="receitas" element={<Navigate to="/livro-caixa" replace />} />
              <Route path="gastos" element={<Navigate to="/livro-caixa" replace />} />
              <Route path="config" element={<Protected dono><Config /></Protected>} />
              <Route path="importar" element={<Protected dono><Importar /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>,
);
