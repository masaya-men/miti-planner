import React from 'react';
import { useTranslation } from 'react-i18next';
import { MilspecLed } from '../MilspecDecor';
import { useThemeStore } from '../../../store/useThemeStore';
import { useTransitionOverlay } from '../../ui/TransitionOverlay';
import { useCanPreviewWip } from '../../../hooks/useCanPreviewWip';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import { isPowered, powerOn, powerOff } from '../power/power';
import './milspecH4.css';

// H4 MODE T 字レバー(見本 js:1141-1157)= MIL-SPEC の電源スイッチ。位置は電源に追従(off = 上・on = 下)。
// 開いた直後は上から始まり、700ms 後に自動で下りて電源投入(見本 js:1228)。上げると電源断(300ms)の直後に標準へ戻る。

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
  const reduced = useReducedMotion();
  const { runTransition } = useTransitionOverlay();
  const runTransitionRef = React.useRef(runTransition);
  runTransitionRef.current = runTransition;
  const yDn = h - THUMB_H;
  const powered0 = React.useRef(isPowered()); // マウント時点の電源(Layout が先に立てる)

  const lvRef = React.useRef<HTMLButtonElement>(null);
  const thRef = React.useRef<HTMLSpanElement>(null);
  const pos = React.useRef(powered0.current ? yDn : Y_UP); // 電源 on = 下・off = 上
  const [on, setOn] = React.useState(powered0.current); // aria-checked = 電源状態
  const busy = React.useRef(false);
  const pendingOn = React.useRef(false); // 自動で下りてから電源が入るまでの待ち(240ms)の間
  const timer = React.useRef<number | undefined>(undefined);
  const drag = React.useRef<{ y0: number; l0: number; moved: boolean } | null>(null);
  const live = React.useRef({ reduced });
  live.current = { reduced };
  const dead = React.useRef(false);

  const place = (v: number) => {
    pos.current = v;
    if (thRef.current) thRef.current.style.transform = `translateY(${v}px)`;
  };
  React.useLayoutEffect(() => { place(pos.current); }, [canPreview]);
  // 電源 off で開いたら 700ms 後にレバーが自動で下りる(見本 js:1228)。アンマウントでタイマーを消す
  React.useEffect(() => {
    dead.current = false;
    let boot: number | undefined;
    // 判定はマウント時点の電源で行う(StrictMode の疑似アンマウントで属性が一瞬外れても自動で下ろす)
    if (!powered0.current) boot = window.setTimeout(() => { if (pos.current === Y_UP && !drag.current) settleRef.current(true); }, 700);
    return () => { dead.current = true; window.clearTimeout(boot); window.clearTimeout(timer.current); };
  }, []);

  const settle = (down: boolean) => {
    if (busy.current) return;
    const powered = isPowered();
    const waitingOn = pendingOn.current; // 電源投入待ちの間に上げられたら「標準へ」に進む
    pendingOn.current = false;
    const from = pos.current, to = down ? yDn : Y_UP;
    const th = thRef.current;
    if (!live.current.reduced && th && typeof th.animate === 'function') {
      th.animate(settleFrames(from, to, down ? 1 : -1), { duration: 380 });
    }
    place(to);
    setOn(down);
    window.clearTimeout(timer.current);
    if (down) {
      // 下ろした = 電源投入(すでに入っていれば何もしない)
      if (powered) return;
      pendingOn.current = true;
      timer.current = window.setTimeout(() => { pendingOn.current = false; if (!dead.current) powerOn(); }, live.current.reduced ? 0 : 240);
      return;
    }
    // 上げた = 電源断(300ms)の直後に標準へ。すでに切れていれば何もしない
    if (!powered && !waitingOn) return;
    busy.current = true;
    timer.current = window.setTimeout(() => {
      void powerOff().then(() => {
        if (dead.current) return;
        // MilspecStyleToggle と同じ読み込み表示(重い切替なので)経由。チュートリアル中の見た目の差し替えは
        // setThemeStyle 内の resolveThemeStyle(themeTutorialSync と同じ判定)がそのまま担う
        runTransitionRef.current(() => useThemeStore.getState().setThemeStyle('standard'), 'theme');
        // 切替が実行されず軍事のままなら、固まらないよう電源を入れ直してレバーを下へ戻す(保険)
        timer.current = window.setTimeout(() => {
          busy.current = false;
          if (dead.current || useThemeStore.getState().themeStyle !== 'military') return;
          place(yDn);
          setOn(true);
          powerOn({ reduced: true });
        }, 1500);
      });
    }, live.current.reduced ? 0 : 240);
  };
  const settleRef = React.useRef(settle);
  settleRef.current = settle;

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
  // 上でも下でも同じ説明(押すと見た目が切り替わる)
  const label = t('app.theme_style_switch');
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
      <span className="milspec-mlv-rack is-l" />
      <span className="milspec-mlv-rack is-r" />
      <span className="milspec-mlv-slot"><span className="milspec-mlv-run" /></span>
      <span className="milspec-mlv-glass" />
      <span className="milspec-mlv-hzs" />
      <MilspecLed state={on ? 'on' : 'off'} size={6} />
      <span className="milspec-mlv-th" ref={thRef} />
    </button>
  );
}
