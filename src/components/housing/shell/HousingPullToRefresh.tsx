import { useEffect, useRef } from 'react';

/** 離したときに更新が走る引っ張り量(px・抵抗適用後)。見本 R2 の THRESH */
const PTR_THRESHOLD = 70;
/** 引っ張り量の上限(px)。見本 R2 の MAX */
const PTR_MAX = 110;
/** 引っ張り量に掛ける抵抗。見本 R2 の 0.55 */
const PTR_RESISTANCE = 0.55;
/** 更新中に円を止める位置(px) */
const PTR_HOLD = 56;
/** 円を回してからリロードするまでの最短時間(ms・押した手応え) */
const PTR_RELOAD_DELAY = 300;
/** 縦/横の向きを判定するまでの遊び(px) */
const PTR_SLOP = 6;

/**
 * ここから始めた引っ張りは無視する場所。
 * - 地図(区画マップ / ツアーのナビ地図 / 経路編集): ドラッグ・ピンチで動かすため
 * - ツアートレイの並べ替えつまみ
 * - モーダル / ダイアログ / 下から出るシート(MobileBottomSheet は data-no-pull-refresh 付き)
 * - 入力欄
 * - data-no-pull-refresh を付けた要素の中
 */
const PTR_EXCLUDE_SELECTOR = [
  '[data-no-pull-refresh]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '.housing-bmap-wrap',
  '.housing-browse-map-view',
  '.housing-tour-map-wrap',
  '.housing-tour-tray-drag',
  '.housing-modal-backdrop',
  '.housing-panel-modal-backdrop',
].join(',');

/** ホーム画面アプリ(PWA)として起動していて、タッチ端末か */
function isStandaloneTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone =
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!standalone) return false;
  return (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
}

/** タッチ開始点から上へ辿った要素のどれかが少しでもスクロールされていれば true(= 一番上ではない) */
function isScrolledAway(start: EventTarget | null): boolean {
  if (window.scrollY > 0) return true;
  let el = start instanceof Element ? start : null;
  while (el) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

interface Props {
  /** 更新処理。既定は画面の再読み込み(Safari 標準の引っ張って更新と同じ・Service Worker の新版も反映される) */
  onRefresh?: () => void;
}

/**
 * iPhone のホーム画面アプリ用「引っ張って更新」(見本 R2)。
 * 通常のブラウザでは標準の引っ張って更新があるため何もしない。
 * 描画は React の再描画を介さず DOM を直接動かす(指に追従させるため)。
 */
export const HousingPullToRefresh: React.FC<Props> = ({ onRefresh }) => {
  const indRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!isStandaloneTouch()) return;
    const ind = indRef.current;
    const circle = circleRef.current;
    if (!ind || !circle) return;

    let startX = 0;
    let startY = 0;
    let tracking = false; // 始めてよい場所に指が置かれた
    let pulling = false; // 縦に引っ張り中と確定した
    let busy = false;
    let dy = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const getBody = () => document.querySelector<HTMLElement>('.housing-shell');

    const setPull = (d: number) => {
      const body = getBody();
      // 0 のときは transform を外す(残すと position:fixed の子の基準が変わってしまう)
      if (body) body.style.transform = d > 0 ? `translateY(${d}px)` : '';
      ind.style.opacity = String(Math.min(1, d / 40));
      ind.style.transform = `translateY(${Math.max(0, d / 2 - 14)}px)`;
      circle.setAttribute('stroke-dasharray', `${Math.min(100, (d / PTR_THRESHOLD) * 85)} 100`);
    };

    const setSnap = (on: boolean) => {
      getBody()?.classList.toggle('housing-ptr-snap', on);
      ind.classList.toggle('housing-ptr-snap', on);
    };

    const reset = () => {
      pulling = false;
      tracking = false;
      dy = 0;
    };

    const onStart = (e: TouchEvent) => {
      if (busy) return;
      reset();
      if (e.touches.length !== 1) return;
      const target = e.target;
      if (target instanceof Element && target.closest(PTR_EXCLUDE_SELECTOR)) return;
      if (isScrolledAway(target)) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      if (e.touches.length !== 1) {
        // 2 本指になったら中断して元に戻す
        if (pulling) {
          setSnap(true);
          setPull(0);
        }
        reset();
        return;
      }
      const mx = e.touches[0].clientX - startX;
      const my = e.touches[0].clientY - startY;
      if (!pulling) {
        // 向きが確定するまでは何も邪魔しない
        if (Math.abs(mx) < PTR_SLOP && Math.abs(my) < PTR_SLOP) return;
        if (my <= 0 || Math.abs(mx) > my) {
          tracking = false; // 上方向・横方向 → 通常のスクロール/スワイプに任せる
          return;
        }
        pulling = true;
        setSnap(false);
      }
      // 引っ張り中と判定した時だけ標準のスクロールを止める
      if (e.cancelable) e.preventDefault();
      dy = Math.min(PTR_MAX, Math.max(0, my) * PTR_RESISTANCE);
      setPull(dy);
    };

    const onEnd = () => {
      if (!pulling) {
        tracking = false;
        return;
      }
      const fire = dy >= PTR_THRESHOLD;
      reset();
      setSnap(true);
      if (fire) {
        busy = true;
        setPull(PTR_HOLD);
        ind.classList.add('housing-ptr-spinning');
        timer = setTimeout(() => {
          if (refreshRef.current) refreshRef.current();
          else window.location.reload();
        }, PTR_RELOAD_DELAY);
      } else {
        setPull(0);
      }
    };

    const onCancel = () => {
      if (pulling) {
        setSnap(true);
        setPull(0);
      }
      reset();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      if (timer) clearTimeout(timer);
      const body = getBody();
      if (body) {
        body.style.transform = '';
        body.classList.remove('housing-ptr-snap');
      }
    };
  }, []);

  return (
    <div ref={indRef} className="housing-ptr-ind" aria-hidden="true" data-no-pull-refresh>
      <svg className="housing-ptr-ring" viewBox="0 0 28 28">
        <circle ref={circleRef} cx="14" cy="14" r="11" pathLength="100" strokeDasharray="0 100" />
      </svg>
    </div>
  );
};
