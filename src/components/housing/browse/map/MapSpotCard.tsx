import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BrowseMapSpot } from '../../../../lib/housing/browseMapSpots';
import { clampExpandedCardOffset } from '../../../../lib/housing/mapCardClamp';
import { representativeImage } from '../../../../lib/housing/representativeImage';
import { ListingCard } from '../ListingCard';

/** hover してから展開するまでの意図確認ディレイ(ms、review finding: Finding1)。
 *  地図上を高速にスイープするドラッグ/カーソル移動で毎回 mouseenter → 展開 → アンマウントが
 *  連鎖する(=レンダラー不安定化の一因と推測)のを防ぐ。click/Enter/focus はこの遅延の対象外
 *  (spec/Task5 通り即時展開のまま)。120〜150ms 目安で「意図的な滞留」と「素通り」を切り分ける。 */
export const HOVER_INTENT_DELAY_MS = 140;

export interface MapSpotCardProps {
  spot: BrowseMapSpot;
  expanded: boolean;
  onExpand: (key: string | null) => void;
  onAddToTour: (id: string) => void;
  /** コンテナ右端/上端に近いとき true (Task4/6 が画面座標から算出して渡す)。
   *  吹き出しの向き (ミニカード) と展開方向 (拡大カード) を反転する。 */
  flip: { x: boolean; y: boolean };
  /** マーカーの画面座標 (`.housing-bmap-wrap` 基準、BrowseWardMap がパン/ズーム込みで算出済み)。
   *  拡大カードのコンテナ内クランプ計算 (Finding2) に使う。 */
  markerPos: { x: number; y: number };
  /** コンテナ (`.housing-bmap-wrap`) の実寸 (BrowseWardMap の ResizeObserver キャッシュ)。
   *  拡大カードのコンテナ内クランプ計算 (Finding2) に使う。 */
  wrapSize: { w: number; h: number };
  /** パン/ピンチ、またはカード上で始まったドラッグの間 true (BrowseWardMap が ref で保持)。
   *  hover 展開ハンドラがこれを参照し、地図ジェスチャー中は展開しない (review finding: Finding1)。
   *  再レンダーを起こしたくない値なので state ではなく ref で受け取る。 */
  gestureActiveRef: React.RefObject<boolean>;
}

/**
 * 地図マーカーの吹き出しミニカード ⇔ 拡大カード (spec §4.2/5.3、plan Task5)。
 *
 * 常時: 48px サムネ + ラベル + 件数バッジのミニカード (`button.housing-bmap-mini`)。
 * hover/focus/クリック/Enter で `onExpand(spot.key)` を呼び、expanded=true になったら
 * 既存 `ListingCard` をそのまま重ねて描画する (ロジックをフォークしない = ツアー追加/
 * ♡/詳細クリックが一覧と完全に同一の挙動になる)。拡大カードはミニカードの兄弟要素
 * (button の中に入れ子にしない = ListingCard 内部の button と入れ子ボタンになるのを避ける)。
 *
 * 位置決め (translate(sx,sy)) は親 (`.housing-bmap-marker-pos`、BrowseWardMap/Task4・
 * 配線は Task6) の責務。本コンポーネントはその原点 (0,0) を基準に
 * transform: translate(-50%, -100%) 系で自身をアンカーする。
 *
 * hover は即座に展開せず HOVER_INTENT_DELAY_MS だけ待ってから展開する (Finding1)。ポインタが
 * 遅延中に離れれば展開しない。gestureActiveRef が true の間 (地図のパン/ピンチ/カード上ドラッグ中)
 * は、遅延開始時・発火時のどちらでも展開をスキップする。click/Enter/focus はこの遅延・抑止の対象外
 * (spec/Task5 通り即時展開)。
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
  const label =
    spot.kind === 'apart'
      ? t('housing.map.apartment_label')
      : t('housing.map.plot_label', { plot: spot.plot });
  const count = spot.listings.length;
  const flipX = flip.x ? 'true' : 'false';
  const flipY = flip.y ? 'true' : 'false';

  const expand = () => onExpand(spot.key);

  // hover-intent ディレイ用タイマー。マウント中ずっと同じミニカードが生きているため、
  // このコンポーネント自身のアンマウント時 (スポット消失) に確実に片付ける (下の useEffect)。
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };
  useEffect(() => clearHoverTimer, []);

  const handleMouseEnter = () => {
    // 地図ジェスチャー中 (パン/ピンチ/カード上ドラッグ) は hover 展開そのものを予約しない。
    if (gestureActiveRef.current) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null;
      // ディレイ中にジェスチャーが始まった場合も、発火時点で再チェックして展開しない。
      if (gestureActiveRef.current) return;
      expand();
    }, HOVER_INTENT_DELAY_MS);
  };
  const handleMouseLeave = () => clearHoverTimer();
  // click/Enter/focus は spec 通り即時展開 (待機中の hover タイマーは二重発火を避けるため破棄)。
  const expandImmediately = () => {
    clearHoverTimer();
    expand();
  };

  return (
    <>
      <button
        type="button"
        className="housing-bmap-mini"
        data-testid={`bmap-marker-${spot.key}`}
        aria-expanded={expanded}
        data-flip-x={flipX}
        data-flip-y={flipY}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={expandImmediately}
        onClick={(e) => {
          e.stopPropagation();
          expandImmediately();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            expandImmediately();
          }
        }}
      >
        <span className="housing-bmap-mini-thumb">
          <img src={representativeImage(spot.representative)} alt="" loading="lazy" />
        </span>
        <span className="housing-bmap-marker-label">{label}</span>
        {count > 1 && <span className="housing-bmap-badge">×{count}</span>}
      </button>
      {/* マウント時のみ ListingCard を生成 (常時マウントしない = spec §5.3)。 */}
      {expanded && (
        <MapSpotExpanded
          spot={spot}
          onAddToTour={onAddToTour}
          onExpand={onExpand}
          flipX={flipX}
          flipY={flipY}
          markerPos={markerPos}
          wrapSize={wrapSize}
        />
      )}
    </>
  );
};

interface MapSpotExpandedProps {
  spot: BrowseMapSpot;
  onAddToTour: (id: string) => void;
  onExpand: (key: string | null) => void;
  flipX: 'true' | 'false';
  flipY: 'true' | 'false';
  markerPos: { x: number; y: number };
  wrapSize: { w: number; h: number };
}

/** 拡大カード。expanded=true の間だけマウントされるので、index state はここに置くだけで
 *  開き直すたびに自然に 0 (代表 = 最新確認) へ戻る。
 *
 *  Finding2: flip だけでは「どちらの向きでもコンテナに収まらない」ケース (上端寄りスポットで
 *  下端のツアー追加 CTA がクリップされる) を救えないため、マウント時に自身の実寸を一度だけ測定し
 *  (`getBoundingClientRect`、pointermove 中の読み取りはしない)、`clampExpandedCardOffset` (純関数)
 *  でコンテナ内に収まる追加オフセットを計算して CSS カスタムプロパティ経由で transform に加算する。
 *  オフセット自体の再計算 (dx/dy の算術) はパン/ズームで markerPos が変わるたびに useMemo で
 *  追従させる (キャッシュ済みの数値だけを使う純粋な計算なので DOM 読み取りは発生しない)。 */
const MapSpotExpanded: React.FC<MapSpotExpandedProps> = ({
  spot,
  onAddToTour,
  onExpand,
  flipX,
  flipY,
  markerPos,
  wrapSize,
}) => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const total = spot.listings.length;

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCardSize({ w: rect.width, h: rect.height });
    // マウント時に一度だけ測定する (review 指摘: pointermove 等イベント中の layout 読み取りはしない)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clampOffset = useMemo(() => {
    if (!cardSize) return { dx: 0, dy: 0 };
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
  }, [cardSize, markerPos.x, markerPos.y, wrapSize.w, wrapSize.h, flipX, flipY]);

  // Esc で閉じる。このコンポーネント自体が expanded 時だけマウントされるため、
  // listener の付け外しがそのまま「開いている間だけ Esc を拾う」になる。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExpand(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExpand]);

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);

  return (
    <div
      className="housing-bmap-expanded"
      data-testid={`bmap-expanded-${spot.key}`}
      data-flip-x={flipX}
      data-flip-y={flipY}
      ref={cardRef}
      style={
        {
          '--housing-bmap-clamp-x': `${clampOffset.dx}px`,
          '--housing-bmap-clamp-y': `${clampOffset.dy}px`,
        } as React.CSSProperties
      }
      // 地図の空白クリック (Task4: onExpand(null)) がここでの操作に反応して即閉じないよう、
      // 拡大カード内のクリックは外へ伝播させない (BrowseWardMap.tsx のマーカー同様の防御)。
      onClick={(e) => e.stopPropagation()}
    >
      {total > 1 && (
        <div className="housing-bmap-expanded-nav">
          <button
            type="button"
            className="housing-bmap-expanded-nav-btn"
            aria-label={t('housing.map.spot_prev')}
            onClick={goPrev}
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span className="housing-bmap-expanded-nav-label">
            {t('housing.map.spot_more', { index: index + 1, total })}
          </span>
          <button
            type="button"
            className="housing-bmap-expanded-nav-btn"
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
