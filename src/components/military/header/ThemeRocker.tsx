import React from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import './milspecH4.css';
import './ThemeRocker.css';

// H4 DSP 縦ロッカー(見本 js:1083-1089)。上 = 昼 / 下 = 夜。親は「ヘッダー区画」(absolute の座標系)。
// 押すと走査線(div.milspec-wipe)が画面を流れ、360ms 後に切り替える。reduced なら即時。

const SUN = <svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="1.5" /><path d="M4 .6v1M4 6.4v1M.6 4h1M6.4 4h1M1.6 1.6l.7.7M5.7 5.7l.7.7M6.4 1.6l-.7.7M2.3 5.7l-.7.7" /></svg>;
const MOON = <svg viewBox="0 0 8 8"><path d="M6.6 5A3 3 0 0 1 3 1.4a3 3 0 1 0 3.6 3.6z" /></svg>;

/** 走査線を body 直下に出して流し、終わったら消す(見本 css:616-617 / js:1087 の値) */
function playWipe(): void {
  const el = document.createElement('div');
  el.className = 'milspec-wipe';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  const H = window.innerHeight;
  if (typeof el.animate === 'function') {
    el.animate(
      [{ transform: 'translateY(-90px)', opacity: 1 }, { transform: `translateY(${H}px)`, opacity: 1 }],
      { duration: 620, delay: 120, easing: 'cubic-bezier(.45,0,.3,1)' },
    );
  }
  // 終了イベントに頼らず、遅延 + 長さ + 余裕で確実に消す
  window.setTimeout(() => el.remove(), 120 + 620 + 100);
}

export interface ThemeRockerProps {
  theme: 'dark' | 'light';
  /** setTheme を直接呼ぶ関数(runTransition は使わない) */
  onToggle: () => void;
  style?: React.CSSProperties;
}

export function ThemeRocker({ theme, onToggle, style }: ThemeRockerProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  // 見本どおり押した瞬間にレバーは倒れる(テーマの実切替は 360ms 後)。prop が変わったら追従
  const [v, setV] = React.useState<'day' | 'night'>(theme === 'dark' ? 'night' : 'day');
  React.useEffect(() => { setV(theme === 'dark' ? 'night' : 'day'); }, [theme]);
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = () => {
    setV((x) => (x === 'night' ? 'day' : 'night'));
    if (reduced) { onToggle(); return; }
    playWipe();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onToggle, 360);
  };

  const label = t('app.fab_theme');
  return (
    <button type="button" className="milspec-vr" data-v={v} aria-label={label} title={label} onClick={onClick} style={style}>
      <span className="milspec-vr-bz" />
      <span className="milspec-vr-well">
        <span className="milspec-vr-k is-t"><i className="milspec-vr-end" /><i className="milspec-vr-face">{SUN}</i></span>
        <span className="milspec-vr-k is-b"><i className="milspec-vr-end" /><i className="milspec-vr-face">{MOON}</i></span>
      </span>
    </button>
  );
}
