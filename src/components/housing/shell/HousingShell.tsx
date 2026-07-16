import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useJoinedTourStore } from '../../../store/useJoinedTourStore';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { SceneryVideo } from '../workspace/SceneryVideo';
import { AppHeader } from './AppHeader';
import { StatusBar } from '../workspace/StatusBar';
import { HousingBottomNav } from './HousingBottomNav';
import { HousingRegisterFab } from './HousingRegisterFab';
import { HousingFilterSheet } from './HousingFilterSheet';
import { HousingSettingsSheet } from './HousingSettingsSheet';
import { HousingLoginModal } from '../login/HousingLoginModal';
import { HousingAccountModal } from '../login/HousingAccountModal';
import { HousingPlaybackProvider } from '../../../lib/housing/HousingPlaybackContext';
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
  const isMobile = useIsMobile();
  const joinedToken = useJoinedTourStore((s) => s.token);
  const { pathname } = useLocation();
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ツアーページ (ホスト /housing/tour または共有参加 /housing/tour/:token) を開いている間は
  // 没入UIのためボトムナビ/FAB を出さない。永続 state(mode) ではなく現在のパスで判定することで、
  // ホストが途中でブランド等から離脱しても没入フラグが残らず、ナビが消えたままトラップされないようにする (最終レビュー I-1)。
  const immersive =
    pathname === '/housing/tour' || (!!joinedToken && pathname === `/housing/tour/${joinedToken}`);

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
          <HousingPlaybackProvider>
            <Outlet />
          </HousingPlaybackProvider>
        </div>
        {isMobile && !immersive && (
          <HousingBottomNav
            onOpenFilter={() => setFilterOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        {isMobile && !immersive && <HousingRegisterFab />}
        {isMobile && <HousingFilterSheet isOpen={filterOpen} onClose={() => setFilterOpen(false)} />}
        {isMobile && <HousingSettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />}
        <StatusBar />
      </div>
      <HousingLoginModal />
      <HousingAccountModal />
    </main>
  );
};
