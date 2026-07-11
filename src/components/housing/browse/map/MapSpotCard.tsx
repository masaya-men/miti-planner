import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BrowseMapSpot } from '../../../../lib/housing/browseMapSpots';
import { clampExpandedCardOffset } from '../../../../lib/housing/mapCardClamp';
import { ListingCard } from '../ListingCard';

/** hover してから拡大するまでの意図確認ディレイ(ms)。地図上を高速にスイープしただけで次々に
 *  拡大しない(素通りと意図的な滞留を切り分ける)ため。click/Enter/focus はこの遅延の対象外。 */
export const HOVER_INTENT_DELAY_MS = 140;

/** hover が外れてから畳むまでの猶予(ms)。端でカードをクランプ移動した時などに、カーソルが
 *  一瞬カード外(地図上)を通っても即畳まないための業界標準の hovercard 猶予。体感の
 *  「外したらすぐ小さく」は保ちつつ、際どい移動での誤クローズだけ吸収する。 */
export const HOVER_CLOSE_DELAY_MS = 100;

export interface MapSpotCardProps {
  spot: BrowseMapSpot;
  expanded: boolean;
  onExpand: (key: string | null) => void;
  onAddToTour: (id: string) => void;
  /** コンテナ右端/上端に近いとき true (Task4/6 が画面座標から算出して渡す)。
   *  吹き出しの向き・拡大方向・拡大時の基準点 (transform-origin) を反転する。 */
  flip: { x: boolean; y: boolean };
  /** マーカーの画面座標 (`.housing-bmap-wrap` 基準、BrowseWardMap がパン/ズーム込みで算出済み)。
   *  拡大時のコンテナ内クランプ計算に使う。 */
  markerPos: { x: number; y: number };
  /** コンテナ (`.housing-bmap-wrap`) の実寸 (BrowseWardMap の ResizeObserver キャッシュ)。
   *  拡大時のコンテナ内クランプ計算に使う。 */
  wrapSize: { w: number; h: number };
  /** パン/ピンチ、またはカード上で始まったドラッグの間 true (BrowseWardMap が ref で保持)。
   *  hover 拡大ハンドラがこれを参照し、地図ジェスチャー中は拡大しない。 */
  gestureActiveRef: React.RefObject<boolean>;
}

/**
 * 地図マーカーの吹き出しカード (2026-07-12 全面刷新)。
 *
 * 旧: 小さなピル (ミニカード) に、別要素のフル ListingCard を hover で「かぶせて」いた。
 * 新: フル `ListingCard` (探す一覧と同一の生きたカード・動画/♡/ツアー追加すべて同じ) を
 *     マーカー位置に**常時 1 枚だけ**描画し、hover でその同じカードが `transform: scale()` で
 *     そのまま拡大するアニメーションにする。中身は小さいときも大きいときも同じ。
 *     常時マウントなので hover ごとの mount/unmount チャーンが無い (旧構成のクラッシュ要因が消える)。
 *     動画は Allmarks 由来の spotlight 機構で同時 1 本のみ (`useHousingCardPlayback`)。
 *
 * 位置決め (translate(sx,sy)) は親 (`.housing-bmap-marker-pos`) の責務。本コンポーネントは
 * その原点 (0,0) を基準に translate(-50%,-100%) 系 + scale で自身をアンカーする。拡大時 (scale 1)
 * の translate は従来の拡大カードと同一なので、コンテナ内クランプ (mapCardClamp) はそのまま成立する。
 *
 * hover 挙動: マウスは「乗っている間だけ拡大」。1 枚なのでミニ⇔カードの受け渡し隙間は無いが、
 * 端のクランプ移動での際どい離脱に備え離脱は HOVER_CLOSE_DELAY_MS の猶予付き、進入は
 * HOVER_INTENT_DELAY_MS の意図確認付き。gestureActiveRef が true (地図パン/ピンチ/カード上ドラッグ)
 * の間は拡大しない。タッチ/キーボードには hover が無いので、focus は即拡大、詳細遷移は
 * ListingCard 自身の click(一覧と同一)、閉じるは地図の空白タップ (onExpand(null)) と Esc が担う。
 */
export const MapSpotCard: React.FC<MapSpotCardProps> = ({
  spot,
  expanded,
  onExpand,
  onAddToTour,
  flip,
  markerPos,
  wrapSize,
  gestureActiveRef,
}) => {
  const { t } = useTranslation();
  const flipX = flip.x ? 'true' : 'false';
  const flipY = flip.y ? 'true' : 'false';
  const total = spot.listings.length;
  const [index, setIndex] = useState(0);

  const expand = () => onExpand(spot.key);

  // 開く(hover-intent)/畳む(hover-close)の2本のタイマー。アンマウント時に両方片付ける。
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearOpenTimer = () => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };
  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, []);

  // カードに hover が入った: 畳む予約を取り消し、未拡大なら意図確認後に拡大する。
  const handlePointerEnter = () => {
    clearCloseTimer();
    // 地図ジェスチャー中 (パン/ピンチ/カード上ドラッグ) は hover 拡大そのものを予約しない。
    if (gestureActiveRef.current) return;
    if (expanded) return; // 既に拡大中(=カード上を移動中)なら畳む取消だけでよい。
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      // ディレイ中にジェスチャーが始まった場合も、発火時点で再チェックして拡大しない。
      if (gestureActiveRef.current) return;
      expand();
    }, HOVER_INTENT_DELAY_MS);
  };
  // カードから hover が外れた: 開く予約は捨て、猶予後に畳む
  // (猶予内に戻れば handlePointerEnter が取り消すのでチラつかない)。
  const handlePointerLeave = () => {
    clearOpenTimer();
    // 未拡大のまま素通りしたなら開く予約を消すだけ。畳む対象が無いのに onExpand(null) を
    // 呼ぶと無駄な再レンダー/誤クローズになるので出さない。
    if (!expanded) return;
    if (closeTimerRef.current !== null) return; // 既に畳む予約済みなら重ねない。
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onExpand(null);
    }, HOVER_CLOSE_DELAY_MS);
  };
  // focus は spec 通り即時拡大 (待機中のタイマーは二重発火を避けるため破棄)。
  const expandImmediately = () => {
    clearOpenTimer();
    clearCloseTimer();
    expand();
  };

  // カードの実寸 (scale 前のレイアウト実寸) を測ってクランプに使う。transform: scale は
  // レイアウト寸法に影響しないので ResizeObserver の borderBoxSize が常に「拡大時 (scale 1)」の
  // 実寸を返す = クランプ (scale 1 前提) に正しい値になる。
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const apply = (w: number, h: number) =>
      setCardSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    // 初回同期測定 + 以降は画像ロード/index 切替の高さ変化に追従 (pointermove 中の読み取りはしない)。
    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      if (box) apply(box.inlineSize, box.blockSize);
      else {
        const r = el.getBoundingClientRect();
        apply(r.width, r.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // クランプは拡大時 (scale 1) だけ必要 (小さいときは枠内に収まる)。小さいときに拡大時基準の
  // オフセットを当てると小カードがマーカーから離れて見えるため、未拡大では 0 にする。
  const clampOffset = useMemo(() => {
    if (!expanded || !cardSize) return { dx: 0, dy: 0 };
    return clampExpandedCardOffset({
      markerX: markerPos.x,
      markerY: markerPos.y,
      wrapW: wrapSize.w,
      wrapH: wrapSize.h,
      cardW: cardSize.w,
      cardH: cardSize.h,
      flipX: flipX === 'true',
      flipY: flipY === 'true',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, cardSize, markerPos.x, markerPos.y, wrapSize.w, wrapSize.h, flipX, flipY]);

  // Esc で閉じる。拡大中だけ listener を張る (全カードが常時 listener を持たないように)。
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExpand(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, onExpand]);

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  return (
    <div
      className="housing-bmap-card"
      data-testid={`bmap-card-${spot.key}`}
      data-expanded={expanded ? 'true' : 'false'}
      data-flip-x={flipX}
      data-flip-y={flipY}
      ref={cardRef}
      style={
        {
          '--housing-bmap-clamp-x': `${clampOffset.dx}px`,
          '--housing-bmap-clamp-y': `${clampOffset.dy}px`,
        } as React.CSSProperties
      }
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onFocus={expandImmediately}
      // 地図の空白クリック (Task4: onExpand(null)) がここでの操作に反応して閉じないよう、
      // カード内のクリックは外へ伝播させない (詳細遷移は ListingCard 自身の onClick が担う)。
      onClick={(e) => e.stopPropagation()}
    >
      {total > 1 && (
        <div className="housing-bmap-card-nav">
          <button
            type="button"
            className="housing-bmap-card-nav-btn"
            aria-label={t('housing.map.spot_prev')}
            onClick={goPrev}
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span className="housing-bmap-card-nav-label">
            {t('housing.map.spot_more', { index: index + 1, total })}
          </span>
          <button
            type="button"
            className="housing-bmap-card-nav-btn"
            aria-label={t('housing.map.spot_next')}
            onClick={goNext}
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      <ListingCard listing={spot.listings[index]} onAddToTour={onAddToTour} />
    </div>
  );
};
