import { useEffect } from 'react';
import AddToHomeHint from './components/AddToHomeHint';
import { CansIcon, GearIcon, PawIcon, PillIcon, ScanIcon } from './components/TabIcons';
import { ensureSeeded } from './lib/db';
import { back, matchRoute, navigate, useRoute } from './lib/router';
import { bumpData } from './lib/store';
import CanDetail from './pages/CanDetail';
import CanForm from './pages/CanForm';
import CanList from './pages/CanList';
import CatDetail from './pages/CatDetail';
import CatList from './pages/CatList';
import Settings from './pages/Settings';
import Supplements from './pages/Supplements';

const TABS = [
  { path: '/', label: '罐頭庫', Icon: CansIcon },
  { path: '/scan', label: '新增', Icon: ScanIcon },
  { path: '/supp', label: '保健品', Icon: PillIcon },
  { path: '/cats', label: '貓咪', Icon: PawIcon },
  { path: '/settings', label: '設定', Icon: GearIcon },
] as const;

interface Resolved {
  title: string;
  element: React.ReactNode;
  /** 分頁根層級不顯示返回鍵 */
  root: boolean;
}

function resolve(path: string): Resolved {
  if (path === '/') return { title: '罐頭庫', element: <CanList />, root: true };
  if (path === '/scan') return { title: '新增罐頭', element: <CanForm />, root: true };
  if (path === '/supp') return { title: '保健品', element: <Supplements />, root: true };
  if (path === '/cats') return { title: '貓咪', element: <CatList />, root: true };
  if (path === '/settings') return { title: '設定', element: <Settings />, root: true };

  const edit = matchRoute('/can/:id/edit', path);
  if (edit?.id) return { title: '編輯罐頭', element: <CanForm canId={edit.id} />, root: false };

  const detail = matchRoute('/can/:id', path);
  if (detail?.id) return { title: '罐頭', element: <CanDetail canId={detail.id} />, root: false };

  const cat = matchRoute('/cat/:id', path);
  if (cat?.id) return { title: '貓咪', element: <CatDetail catId={cat.id} />, root: false };

  return {
    title: '找不到頁面',
    element: (
      <div className="page">
        <div className="empty">
          <p className="empty-emoji">🙀</p>
          <p>這個網址不存在。</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            回罐頭庫
          </button>
        </div>
      </div>
    ),
    root: false,
  };
}

export default function App() {
  const path = useRoute();
  const { title, element, root } = resolve(path);

  useEffect(() => {
    void ensureSeeded().then(bumpData);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <div className="app">
      <header className="app-header">
        {!root && (
          <button type="button" className="header-back" onClick={() => back()} aria-label="返回">
            ‹
          </button>
        )}
        <h1 className="app-title">{title}</h1>
      </header>

      <main className="app-main">
        <AddToHomeHint />
        {element}
      </main>

      <nav className="tabbar" aria-label="主選單">
        {TABS.map(({ path: p, label, Icon }) => {
          const on = p === '/' ? path === '/' : path.startsWith(p);
          return (
            <button
              key={p}
              type="button"
              className={`tab${on ? ' tab-on' : ''}`}
              onClick={() => navigate(p)}
              aria-current={on ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
