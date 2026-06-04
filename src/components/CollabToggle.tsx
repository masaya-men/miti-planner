import { useRef, useState } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import type { CollabSession } from '../lib/collab/collabProvider';

/**
 * 段取り②-a 検証用の最小トグル。現在の plan ID を部屋にして共同編集を開始/終了する。
 * 完全な共有リンク UI / ログイン必須化 / 見た目の作り込みは段取り⑤。
 *
 * 遅延ロード: collabProvider(yjs / y-partyserver を含む)はクリック時に動的 import される。
 * これによりソロ利用者の初期 bundle に Yjs 系は乗らない。
 */
export function CollabToggle() {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef<CollabSession | null>(null);
  const currentPlanId = usePlanStore((s) => s.currentPlanId);

  const toggle = async () => {
    if (active) {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      setActive(false);
      return;
    }
    if (!currentPlanId || loading) return;
    setLoading(true);
    try {
      // 動的 import: Yjs 系はここで初めてダウンロードされる(遅延ロード境界)。
      const { startCollabSession } = await import('../lib/collab/collabProvider');
      sessionRef.current = startCollabSession(currentPlanId);
      setActive(true);
    } catch (err) {
      console.error('[LoPo] 共同編集の開始に失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!currentPlanId || loading}
      aria-pressed={active}
      title="同じ軽減表を開いた相手とリアルタイムに同時編集(段取り②-a 検証用)"
      className="px-2 py-0.5 text-app-xs rounded border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-surface2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {active ? '共同編集を終了' : loading ? '接続中…' : '一緒に編集'}
    </button>
  );
}
