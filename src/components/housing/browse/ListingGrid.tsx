import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Shuffle } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from './ListingCard';
import { HiddenListingCard } from './HiddenListingCard';
import { BrowseSortSelect, type BrowseSortOrder } from './BrowseSortSelect';
import { useHousingListOrderStore, type HousingListKey } from '../../../store/useHousingListOrderStore';
import { useHousingHomeScrollSignal } from '../../../store/useHousingHomeScrollSignal';
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';
import { useSmoothWheelScroll } from '../../../lib/scroll/useSmoothWheelScroll';

/** 最初に描く枚数と、見張りが見えるたびに足す枚数 (段階描画)。ふわっと表示の CSS (.housing-reveal の nth-child(n+37)) と揃える。 */
export const LISTING_INITIAL_COUNT = 36;
export const LISTING_STEP_COUNT = 36;

export interface ListingGridProps {
  listings: MockListing[];
  /** 未指定ならカードの「ツアーに追加」ボタン自体を出さない (例: ハウジンガーページの一覧)。 */
  onAddToTour?: (id: string) => void;
  sort: BrowseSortOrder;
  onSortChange: (v: BrowseSortOrder) => void;
  /** スクロール位置の保存・復元、シャッフルボタンの対象キー。 */
  listKey: HousingListKey;
  /** BrowseSortSelect へ渡す選択肢一覧。未指定なら新着順/古い順の2択 (既存仕様)。 */
  sortOrders?: BrowseSortOrder[];
  /** ツールバー見出しの前に差し込む要素 (例: 探すページの「一覧|マップ|タグ」トグル)。
   * 呼び出し元(BrowsePage)が1段にまとめたい場合に使う。未指定なら従来通り見出しのみ。 */
  toolbarPrefix?: React.ReactNode;
  /** true のとき各カードに家主向け管理コントロールを出す。マイページ専用 (2026-07-24)。 */
  showOwnerControls?: boolean;
  /** showOwnerControls=true のとき ListingCard へ橋渡しする。 */
  onRequestVisibilityChange?: (id: string, next: 'public' | 'unlisted' | 'private') => void;
  /** showOwnerControls=true のとき ListingCard へ橋渡しする。 */
  onEditListing?: (id: string) => void;
  /** true のとき各カード左上にOGP代表作選択トグルを出す。マイページ専用 (2026-07-31)。 */
  selectable?: boolean;
  /** selectable=true のとき、選択済みlisting idの集合。 */
  selectedIds?: Set<string>;
  /** selectable=true のとき、選択トグル時のコールバック。 */
  onToggleSelect?: (id: string) => void;
  /** selectable=true のとき、背景に使うと明示指定されたlisting id(0/1件)。 */
  backgroundId?: string | null;
  /** selectable=true のとき、背景トグル時のコールバック。 */
  onToggleBackground?: (id: string) => void;
  /** true のとき、投稿7日以内のカードにNEWリボン+ビーム演出を出す。探すページ専用 (2026-08-16)。 */
  showNewBadge?: boolean;
  /** ツアー追加ボタンの出し方 (ListingCard へ橋渡し)。ハウジンガーページ(他人視点)は 'overlay'。 */
  tourAddVariant?: 'footer' | 'overlay';
  /** overlay 時の地域判定の追加母集団 (ListingCard へ橋渡し)。 */
  tourExtraPool?: { id: string; region?: string | null }[];
}

/**
 * 探すページ中央のグリッド (ハウジンガーページでも再利用)。上部ツールバー = 「ハウジング一覧 N件」見出し + 並び替え。
 * ビュー切替 [一覧|マップ|ルート] は地図配線 (M1) が済むまで出さない
 * (未配線の disabled タブは「壊れて見える」ため、実装スパンで復活させる)。
 */
export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onAddToTour,
  sort,
  onSortChange,
  listKey,
  sortOrders,
  showOwnerControls,
  onRequestVisibilityChange,
  onEditListing,
  selectable,
  selectedIds,
  onToggleSelect,
  backgroundId,
  onToggleBackground,
  toolbarPrefix,
  showNewBadge,
  tourAddVariant,
  tourExtraPool,
}) => {
  const { t } = useTranslation();
  // 段階描画: 最初は画面数枚分だけ作り、末尾の見張りが見えたら次のまとまりを足す。
  const [count, setCount] = useState(LISTING_INITIAL_COUNT);
  const total = listings.length;
  const visibleCount = Math.min(count, total);
  const seed = useHousingListOrderStore((s) => s.entries[listKey].seed);
  const ensureCount = useCallback((n: number) => setCount((c) => Math.max(c, n)), []);
  const resetCount = useCallback(() => setCount(LISTING_INITIAL_COUNT), []);
  const containerRef = useListScrollRestore(listKey, {
    count: visibleCount,
    total,
    sortKey: `${sort}|${seed}`,
    firstId: listings[0]?.id ?? '',
    secondId: listings[1]?.id ?? '',
    ensureCount,
    resetCount,
    step: LISTING_STEP_COUNT,
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = containerRef.current;
    if (!sentinel || !root || visibleCount >= total || typeof IntersectionObserver === 'undefined') {
      // IntersectionObserver が無い環境は全件描いて従来どおりにする
      if (visibleCount < total && typeof IntersectionObserver === 'undefined') setCount(total);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          // 入力 (スクロール・クリック) を妨げないよう低優先で足す
          startTransition(() => setCount((c) => c + LISTING_STEP_COUNT));
        }
      },
      { root, rootMargin: '0px 0px 100% 0px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [visibleCount, total, containerRef]);
  // stiffness を下げるほど惰性が長く「ヌルっと」した滑らかさになる(既定値200は硬め)。
  // 軽減表タイムライン(Timeline.tsx)の80よりさらに柔らかくして「超スムーズ」要望に応える。
  useSmoothWheelScroll(containerRef, { stiffness: 60, wheelMultiplier: 1.4 });

  // スマホのボトムナビ「トップ」を、探すページにいる状態で再タップ → 一覧を先頭へスクロール。
  // シグナルは HousingBottomNav が /housing にいるときだけ発火するが、念のため探す一覧
  // (listKey='browse') 以外は無視する。
  const homeScrollTick = useHousingHomeScrollSignal((s) => s.tick);
  useEffect(() => {
    if (homeScrollTick === 0 || listKey !== 'browse') return;
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [homeScrollTick, listKey, containerRef]);

  const onShuffle = () => {
    useHousingListOrderStore.getState().reshuffle(listKey);
    useHousingListOrderStore.getState().setScrollTop(listKey, 0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

  return (
    <div className="housing-listing-grid-wrap">
      <div className="housing-listing-grid-toolbar">
        <div className="housing-listing-grid-toolbar-start">
          {toolbarPrefix}
          <h2 className="housing-listing-grid-heading">
            {t('housing.browse.listings_label')}
            <span className="housing-listing-grid-count">
              {t('housing.browse.count_unit', { count: listings.length })}
            </span>
            {selectable && (
              <span className="housing-listing-grid-og-hint">{t('housing.housinger.ogSelect.hint')}</span>
            )}
          </h2>
        </div>
        <div className="housing-listing-grid-toolbar-actions">
          {sort === 'random' && (
            <button
              type="button"
              className="housing-shuffle-btn"
              aria-label={t('housing.browse.shuffle_button')}
              onClick={onShuffle}
            >
              <Shuffle size={16} aria-hidden="true" />
            </button>
          )}
          <BrowseSortSelect value={sort} onChange={onSortChange} orders={sortOrders} />
        </div>
      </div>
      <div className="housing-listing-grid" ref={containerRef}>
        {listings.slice(0, visibleCount).map((l) => l.adminHidden ? (
          <HiddenListingCard key={l.id} listing={l} />
        ) : (
          <ListingCard
            key={l.id}
            listing={l}
            onAddToTour={onAddToTour}
            showOwnerControls={showOwnerControls}
            onRequestVisibilityChange={onRequestVisibilityChange}
            onEditListing={onEditListing}
            selectable={selectable}
            selected={selectable ? (selectedIds?.has(l.id) ?? false) : undefined}
            onToggleSelect={onToggleSelect}
            isBackground={selectable ? backgroundId === l.id : undefined}
            onToggleBackground={onToggleBackground}
            showNewBadge={showNewBadge}
            tourAddVariant={tourAddVariant}
            tourExtraPool={tourExtraPool}
          />
        ))}
        {visibleCount < total && (
          // 見張り要素: 見えたら次のまとまりを描く。全件描いたら外す。
          <div
            ref={sentinelRef}
            aria-hidden="true"
            data-testid="listing-grid-sentinel"
            style={{ gridColumn: '1 / -1', height: 1, pointerEvents: 'none', animation: 'none' }}
          />
        )}
      </div>
    </div>
  );
};
