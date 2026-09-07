import { Outlet } from 'react-router-dom';
import { Header, Sidebar } from '../shell.jsx';
import { LancarFab } from '../lancamento.jsx';

// App shell unico: Header + Sidebar + area de conteudo, reusado por todas as rotas.
export default function Layout() {
  return (
    <div className="shell">
      <Header />
      <div className="shell-body">
        <Sidebar />
        <main className="content"><Outlet /></main>
      </div>
      <LancarFab />
    </div>
  );
}
