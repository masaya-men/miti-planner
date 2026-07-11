import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BrowseMapSpot } from '../../../../lib/housing/browseMapSpots';
import { useWardMapAsset } from '../../../../lib/housing/useWardMapAsset';
import { applyWheelZoom, zoomAt, type MapView } from '../../../../lib/housing/mapZoom';
import { plotToPlacementIn, apartToPlacementIn } from '../../../../lib/housing/wardRoute';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { MapSpotCard } from './MapSpotCard';

export interface BrowseWardMapProps {
  mapKey: string;
  spots: BrowseMapSpot[];
  expandedKey: string | null;
  onExpand: (key: string | null) => void;
  onAddToTour: (id: string) => void;
}

/** 手動ズームで許すフィット倍率の上限 (spec: フィット×1〜×6)。
 *  下限側は mapZoom.MIN_SCALE(=1) をそのまま「レベル」の下限として使う (下記コメント参照)。 */
const MAX_ZOOM_LEVEL = 6;
/** パン/ピンチ操作の後に「クリックとみなす」移動量の閾値(px)。これを超えたら地図操作とみなし、
 *  wrap の onClick (空白クリック=拡大解除) を発火させない。 */
const CLICK_MOVE_THRESHOLD = 4;
/** 吹き出し/拡大カードがコンテナ右端・上端からはみ出さないよう反転(flip)判定に使う余白(px)。
 *  実機確認 (DPR 2.58、開発者の参照画面 CSS 679px 高) で当初 300/300 は大きすぎ、コンテナ中央付近の
 *  スポットまで無駄に反転してしまうこと (かつ短いコンテナでは反転後も逆側にはみ出す) を確認して調整した。
 *  X = 拡大カード幅 --housing-bmap-card-w(280px, housing.css) の半分(中央寄せ時の右側はみ出し分)+ 余裕。
 *  Y = ミニカードの実寸(48pxサムネ+パディングで60px程)は小さく反転がほぼ不要な一方、拡大カード
 *  (画像+キャプション+フッターで270px超) は反転してもなお短いコンテナでは収まりきらない場合がある
 *  (spec の flip は「右端/上端」の単純な二値反転までがスコープ、それ以上の座標クランプは対象外)。
 *  「本当に上端に近い(=どちらの向きでもまず収まらない)ときだけ反転」程度に留め、反転しても
 *  最低限カード上部(画像)が見えるようにする値としている。 */
const FLIP_MARGIN_X = 180;
const FLIP_MARGIN_Y = 220;

type Marker = { spot: BrowseMapSpot; x: number; y: number };

/**
 * 探す専用のワード地図 (SVG差し込み + パン/ズーム + マーカーレイヤ)。spec §4.3/5.1、plan Task4。
 *
 * ビュー state の `scale` は「実 px 倍率」ではなく **フィット基準の倍率(レベル)** として保持する
 * (レベル1 = ちょうどフィット)。理由: `mapZoom.zoomAt`/`applyWheelZoom` は `MIN_SCALE=1`/`MAX_SCALE=8`
 * に固定クランプする純関数で、ツアー側 (`TourNavMap`) は「経路の bbox にズームインした状態」が
 * 基準なので scale>=1 が自然に成り立つ。しかし探す地図は「ワード全体をコンテナに contain フィット」
 * が基準のため、実 px 倍率は 1 を大きく下回る(例: viewBox 1882px を 800px 幅のコンテナに収める
 * と実倍率 0.42)。レベル表現にすることで:
 * - mapZoom の `MIN_SCALE=1` が「レベル1 = フィットより外へは絶対に出さない」という
 *   spec 5. の下限(フィット×1)とそのまま一致する (追加コードなしで下限が守られる)。
 * - 上限は mapZoom 側が緩い(×8)ので、このファイル側で ×6 に追加クランプする (下記 clampZoomLevel)。
 * - 実際の描画倍率は `fitScale * view.scale` (fitScale はコンテナ実寸から都度計算)。
 * ツアー側ファイル (mapZoom.ts 含む) は読み込みのみで一切編集しない。
 */
export const BrowseWardMap: React.FC<BrowseWardMapProps> = ({ mapKey, spots, expandedKey, onExpand, onAddToTour }) => {
  const { t } = useTranslation();
  const setBrowseView = useHousingViewStore((s) => s.setBrowseView);
  const assetState = useWardMapAsset(mapKey);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [fittedKey, setFittedKey] = useState<string | null>(null);

  // mapKey が変わったら描画フェーズで即ビューをリセットする(useWardMapAsset 自身の prevKey パターンを踏襲)。
  // 実際のフィットは下の effect が wrapSize/json 到着後に計算し直す。
  const [prevMapKey, setPrevMapKey] = useState(mapKey);
  if (mapKey !== prevMapKey) {
    setPrevMapKey(mapKey);
    setView({ scale: 1, tx: 0, ty: 0 });
    setFitScale(1);
    setFittedKey(null);
  }

  // コンテナ実寸を ResizeObserver でキャッシュ(イベント中に getBoundingClientRect 連打しない)。
  // mount 直後の値も measure() で即座に取得し、ResizeObserver が初回発火しない実行環境でも詰まらないようにする。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      setWrapSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const readyJson = assetState.status === 'ready' ? assetState.json : null;

  // 初期ビュー = コンテナ実寸への contain フィット (spec 4.: scale=min(cw/vw, ch/vh)、中央寄せ)。
  // mapKey ごとに一度だけ計算する(以後のリサイズでは手動パン/ズームを尊重して上書きしない)。
  // レビュー指摘: 通常の useEffect だと assetState が ready になるたび(初回表示・区切替のたび)
  // 未フィット(scale=1・左上原点)の地図が1フレーム見えてからスナップするフラッシュが起きる。
  // TourNavMap.tsx の同種フィット計算(useLayoutEffect)に合わせ、paint 前にフィットを確定する。
  useLayoutEffect(() => {
    if (!readyJson) return;
    if (fittedKey === mapKey) return;
    if (wrapSize.w === 0 || wrapSize.h === 0) return; // 未計測。次の wrapSize 更新で再試行。
    const { w: vw, h: vh } = readyJson.viewBox;
    const scale = Math.min(wrapSize.w / vw, wrapSize.h / vh);
    const tx = (wrapSize.w - vw * scale) / 2;
    const ty = (wrapSize.h - vh * scale) / 2;
    setFitScale(scale);
    setView({ scale: 1, tx, ty });
    setFittedKey(mapKey);
  }, [readyJson, mapKey, wrapSize, fittedKey]);

  // レベルを [1, MAX_ZOOM_LEVEL] にクランプ(下限は mapZoom.zoomAt の MIN_SCALE=1 で自動的に守られるため、
  // ここでは上限のみ追加でクランプする。6 は mapZoom の MAX_SCALE=8 以内なので zoomAt の再クランプと衝突しない)。
  const clampZoomLevel = (v: MapView, mx: number, my: number): MapView =>
    v.scale > MAX_ZOOM_LEVEL ? zoomAt(v, mx, my, MAX_ZOOM_LEVEL) : v;

  // ホイールズーム(カーソル位置固定)。React onWheel は passive で preventDefault が効かないためネイティブ登録。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => clampZoomLevel(applyWheelZoom(v, mx, my, e.deltaY), mx, my));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // パン(1本指/ドラッグ) + ピンチ(2本指)。TourNavMap.tsx:227-286 の形を書き写し(import はしない)、
  // 探す地図固有の「クリック(拡大解除)との区別」用に justPanned フラグを追加している。
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pan = useRef<{ sx: number; sy: number; tx0: number; ty0: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const justPanned = useRef(false);

  const localXY = (clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    // マーカー/カード (ミニカード・拡大カードのボタン等) 上の pointerdown はパン/ピンチの対象外にする。
    // ここで setPointerCapture すると、Pointer Events 仕様上「capture 中は click も capture 要素へ
    // 再ターゲットされる」ため、以降その指で発火する click イベントが wrap 自身 (= 空白クリック
    // ハンドラ onBlankClick) に奪われ、カード内のボタン (ツアー追加・お気に入り・詳細遷移等) の
    // クリックが握りつぶされてしまう (実機 Playwright 検証で発見: ツアー追加が無反応かつ拡大カードが
    // 閉じる不具合として再現した)。
    if ((e.target as HTMLElement).closest('.housing-bmap-marker-pos')) return;
    justPanned.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      pan.current = { sx: e.clientX, sy: e.clientY, tx0: view.tx, ty0: view.ty };
      pinch.current = null;
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      pan.current = null;
      justPanned.current = true; // ピンチはクリック扱いにしない
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = localXY((a.x + b.x) / 2, (a.y + b.y) / 2);
      const base = pinch.current;
      setView((v) => clampZoomLevel(zoomAt(v, mid.x, mid.y, base.scale * (dist / base.dist)), mid.x, mid.y));
    } else if (pan.current) {
      const p = pan.current;
      const dx = e.clientX - p.sx;
      const dy = e.clientY - p.sy;
      if (Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) justPanned.current = true;
      setView((v) => ({ ...v, tx: p.tx0 + dx, ty: p.ty0 + dy }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 1) {
      // ピンチ→単指: 残った指でパンを継続できるよう、その指の現在位置から pan を再初期化。
      const [rem] = [...ptrs.current.values()];
      pan.current = { sx: rem.x, sy: rem.y, tx0: view.tx, ty0: view.ty };
    }
    if (ptrs.current.size === 0) pan.current = null;
  };

  // 地図の空白クリックで拡大カードを閉じる(spec 4.2/Task4-6)。パン/ピンチ直後のクリックは無視する。
  // マーカー(ミニカード)自身のクリックは stopPropagation で止まるためここまで来ない。
  const onBlankClick = () => {
    if (justPanned.current) {
      justPanned.current = false;
      return;
    }
    onExpand(null);
  };

  const actualScale = view.scale * fitScale;

  // spots → 画面マーカー座標。座標 json に無い番地はスキップ(console.warn のみ・クラッシュしない = spec §5.5)。
  const markers: Marker[] = useMemo(() => {
    if (!readyJson) return [];
    const list: Marker[] = [];
    for (const spot of spots) {
      const placement = spot.kind === 'apart' ? apartToPlacementIn(readyJson) : plotToPlacementIn(readyJson, spot.plot, 'plot');
      if (!placement) {
        console.warn('[BrowseWardMap] 座標が見つからないスポットをスキップ:', spot.key);
        continue;
      }
      list.push({ spot, x: placement.x, y: placement.y });
    }
    return list;
  }, [readyJson, spots]);

  return (
    <div
      className="housing-bmap-wrap"
      data-testid="bmap-wrap"
      ref={wrapRef}
      onClick={onBlankClick}
      onPointerDown={assetState.status === 'ready' ? onPointerDown : undefined}
      onPointerMove={assetState.status === 'ready' ? onPointerMove : undefined}
      onPointerUp={assetState.status === 'ready' ? onPointerUp : undefined}
      onPointerCancel={assetState.status === 'ready' ? onPointerUp : undefined}
    >
      {assetState.status === 'loading' && (
        <div className="housing-bmap-message" data-testid="bmap-loading">
          <p className="housing-bmap-message-text">{t('housing.map.loading')}</p>
        </div>
      )}
      {assetState.status === 'error' && (
        <div className="housing-bmap-message" data-testid="bmap-error">
          <p className="housing-bmap-message-text">{t('housing.map.load_error')}</p>
          <button
            type="button"
            className="housing-empty-result-back"
            onClick={(e) => {
              e.stopPropagation();
              setBrowseView('list');
            }}
          >
            {t('housing.map.back_to_list')}
          </button>
        </div>
      )}
      {assetState.status === 'ready' && (
        <>
          <div
            className="housing-bmap-stage"
            data-testid="bmap-stage"
            style={{
              width: `${readyJson!.viewBox.w}px`,
              height: `${readyJson!.viewBox.h}px`,
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${actualScale})`,
            }}
          >
            <div
              className="housing-map-svg-host"
              role="img"
              aria-label={t('housing.workspace.center.map_alt')}
              dangerouslySetInnerHTML={{ __html: assetState.svg }}
            />
          </div>
          <div className="housing-bmap-markers">
            {markers.map((m) => {
              const sx = m.x * actualScale + view.tx;
              const sy = m.y * actualScale + view.ty;
              // コンテナ右端/上端に近いスポットは吹き出し/拡大カードが枠外へはみ出すため反転する
              // (MapSpotCard の flip prop、spec 4.2「地図の端では画面内に収まる向きに吹き出しを反転」)。
              const flip = {
                x: sx > wrapSize.w - FLIP_MARGIN_X,
                y: sy < FLIP_MARGIN_Y,
              };
              return (
                <div
                  key={m.spot.key}
                  className="housing-bmap-marker-pos"
                  style={{ transform: `translate(${sx}px, ${sy}px)` }}
                >
                  <MapSpotCard
                    spot={m.spot}
                    expanded={expandedKey === m.spot.key}
                    onExpand={onExpand}
                    onAddToTour={onAddToTour}
                    flip={flip}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
