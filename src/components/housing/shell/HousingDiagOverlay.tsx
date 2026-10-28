import { useEffect, useState } from 'react';
import './HousingDiagOverlay.css';

const STORAGE_KEY = 'lopo_housing_diag';

/** URL の ?diag=1 で有効化 / ?diag=0 で無効化 (localStorage に残すので、ずれが出た時点で既に表示されている)。 */
function readDiagEnabled(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get('diag');
    if (param === '1') localStorage.setItem(STORAGE_KEY, '1');
    if (param === '0') localStorage.removeItem(STORAGE_KEY);
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function snapshot(): string {
  const vv = window.visualViewport;
  const shell = document.querySelector('.housing-shell')?.getBoundingClientRect();
  const se = document.scrollingElement;
  return [
    `path ${window.location.pathname}`,
    `scrollY ${Math.round(window.scrollY)} / doc ${se ? Math.round(se.scrollTop) : '-'} / body ${Math.round(document.body.scrollTop)}`,
    `inner ${window.innerHeight} / docH ${se ? se.scrollHeight : '-'}`,
    `vv h ${vv ? Math.round(vv.height) : '-'} top ${vv ? Math.round(vv.offsetTop) : '-'} scale ${vv ? vv.scale.toFixed(2) : '-'}`,
    `shell top ${shell ? Math.round(shell.top) : '-'} h ${shell ? Math.round(shell.height) : '-'}`,
    `restore ${'scrollRestoration' in history ? history.scrollRestoration : '-'}`,
  ].join('\n');
}

/**
 * iPhone Safari の「トップで画面が上にずれる」不具合の証拠取り用の隠し表示 (2026-10-22)。
 * 普段は描画しない。有効時は画面左下に数値を出し、タップで一時的に隠せる。原因確定後に撤去する。
 */
export const HousingDiagOverlay: React.FC = () => {
  const [enabled] = useState(readDiagEnabled);
  const [hidden, setHidden] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setText(snapshot());
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [enabled]);

  if (!enabled || hidden) return null;
  return (
    <button type="button" className="housing-diag-overlay" onClick={() => setHidden(true)}>
      {text}
    </button>
  );
};
