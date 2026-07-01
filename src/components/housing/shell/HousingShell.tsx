import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { SceneryVideo } from '../workspace/SceneryVideo';
import { AppHeader } from './AppHeader';
import { StatusBar } from '../workspace/StatusBar';
import '../../../styles/housing.css';

/**
 * ハウジング全ページ共通のシェル (Admin の AdminLayout + Outlet パターン踏襲)。
 * 背景動画 + ヘッダー(タブ) + <Outlet/> + ステータスバー。
 * 各ページ (探す/お気に入り/…) は子ルートとして Outlet に描画される。
 */
export const HousingShell: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);

  // 物件データを 1 回だけロード (冪等・全ページ共有)。
  useEffect(() => {
    void useHousingListingsStore.getState().load();
  }, []);

  // 固定ビューポート (body スクロールロック) — 既存 workspace の踏襲。
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <main className="housing-workspace housing-shell-root" data-theme={theme}>
      <SceneryVideo theme={theme} />
      <div className="housing-shell">
        <AppHeader />
        <div className="housing-shell-body">
          <Outlet />
        </div>
        <StatusBar />
      </div>
    </main>
  );
};
