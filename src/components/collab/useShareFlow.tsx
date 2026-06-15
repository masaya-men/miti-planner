// 共有フローの状態機械(ヘッドレス・PC/スマホ共通の 1 ソース)。
// トリガー UI(ヘッダーのチップ/アイコン or ボトムナビのタブ)は各 consumer 側に残し、
// このフックは「初期ビュー判定 → 各モーダルの描画 → 共同編集の発行」だけを束ねる。
// PC ShareButtons から移植(挙動同一)。スマホは hideCursor=true でオーナーパネルのカーソルUIを隠す。
import React from 'react';
import { ShareModal } from '../ShareModal';
import { ShareChoiceModal } from './ShareChoiceModal';
import { OwnerCollabPanel } from './OwnerCollabPanel';
import { LoginModal } from '../LoginModal';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { resolveInitialShareView, type ShareView } from '../../lib/collab/shareView';
import type { SavedPlan } from '../../types';

interface UseShareFlowOptions {
  contentLabel: string | null;
  currentPlan: SavedPlan | undefined;
  /** スマホ: オーナーパネルのカーソル共有UIを隠す(マウス前提のため不要)。 */
  hideCursor?: boolean;
}

interface ShareFlow {
  view: ShareView;
  openShareUI: () => void;
  isOn: boolean;
  liveCount: number;
  active: boolean;
  collabBusy: boolean;
  modals: React.ReactNode;
}

export function useShareFlow({ contentLabel, currentPlan, hideCursor = false }: UseShareFlowOptions): ShareFlow {
  const [view, setView] = React.useState<ShareView>('none');
  const [showLogin, setShowLogin] = React.useState(false);
  const [collabBusy, setCollabBusy] = React.useState(false);
  const { active, start } = useCollabSessionStore();
  // 「N人」は確実な接続数(connectionCount)を優先・未取得は roster.length にフォールバック。
  const liveCount = useCollabPresenceStore(s => s.connectionCount ?? s.roster.length);
  const { user } = useAuthStore();

  // ON 判定は「プランが collab-ON か」(プラン属性・サイドバーバッジと同基準)。active は ON の部分集合。
  const isOn = active || !!currentPlan?.activeCollabRoomToken;

  const openShareUI = React.useCallback(() => {
    const { completed, isActive } = useTutorialStore.getState();
    if (!completed['share'] && !isActive) useTutorialStore.getState().startTutorial('share');
    // 未ログインは 2 択を見せずコピー共有へ直行(共同編集はログイン必須)。
    setView(resolveInitialShareView({ user, isOn }));
  }, [user, isOn]);

  const handleCollab = async () => {
    if (collabBusy) return;                       // 二重押し防止(多重発行=満員誤判定の原因)
    if (!user) { setShowLogin(true); return; }    // 未ログインはログイン導線
    if (!currentPlan) return;                       // 保存済プランが無ければ不可
    setCollabBusy(true);
    try {
      await start(currentPlan.id);
      setView('panel');
    } finally {
      setCollabBusy(false);
    }
  };

  const close = () => setView('none');

  const modals = (
    <>
      {view === 'choice' && (
        <ShareChoiceModal
          onCopy={() => setView('copy')}
          onCollab={handleCollab}
          onClose={close}
          collabBusy={collabBusy}
        />
      )}

      <ShareModal
        isOpen={view === 'copy'}
        onClose={close}
        contentLabel={contentLabel}
        currentPlan={currentPlan}
      />

      {view === 'panel' && currentPlan && (
        <OwnerCollabPanel planId={currentPlan.id} onClose={close} hideCursor={hideCursor} />
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );

  return { view, openShareUI, isOn, liveCount, active, collabBusy, modals };
}
