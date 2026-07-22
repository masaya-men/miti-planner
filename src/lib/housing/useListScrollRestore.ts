import { useLayoutEffect, useRef } from 'react';
import { useHousingListOrderStore, type HousingListKey } from '../../store/useHousingListOrderStore';

/**
 * 一覧グリッドのスクロール位置を保存・復元する。マウント時に保存済み scrollTop を復元し、
 * アンマウント時 (詳細ページへの遷移等) の scrollTop を保存する。
 * 返り値の ref をスクロールコンテナ (overflow-y:auto の要素) に付けること。
 *
 * 注意: key は「画面種別ごと」であり「画面インスタンスごと」ではない
 * (例: 'housinger' は /housing/housinger/:uid の全プロフィールページで共有)。
 * そのため、あるハウジンガーのプロフィールから別のハウジンガーのプロフィールへ
 * (実リロードや別ルート経由を挟まずに) 直接遷移した場合、前のプロフィールで保存した
 * scrollTop が新しいプロフィールの一覧に適用されてしまう。既知の許容済み低リスク挙動
 * (実際のナビゲーション動線は 一覧→詳細→戻る であり、プロフィール間直接遷移は想定外) であり、
 * 意図的に未対応。
 */
export function useListScrollRestore(key: HousingListKey) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = useHousingListOrderStore.getState().entries[key].scrollTop;
    return () => {
      useHousingListOrderStore.getState().setScrollTop(key, el.scrollTop);
    };
  }, [key]);

  return containerRef;
}
