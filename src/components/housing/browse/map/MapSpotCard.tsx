import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  /** 複数スポット (listings>=2) のカードクリック/「N件を見る」で大量部屋パネルを開く。 */
  onOpenPanel: (key: string) => void;
  /** マーカーの画面座標 (パン/ズーム込み)。popped の clamp 計算に使う。 */
  markerPos: { x: number; y: number };
  /** コンテナ実寸 (ResizeObserver キャッシュ)。clamp 計算に使う。 */
  wrapSize: { w: number; h: number };
  /** 地図の実描画倍率 (actualScale)。clamp の 画面px→plane px 変換に使う。 */
  mapScale: number;
  /** パン/ピンチ/カード上ドラッグの間 true。hover 拡大を抑止する。 */
  gestureActiveRef: React.RefObject<boolean>;
}

/**
 * 地図マーカーの吹き出しカード (2026-07-12 案B ②-c: カードを地図面へ)。
 *
 * フル `ListingCard` (探す一覧と同一の生きたカード) を区画中央に**常時 1 枚だけ**描画する。
 * 通常時は親 (`.housing-bmap-card-plane`) の scale で小さく写り、hover/focus では面の scale を
 * 打ち消す逆スケール (`--housing-bmap-scale-inv` = 1/actualScale) でどの倍率でも画面固定サイズへ
 * 膨らむ (中央アンカー・しっぽ/flip は廃止)。常時マウントなので hover ごとの mount/unmount チャーンが無い。
 *
 * 複数スポット (listings>=2) は代表 1 件のみ表示し、「N件を見る」導線 (または本体クリック) で
 * `onOpenPanel` を呼ぶ (大量部屋パネル自体は Task6 で接続)。単一スポットは ListingCard 本体の
 * クリックがそのまま詳細遷移を担う。
 */
export const MapSpotCard: React.FC<MapSpotCardProps> = ({
  spot,
  expanded,
  onExpand,
  onAddToTour,
  onOpenPanel,
  markerPos,
  wrapSize,
  mapScale,
  gestureActiveRef,
}) => {
  const { t } = useTranslation();
  const total = spot.listings.length;
  const isMulti = total >= 2;

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
    // 初回同期測定 + 以降は画像ロード等の高さ変化に追従 (pointermove 中の読み取りはしない)。
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

  // クランプは拡大時 (画面固定サイズ) だけ必要 (小さいときは枠内に収まる)。
  const clampOffset = useMemo(() => {
    if (!expanded || !cardSize) return { dx: 0, dy: 0 };
    const screen = clampExpandedCardOffset({
      markerX: markerPos.x,
      markerY: markerPos.y,
      wrapW: wrapSize.w,
      wrapH: wrapSize.h,
      cardW: cardSize.w,
      cardH: cardSize.h,
    });
    // 画面 px → card-plane px。plane が ×mapScale するので ÷mapScale で相殺し、画面上は screen.dx/dy になる。
    return { dx: screen.dx / mapScale, dy: screen.dy / mapScale };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, cardSize, markerPos.x, markerPos.y, wrapSize.w, wrapSize.h, mapScale]);

  // Esc で閉じる。拡大中だけ listener を張る (全カードが常時 listener を持たないように)。
  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExpand(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, onExpand]);

  return (
    <div
      className="housing-bmap-card"
      data-testid={`bmap-card-${spot.key}`}
      data-expanded={expanded ? 'true' : 'false'}
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
      // 地図の空白クリック (onExpand(null)) がここでの操作に反応して閉じないよう、
      // カード内のクリックは外へ伝播させない (詳細遷移は ListingCard 自身の onClick が担う)。
      onClick={(e) => e.stopPropagation()}
    >
      {isMulti && (
        <button
          type="button"
          className="housing-bmap-card-more"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPanel(spot.key);
          }}
        >
          {t('housing.map.spot_open_panel', { count: total })}
        </button>
      )}
      <ListingCard
        listing={spot.representative}
        onAddToTour={onAddToTour}
        onCardClick={isMulti ? () => onOpenPanel(spot.key) : undefined}
      />
    </div>
  );
};
