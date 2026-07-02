import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { SceneryVideo } from '../workspace/SceneryVideo';
import { AppHeader } from './AppHeader';
import { StatusBar } from '../workspace/StatusBar';
import { HousingLoginModal } from '../login/HousingLoginModal';
import { HousingAccountModal } from '../login/HousingAccountModal';
import '../../../styles/housing.css';

/**
 * ハウジング全ページ共通のシェル (Admin の AdminLayout + Outlet パターン踏襲)。
 * 背景動画 + ヘッダー(タブ) + <Outlet/> + ステータスバー。
 * 各ページ (探す/お気に入り/…) は子ルートとして Outlet に描画される。
 *
 * HousingLoginModal / HousingAccountModal はここで一度だけマウントする
 * (props なし・useHousingModalStore を内部購読)。AppHeader の openLogin()/openAccount() が
 * 機能するための穴埋め (spec B-1)。旧 HousingWorkspace 側のマウントは
 * /housing/p/:listingId 等の別ルート・別ツリー専用のため二重マウントにはならない。
 */
export const HousingShell: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const user = useAuthStore((s) => s.user);

  // 物件データを 1 回だけロード (冪等・全ページ共有)。
  useEffect(() => {
    void useHousingListingsStore.getState().load();
  }, []);

  // spec A-3: 自分の登録一覧を uid 確定/変化のたびに合流する (auth 復元は非同期のため effect で追随)。
  // ログアウト (uid が null に戻る) では clearMine で即座に消す。
  useEffect(() => {
    const store = useHousingListingsStore.getState();
    if (user?.uid) void store.loadMine(user.uid);
    else store.clearMine();
  }, [user?.uid]);

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
      <HousingLoginModal />
      <HousingAccountModal />
    </main>
  );
};
