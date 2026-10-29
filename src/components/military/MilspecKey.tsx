import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref, RefObject } from 'react';
import { capSVG } from './armor/svg';
import { bbox, centroid, offsetPoly, P } from './armor/geom';
import { readPalette } from './armor/palette';
import { useHtmlClassTick } from './armor/useHtmlClassTick';
import { ensureDefs } from './armor/defs';
import { useReducedMotion } from '../../lib/housing/useReducedMotion';
import type { CapSpec, Pt } from './armor/types';
import './MilspecKey.css';

// 押下の形(見本 js:681-720 の値。アニメは transform のみ = 明るさ変化は載せない)
const KP = { rest: 'translateY(0px) scale(1, 1)', bottom: 'translateY(1.45px) scale(0.962, 0.955)', latch: 'translateY(0.9px) scale(0.985, 0.925)' };
const DOWN_REST = 'cubic-bezier(.6,0,1,.6)';
const downFrames = (from: string): Keyframe[] => [
  { transform: from, easing: DOWN_REST },
  { transform: 'translateY(0.35px) scale(0.993, 0.99)', offset: 0.42, easing: 'cubic-bezier(.2,0,.4,1)' },
  { transform: 'translateY(1.75px) scale(0.957, 0.947)', offset: 0.76, easing: 'ease-out' },
  { transform: 'translateY(1.3px) scale(0.964, 0.957)', offset: 0.9 },
  { transform: KP.bottom },
];
const UP_REST: Keyframe[] = [
  { transform: KP.bottom },
  { transform: 'translateY(-1px) scale(1.006, 1.008)', offset: 0.36, easing: 'cubic-bezier(.2,.9,.3,1)' },
  { transform: 'translateY(0.4px) scale(0.998, 0.998)', offset: 0.62 },
  { transform: 'translateY(-0.15px) scale(1, 1)', offset: 0.82 },
  { transform: KP.rest },
];
const UP_LATCH: Keyframe[] = [
  { transform: KP.bottom },
  { transform: 'translateY(0.4px) scale(0.99, 0.935)', offset: 0.42, easing: 'cubic-bezier(.2,.9,.3,1)' },
  { transform: 'translateY(1.1px) scale(0.983, 0.92)', offset: 0.72 },
  { transform: KP.latch },
];

// 連動キー: 前のキーが機構に弾かれて戻る(見本 js:705)
const POP: Keyframe[] = [
  { transform: KP.latch },
  { transform: 'translateY(-1.3px) scale(1.008, 1.012)', offset: 0.34, easing: 'cubic-bezier(.2,.9,.3,1)' },
  { transform: 'translateY(0.45px) scale(0.997, 0.997)', offset: 0.6 },
  { transform: 'translateY(-0.2px) scale(1, 1)', offset: 0.8 },
  { transform: KP.rest },
];

type Props = {
  cap: CapSpec;
  label?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** React 19 の ref-as-prop。内部の button ref と合成する */
  ref?: Ref<HTMLButtonElement>;
  pressed?: boolean;
  /** 連動(ラジオ)キー。押すと沈んだまま止まり、pressed が外れると弾かれて戻る */
  latch?: boolean;
  disabled?: boolean;
  className?: string;
  /** 刻印の中心からのずれ(見本の dx / dy) */
  labelOffset?: Pt;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

/** キーの形(多角形)の SVG を実寸・テーマ・書体に合わせて描く */
function useCapDrawing(cap: CapSpec) {
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tick = useHtmlClassTick();
  const capKey = useMemo(() => JSON.stringify(cap), [cap]);
  const latest = useRef(cap);
  latest.current = cap;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    ensureDefs();
    el.innerHTML = capSVG(latest.current, readPalette(document.documentElement), `mk${uid}`);
  }, [capKey, tick, uid]);
  const bb = useMemo(() => bbox(cap.pts), [cap]);
  const [cx, cy] = useMemo(() => centroid(cap.pts), [cap]);
  return { ref, bb, cx, cy };
}

const labelPos = (cx: number, cy: number, bx: number, by: number, off?: Pt) => ({
  left: `${(cx - bx + (off?.[0] ?? 0)).toFixed(1)}px`,
  top: `${(cy - by + (off?.[1] ?? 0)).toFixed(1)}px`,
});

/**
 * 押下の動き(見本 js:681-720)。button に native リスナーを付け、kf 層を WAAPI で動かす。
 * - pointerdown / キーボード(Enter・Space)で沈み、click / blur / window の pointerup・cancel で戻る
 * - latch: 連動キー。pressed が外れたら弾かれて戻る
 * btnRef は effect 時点で button を指していること(MilspecKeyCap は祖先の button を探して渡す)
 */
function useKeyPressMotion(o: { btnRef: RefObject<HTMLElement | null>; kfRef: RefObject<HTMLElement | null>; pressed?: boolean; latch?: boolean }): void {
  const { btnRef, kfRef, pressed, latch } = o;
  const reduced = useReducedMotion();
  const live = useRef({ pressed, latch, reduced });
  live.current = { pressed, latch, reduced };
  const st = useRef<{ down: boolean; held: boolean; anims: Animation[]; timer?: number }>({ down: false, held: false, anims: [] });

  const run = (frames: Keyframe[], dur: number, shTo: number, shDur: number): Animation | null => {
    const kf = kfRef.current;
    if (!kf || live.current.reduced || typeof kf.animate !== 'function') return null;
    st.current.anims.forEach((a) => a.cancel());
    const a = kf.animate(frames, { duration: dur, fill: 'forwards' });
    st.current.anims = [a];
    const sh = kf.querySelector('.sh');
    if (sh && typeof sh.animate === 'function') {
      sh.animate([{ opacity: getComputedStyle(sh).opacity }, { opacity: shTo }], { duration: shDur, fill: 'forwards' });
    }
    return a;
  };
  const isDisabled = () => (btnRef.current as HTMLButtonElement | null)?.disabled === true;
  const down = () => {
    if (isDisabled() || st.current.down) return;
    st.current.down = true;
    btnRef.current?.classList.add('milspec-key-down');
    run(downFrames(live.current.pressed ? KP.latch : KP.rest), 160, 0.12, 150);
  };
  const up = (to: 'rest' | 'latch') => {
    if (!st.current.down) {
      // 押下の途中を経ていない(キーボード等)ときは、いったん沈めてから戻す
      down();
      if (!st.current.down) return; // 押せない状態(disabled 等)なら再試行しない
      window.clearTimeout(st.current.timer);
      st.current.timer = window.setTimeout(() => up(to), 150);
      return;
    }
    st.current.down = false;
    btnRef.current?.classList.remove('milspec-key-down');
    const isLatch = to === 'latch';
    const a = run(isLatch ? UP_LATCH : UP_REST, isLatch ? 280 : 440, isLatch ? 0.3 : 1, 320);
    if (a) a.onfinish = () => { if (st.current.anims[0] === a) { a.cancel(); st.current.anims = []; } };
  };
  // 連動キーの pressed が外れた = 別のキーが掛かった: 弾かれて戻る
  const prevPressed = useRef(pressed);
  useEffect(() => {
    if (latch && prevPressed.current && !pressed) {
      const a = run(POP, 480, 1, 420);
      if (a) a.onfinish = () => { if (st.current.anims[0] === a) { a.cancel(); st.current.anims = []; } };
    }
    prevPressed.current = pressed;
  });
  const upRef = useRef(up);
  upRef.current = up;
  const downRef = useRef(down);
  downRef.current = down;

  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const onPointerDown = (e: PointerEvent) => { if (e.button === 0) { st.current.held = true; downRef.current(); } };
    const onKeyDown = (e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) downRef.current(); };
    // フォーカスが外れたら沈めたままにしない(キーボード押下中の blur 対策)
    const onBlur = () => {
      if (st.current.down) { st.current.held = false; window.clearTimeout(st.current.timer); upRef.current(live.current.latch && live.current.pressed ? 'latch' : 'rest'); }
    };
    const onClick = () => { st.current.held = false; upRef.current(live.current.latch ? 'latch' : 'rest'); };
    let clickWait = 0;
    // ポインタがキーの外で離されても戻す
    const release = (e: Event) => {
      if (!st.current.held) return;
      // キー自身の上で離したときは click が戻しを担当する(二重に戻さない)。
      // ただし浮かぶものの外側押し(useDismissOnOutside)が click を止めると来ないので、来なければ押す前の姿勢へ戻す
      if (e.target instanceof Node && btn.contains(e.target)) {
        window.clearTimeout(clickWait);
        clickWait = window.setTimeout(() => {
          if (!st.current.held) return;
          st.current.held = false;
          if (st.current.down) upRef.current(live.current.latch && live.current.pressed ? 'latch' : 'rest');
        }, 0);
        return;
      }
      st.current.held = false;
      if (st.current.down) upRef.current('rest');
    };
    btn.addEventListener('pointerdown', onPointerDown);
    btn.addEventListener('keydown', onKeyDown);
    btn.addEventListener('blur', onBlur);
    btn.addEventListener('click', onClick);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    const s = st.current;
    return () => {
      btn.removeEventListener('pointerdown', onPointerDown);
      btn.removeEventListener('keydown', onKeyDown);
      btn.removeEventListener('blur', onBlur);
      btn.removeEventListener('click', onClick);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.clearTimeout(s.timer);
      window.clearTimeout(clickWait);
      s.anims.forEach((a) => a.cancel());
    };
  }, [btnRef]);
}

/** 押せるキー。位置は親が決める(自身は position:absolute にしない) */
export function MilspecKey({ cap, label, onClick, pressed, latch, disabled, className, labelOffset, style, onPointerDown, onKeyDown, onBlur, ref: extRef, role, ...rest }: Props) {
  const { ref, bb, cx, cy } = useCapDrawing(cap);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const setBtnRef = useCallback((el: HTMLButtonElement | null) => {
    btnRef.current = el;
    if (typeof extRef === 'function') extRef(el);
    else if (extRef) (extRef as { current: HTMLButtonElement | null }).current = el;
  }, [extRef]);
  const kfRef = useRef<HTMLSpanElement>(null);
  const hit = useMemo(() => P(offsetPoly(cap.pts, -0.8)), [cap]);
  const vb = `${bb.x} ${bb.y} ${bb.w} ${bb.h}`;
  useKeyPressMotion({ btnRef, kfRef, pressed, latch });

  return (
    <button
      type="button"
      role={role}
      // 視覚状態は data-pressed。ARIA は呼び出し側の指定を潰さない(rest が後勝ち)。
      // ラジオ(連動)キーは aria-checked、それ以外は pressed があるときだけ aria-pressed
      data-pressed={pressed ? '' : undefined}
      {...(role === 'radio' ? { 'aria-checked': !!pressed } : pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      {...rest}
      ref={setBtnRef}
      className={`milspec-key${className ? ` ${className}` : ''}`}
      style={{ width: bb.w, height: bb.h, ...style }}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <span className="milspec-key-hov">
        <span className="milspec-key-kf" ref={kfRef}>
          <svg className="milspec-key-cap" width={bb.w} height={bb.h} viewBox={vb} ref={ref} aria-hidden="true" />
          <span className="milspec-key-lb" style={labelPos(cx, cy, bb.x, bb.y, labelOffset)}>{label}</span>
        </span>
      </span>
      <svg className="milspec-key-hitz" aria-hidden="true" width={bb.w} height={bb.h} viewBox={vb}>
        <polygon className="milspec-key-hit" points={hit} />
      </svg>
    </button>
  );
}

/**
 * 見た目だけのキー。自分で <button> を持つ部品の中に置くと、最も近い祖先の button に
 * 押下の動きを付ける(button が無ければ見た目だけ)。active = 下縁のランプを緑にする
 */
export function MilspecKeyCap({ cap, label, className, active }: { cap: CapSpec; label?: ReactNode; className?: string; active?: boolean }) {
  const { ref, bb, cx, cy } = useCapDrawing(cap);
  const rootRef = useRef<HTMLSpanElement>(null);
  const kfRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLElement | null>(null);
  // フックの listener 登録 effect より前に祖先 button を確定させる(宣言順 = 実行順)
  useEffect(() => { btnRef.current = rootRef.current?.closest('button') ?? null; }, []);
  useKeyPressMotion({ btnRef, kfRef });
  return (
    <span ref={rootRef} className={`milspec-key milspec-key-static${active ? ' milspec-key-active' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true" style={{ width: bb.w, height: bb.h }}>
      <span className="milspec-key-hov">
        <span className="milspec-key-kf" ref={kfRef}>
          <svg className="milspec-key-cap" width={bb.w} height={bb.h} viewBox={`${bb.x} ${bb.y} ${bb.w} ${bb.h}`} ref={ref} aria-hidden="true" />
          <span className="milspec-key-lb" style={labelPos(cx, cy, bb.x, bb.y)}>{label}</span>
        </span>
      </span>
    </span>
  );
}
