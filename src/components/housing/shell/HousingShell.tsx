import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useJoinedTourStore } from '../../../store/useJoinedTourStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { MobileTourTrayBar } from './MobileTourTrayBar';
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
import { startFavoritesSync } from '../../../lib/housing/favoritesSync';
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
  const { i18n } = useTranslation();
  const applyLocaleDefaultRegions = useHousingFilterStore((s) => s.applyLocaleDefaultRegions);
  const joinedToken = useJoinedTourStore((s) => s.token);
  const { pathname } = useLocation();
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ツアー実行中 (running && ホストのツアーページ) または共有参加ページを開いている間は
  // 没入UIのためボトムナビ/FAB を出さない。path 基準 (I-1) は維持しつつ、running を掛け合わせることで
  // ツアー未開始 (空状態/トレイから開始前) の /housing/tour ではナビを出し、再タップで探すへ帰れるようにする
  // (実機FB#2)。running は非永続 store なのでリロードで stale に残らない。
  const tourRunning = useHousingTourStore((s) => s.running);
  const immersive =
    (pathname === '/housing/tour' && tourRunning) ||
    (!!joinedToken && pathname === `/housing/tour/${joinedToken}`);

  // 物件データを 1 回だけロード (冪等・全ページ共有)。
  useEffect(() => {
    void useHousingListingsStore.getState().load();
  }, []);

  // 言語別の地域フィルター初期値 (spec B案: 言語は初期値のみ)。
  // ユーザーが地域を一度でも操作していたら (regionsTouched) store 側で無視される。
  useEffect(() => {
    applyLocaleDefaultRegions(i18n.language);
  }, [i18n.language, applyLocaleDefaultRegions]);

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

  // お気に入りのサーバー同期: /housing 滞在中だけリスナー・デバウンス書き込みを張る
  // (他画面でコストを払わない)。ログイン状態は内部で購読するのでここでは start/stop のみ。
  useEffect(() => {
    const stop = startFavoritesSync();
    return stop;
  }, []);

  return (
    <main className="housing-workspace housing-shell-root" data-theme={theme}>
      <SceneryVideo theme={theme} />
      {/* data-immersive: ナビ非表示中はナビ余白 (shell-body padding-bottom) も外して地図等を全画面にする。 */}
      <div className="housing-shell" data-immersive={immersive || undefined}>
        <AppHeader onOpenFilter={() => setFilterOpen(true)} />
        <div className="housing-shell-body">
          <HousingPlaybackProvider>
            <Outlet />
          </HousingPlaybackProvider>
        </div>
        {isMobile && !immersive && (
          <HousingBottomNav onOpenSettings={() => setSettingsOpen(true)} />
        )}
        {isMobile && !immersive && <HousingRegisterFab />}
        {/* 実機FB#10: PCの右パネル(ツアートレイ)がスマホでは非表示のため、「ツアーに追加」の
            受け皿が無かった。トレイに積むと出る小バー (件数+開始+クリア) で開始まで完結させる。 */}
        {isMobile && !immersive && <MobileTourTrayBar />}
        {isMobile && <HousingFilterSheet isOpen={filterOpen} onClose={() => setFilterOpen(false)} />}
        {isMobile && <HousingSettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />}
        <StatusBar />
      </div>
      <HousingLoginModal />
      <HousingAccountModal />
    </main>
  );
};
