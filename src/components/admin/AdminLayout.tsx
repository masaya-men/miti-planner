/**
 * 管理画面レイアウト
 * サイドナビゲーション + メインコンテンツエリア
 * Phase 0では骨組みのみ。Phase 1以降でセクションを追加
 */
import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';

const NAV_ITEMS = [
  { path: '/admin', labelKey: 'admin.dashboard', end: true },
  { path: '/admin/contents', labelKey: 'admin.contents', end: false },
  { path: '/admin/templates', labelKey: 'admin.templates', end: false },
] as const;

export function AdminLayout() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  // タブタイトルを「管理者│LoPo」に設定
  useEffect(() => {
    const prev = document.title;
    document.title = t('admin.page_title');
    return () => { document.title = prev; };
  }, [t]);

  return (
    <div className="flex h-screen bg-app-bg text-app-text">
      {/* サイドナビ */}
      <nav className="w-56 border-r border-app-text/10 flex flex-col">
        <div className="p-4 border-b border-app-text/10">
          <div className="text-sm font-bold">LoPo Admin</div>
          <div className="text-[10px] text-app-text-muted truncate mt-1">
            {user?.displayName || user?.email || 'Admin'}
          </div>
        </div>
        <div className="flex-1 p-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-app-text/10 font-bold'
                    : 'hover:bg-app-text/5'
                }`
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
        <div className="p-2 border-t border-app-text/10">
          <NavLink
            to="/miti"
            className="block px-3 py-2 rounded text-xs text-app-text-muted hover:bg-app-text/5 transition-colors"
          >
            ← {t('admin.back_to_app')}
          </NavLink>
        </div>
      </nav>
      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
