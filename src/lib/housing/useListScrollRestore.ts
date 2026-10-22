import { useLayoutEffect, useRef } from 'react';
import { useHousingListOrderStore, type HousingListKey } from '../../store/useHousingListOrderStore';

/**
 * 段階描画 (ListingGrid) と組み合わせるときの追加情報。
 * 未指定なら従来どおり「マウント時に保存位置へ scrollTop を入れるだけ」。
 */
export interface ListScrollPaging {
  /** いま描いている枚数 (total 以下に丸めた値)。 */
  count: number;
  /** 全件数。 */
  total: number;
  /** 並び替え・シャッフルを表す文字列。変わったら描画枚数を最初に戻して先頭へ。 */
  sortKey: string;
  /** 先頭と 2 番目の id。先頭だけが消えた (お気に入り解除など) 場合は並びが変わった扱いにしない。 */
  firstId: string;
  secondId: string;
  /** 描画枚数を n 枚以上にする (同期で反映させること)。 */
  ensureCount: (n: number) => void;
  /** 描画枚数を最初のまとまりに戻す。 */
  resetCount: () => void;
  /** 復元時に余分に描く枚数 (目標位置の少し先まで)。 */
  step: number;
}

/**
 * 一覧グリッドのスクロール位置を保存・復元する。マウント時に保存済み scrollTop を復元し、
 * アンマウント時 (詳細ページへの遷移等) の scrollTop を保存する。
 * 返り値の ref をスクロールコンテナ (overflow-y:auto の要素) に付けること。
 *
 * 段階描画 (paging 指定) のときは、保存位置が描画済みの高さより下なら、そこまで届く枚数を
 * 描いてから復元する (描画前は scrollTop が高さに丸められて浅い位置に戻ってしまうため)。
 * 描画の追加は layout effect 内で同期に行うので、ユーザーには浅い位置が一瞬も見えない。
 *
 * 注意: key は「画面種別ごと」であり「画面インスタンスごと」ではない
 * (例: 'housinger' は /housing/housinger/:uid の全プロフィールページで共有)。
 * そのため、あるハウジンガーのプロフィールから別のハウジンガーのプロフィールへ
 * (実リロードや別ルート経由を挟まずに) 直接遷移した場合、前のプロフィールで保存した
 * scrollTop が新しいプロフィールの一覧に適用されてしまう。既知の許容済み低リスク挙動
 * (実際のナビゲーション動線は 一覧→詳細→戻る であり、プロフィール間直接遷移は想定外) であり、
 * 意図的に未対応。
 */
export function useListScrollRestore(key: HousingListKey, paging?: ListScrollPaging) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagingRef = useRef(paging);
  pagingRef.current = paging;
  /** 復元待ちの目標 scrollTop。null なら復元済み (または不要)。 */
  const pendingRef = useRef<number | null>(null);
  const prevSigRef = useRef(
    paging && { sortKey: paging.sortKey, firstId: paging.firstId, secondId: paging.secondId },
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const saved = useHousingListOrderStore.getState().entries[key].scrollTop;
    el.scrollTop = saved;
    // 段階描画で、いまの高さでは届かない時だけ「復元待ち」にして下の effect が枚数を増やす
    pendingRef.current = pagingRef.current && saved > 0 ? saved : null;
    return () => {
      // 復元が終わる前に外れた場合は、丸められた浅い値ではなく目標値を残す
      const value = pendingRef.current ?? el.scrollTop;
      pendingRef.current = null;
      useHousingListOrderStore.getState().setScrollTop(key, value);
    };
  }, [key]);

  // 毎回の描画後に実行: 復元待ちなら位置を入れ直し、届かなければ枚数を増やす
  useLayoutEffect(() => {
    const el = containerRef.current;
    const p = pagingRef.current;
    const target = pendingRef.current;
    if (!el || !p || target === null) return;
    el.scrollTop = target;
    const reachable = el.scrollHeight - el.clientHeight >= target - 1;
    if (reachable || p.count >= p.total) {
      pendingRef.current = null;
      return;
    }
    // 1 枚あたりの平均高さから、目標位置 + 1 画面分に必要な枚数を見積もる
    const perCard = el.scrollHeight / Math.max(1, p.count);
    const needed = perCard > 0 ? Math.ceil((target + el.clientHeight) / perCard) : 0;
    p.ensureCount(Math.min(p.total, Math.max(p.count + 1, needed + p.step)));
  });

  // 並び替え・シャッフル・絞り込みで一覧が変わったら、最初のまとまりに戻して先頭へ
  useLayoutEffect(() => {
    const el = containerRef.current;
    const p = pagingRef.current;
    if (!el || !p) return;
    const prev = prevSigRef.current;
    prevSigRef.current = { sortKey: p.sortKey, firstId: p.firstId, secondId: p.secondId };
    if (!prev || pendingRef.current !== null) return; // 復元中は触らない
    const sortChanged = p.sortKey !== prev.sortKey;
    // 空 → 読み込み完了、先頭だけが消えた (旧 2 番目が新先頭) は並び替えではない
    const headChanged =
      p.firstId !== prev.firstId && prev.firstId !== '' && p.firstId !== prev.secondId;
    if (sortChanged || headChanged) {
      p.resetCount();
      el.scrollTop = 0;
    }
  });

  return containerRef;
}
