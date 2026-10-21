import React from 'react';
import { useTranslation } from 'react-i18next';
import { MilspecLed } from '../MilspecDecor';
import { useThemeStore } from '../../../store/useThemeStore';
import { useCanPreviewWip } from '../../../hooks/useCanPreviewWip';
import { useTransitionOverlay } from '../../ui/TransitionOverlay';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import './milspecH4.css';

// H4 MODE T 字レバー(見本 js:1141-1157)。標準 ⇄ MIL-SPEC。軍事表示中は「下」。上げると標準へ戻る。
// 親は「ヘッダー区画」。TransitionOverlayProvider の内側に置くこと(標準へ戻すとき runTransition を使う)。

const Y_UP = 2;
const THUMB_H = 12; // 見本: yDn = clientHeight - 12

/** 重いレバーの動き: 最初に少し逆らい、落ちて、底で 2 回跳ねて止まる(見本 js:1148 の値) */
const settleFrames = (from: number, to: number, dir: 1 | -1): Keyframe[] => [
  { transform: `translateY(${from}px)`, easing: 'cubic-bezier(.4,0,.8,.4)' },
  { transform: `translateY(${from - dir * 0.8}px)`, offset: 0.14, easing: 'cubic-bezier(.6,0,1,.5)' },
  { transform: `translateY(${to + dir * 2.4}px)`, offset: 0.62, easing: 'ease-out' },
  { transform: `translateY(${to - dir * 1}px)`, offset: 0.78, easing: 'ease-in-out' },
  { transform: `translateY(${to + dir * 0.35}px)`, offset: 0.9 },
  { transform: `translateY(${to}px)` },
];

export interface ModeLeverProps {
  /** 区画座標の位置と大きさ(headerLayout の decor.h4.lever) */
  x: number; y: number; w: number; h: number;
}

export function ModeLever({ x, y, w, h }: ModeLeverProps) {
  const { t } = useTranslation();
  const canPreview = useCanPreviewWip();
  const { runTransition } = useTransitionOverlay();
  const reduced = useReducedMotion();
  const yDn = h - THUMB_H;

  const lvRef = React.useRef<HTMLButtonElement>(null);
  const thRef = React.useRef<HTMLSpanElement>(null);
  const pos = React.useRef(yDn); // 軍事表示中 = 下
  const [on, setOn] = React.useState(true); // aria-checked(軍事表示中 = true)
  const busy = React.useRef(false);
  const timer = React.useRef<number | undefined>(undefined);
  const drag = React.useRef<{ y0: number; l0: number; moved: boolean } | null>(null);
  const live = React.useRef({ reduced, runTransition });
  live.current = { reduced, runTransition };

  const place = (v: number) => {
    pos.current = v;
    if (thRef.current) thRef.current.style.transform = `translateY(${v}px)`;
  };
  React.useLayoutEffect(() => { place(pos.current); }, [canPreview]);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const settle = (down: boolean) => {
    if (busy.current) return;
    const from = pos.current, to = down ? yDn : Y_UP;
    const th = thRef.current;
    if (!live.current.reduced && th && typeof th.animate === 'function') {
      th.animate(settleFrames(from, to, down ? 1 : -1), { duration: 380 });
    }
    place(to);
    setOn(down);
    // 下ろし直した(= 軍事のまま)ときは切替なし。上げたときだけ 240ms 後に標準へ
    if (down) return;
    busy.current = true;
    timer.current = window.setTimeout(() => {
      live.current.runTransition(() => useThemeStore.getState().setThemeStyle('standard'), 'theme');
    }, live.current.reduced ? 0 : 240);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (busy.current) return;
    drag.current = { y0: e.clientY, l0: pos.current, moved: false };
    lvRef.current?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 2) d.moved = true;
    place(Math.min(yDn, Math.max(Y_UP, d.l0 + dy)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    // ドラッグ = 中間より下かどうか / ただのクリック = 今の逆
    const down = d.moved ? pos.current > (Y_UP + yDn) / 2 : !on;
    settle(down);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); settle(!on); }
  };
  // マウス/タッチは pointerup で処理済み。detail 0 の click(支援技術からの起動)だけ受ける
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) settle(!on);
  };

  if (!canPreview) return null;
  const label = t('app.theme_style_to_standard');
  return (
    <button
      ref={lvRef}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      className="milspec-mlv"
      style={{ left: x, top: y, width: w, height: h }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; place(on ? yDn : Y_UP); }}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <span className="milspec-mlv-slot" />
      <span className="milspec-mlv-hzs" />
      <MilspecLed state={on ? 'on' : 'off'} size={6} />
      <span className="milspec-mlv-th" ref={thRef} />
    </button>
  );
}
