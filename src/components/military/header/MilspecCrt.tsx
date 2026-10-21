import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgressJourney } from '../../progress/useProgressJourney';
import { ProgressRecordPanel } from '../../progress/ProgressRecordPanel';
import { ProgressCelebrationHost } from '../../progress/ProgressTrackingHUD';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import { onPower } from '../power/power';
// 副作用 import: i18next の初期化(MilspecFooter.tsx と同じ理由)
import '../../../i18n';
import './milspecCrt.css';

/** 軌跡を写す枠(見本の polyline の範囲: x 110〜306・y 30(下)〜4(上)) */
const X0 = 110, X1 = 306, Y_BOTTOM = 30, Y_TOP = 4;
const DRAW_MS = 1300;

/** 見本 crtDraw の easeInOutCubic */
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** 記録点(x,y とも 0〜100)を viewBox 座標へ。1 点だけなら左下の起点から線を引く */
export function toCrtVertices(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const v = points.map((p) => ({
    x: +(X0 + (p.x / 100) * (X1 - X0)).toFixed(2),
    y: +(Y_BOTTOM - (p.y / 100) * (Y_BOTTOM - Y_TOP)).toFixed(2),
  }));
  return v.length === 1 ? [{ x: X0, y: Y_BOTTOM }, v[0]] : v;
}

/** 見本 crtDraw(js:751-761): 軌跡を左から 1300ms で描き込み、先端の点が走る。戻り値で中断できる */
function drawTrace(pl: SVGPolylineElement, dot: SVGCircleElement): () => void {
  if (typeof pl.getTotalLength !== 'function') return () => {};
  const L = pl.getTotalLength();
  const t0 = performance.now();
  let raf = 0;
  let stopped = false;
  dot.classList.remove('idle');
  pl.style.strokeDasharray = `${L} ${L}`;
  const finish = () => {
    pl.style.strokeDasharray = '';
    pl.style.strokeDashoffset = '';
    dot.classList.add('idle');
  };
  const step = (t: number) => {
    if (stopped || !pl.isConnected) return;
    const p = Math.min(1, (t - t0) / DRAW_MS);
    const l = L * ease(p);
    const q = pl.getPointAtLength(l);
    pl.style.strokeDashoffset = String(L - l);
    dot.setAttribute('cx', q.x.toFixed(2));
    dot.setAttribute('cy', q.y.toFixed(2));
    if (p < 1) raf = requestAnimationFrame(step); else finish();
  };
  raf = requestAnimationFrame(step);
  return () => { stopped = true; cancelAnimationFrame(raf); finish(); };
}

/**
 * MIL-SPEC のブラウン管(見本 .crt・js:915-919)。標準の「攻略の軌跡」と同じ値(useProgressJourney)を出す。
 * 大きさは親(ヘッダー区画の枠)に合わせる。配置は呼び出し側(Task 8)。
 */
export function MilspecCrt({ className, style }: { className?: string; style?: CSSProperties }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const j = useProgressJourney();
  const btnRef = useRef<HTMLButtonElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const cancelDraw = useRef<() => void>(() => {});
  const bootTimer = useRef<number | undefined>(undefined);

  const verts = toCrtVertices(j.points);
  const last = verts[verts.length - 1];
  const pointsAttr = verts.map((p) => `${p.x},${p.y}`).join(' ');

  const draw = () => {
    cancelDraw.current();
    const pl = lineRef.current, dot = dotRef.current;
    if (reduced || !pl || !dot) return;
    cancelDraw.current = drawTrace(pl, dot);
  };

  // 値が増えた・変わったら描き込み(初回表示は静止画のまま)
  const sig = pointsAttr + (j.cleared ? '|clr' : '');
  const prevSig = useRef(sig);
  useEffect(() => {
    if (prevSig.current === sig) return;
    prevSig.current = sig;
    if (verts.length > 0) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => () => { cancelDraw.current(); window.clearTimeout(bootTimer.current); }, []);

  // 電源投入: boot を付け直し + 420ms 後に描き込み(見本 js:1165)
  const latest = useRef({ draw, hasTrace: verts.length > 0 });
  latest.current = { draw, hasTrace: verts.length > 0 };
  useEffect(() => onPower((e) => {
    if (e.state === 'off') { window.clearTimeout(bootTimer.current); return; } // 電源断: 描き込み待ちを止める
    if (e.state !== 'on' || e.reduced) return;
    const b = btnRef.current;
    if (!b) return;
    b.classList.remove('boot');
    void b.offsetWidth;
    b.classList.add('boot');
    window.clearTimeout(bootTimer.current);
    bootTimer.current = window.setTimeout(() => { if (latest.current.hasTrace) latest.current.draw(); }, 420);
  }), []);

  // クリック: 起動し直し(boot)+ 350ms 後に描き込み + 記録パネルを開く(見本 js:1116)
  const onClick = () => {
    const b = btnRef.current;
    if (b && !reduced) {
      b.classList.remove('boot');
      void b.offsetWidth;
      b.classList.add('boot');
      window.clearTimeout(bootTimer.current);
      bootTimer.current = window.setTimeout(() => { if (verts.length > 0) draw(); }, 350);
    }
    j.openPanel();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`milspec-crt${className ? ` ${className}` : ''}`}
        style={style}
        data-progress-hud-band
        aria-label={`${t('progress.crt_title')} - ${t('progress.crt_record_hint')}`}
        onClick={onClick}
      >
        <span className="scr-in">
          <svg viewBox="0 0 326 34" preserveAspectRatio="none" aria-hidden="true">
            <g className="grid">
              <path d="M0 8.5H326M0 17.5H326M0 26.5H326" />
              <path d="M110.5 0V34M160.5 0V34M210.5 0V34M260.5 0V34M310.5 0V34" />
            </g>
            {verts.length > 0 && (
              <>
                <polyline ref={lineRef} className="trace" points={pointsAttr} />
                <circle ref={dotRef} className="tdot idle" r="1.7" cx={last.x} cy={last.y} />
              </>
            )}
          </svg>
          {j.empty ? (
            <span className="t" style={{ left: 9, top: 14 }}><span className="jp">{t('progress.empty_cta')}</span></span>
          ) : (
            <>
              <span className="t" style={{ left: 9, top: 5 }}>PFD-2 · <span className="jp">{t('progress.crt_title')}</span></span>
              <span className="t big" style={{ left: 9, top: 15 }}>{`${j.activeDays}D ${j.activeHours}H`}</span>
              <span className="t" style={{ left: 78, top: 19 }}>{j.cleared ? '▲CLR' : `${j.pct}%`}</span>
            </>
          )}
          <span className="scan" />
          <span className="band" />
          <span className="glass" />
        </span>
      </button>
      {/* 記録パネルとお祝い演出は標準と同じ条件で出す */}
      <ProgressRecordPanel />
      <ProgressCelebrationHost />
    </>
  );
}
