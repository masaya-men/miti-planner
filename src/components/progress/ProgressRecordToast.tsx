/**
 * 記録トースト — 記録した瞬間にグラフ帯中央へホログラム演出で表示。
 * 演出（確定）: 走査線でホログラム起動 → 文字デコード解読 → 数字0からカウントアップ。
 * 約1.3秒立ち上がり → 4秒表示 → 明滅フェードアウト。光の玉(canvas)は後ろを通る(z下)。
 * モック: .superpowers/brainstorm/4302-1781796445/content/toast-combo-v4.html (seq)
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProgressRecording } from './useProgressRecording';

const GLYPHS = 'アカサタナハマヤラワン0123456789#%&@$<>/\\=+*';
const rnd = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
const HOLD = 4000;

export function ProgressRecordToast() {
  const { t } = useTranslation();
  const toast = useProgressRecording((s) => s.toast);
  const clearToast = useProgressRecording((s) => s.clearToast);
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const scanRef = useRef<HTMLSpanElement>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const my = ++tokenRef.current;
    const root = rootRef.current, textEl = textRef.current, scan = scanRef.current;
    if (!root || !textEl || !scan) return;

    // 文言を prefix + {n} + suffix に分割（{n} は数字カウント位置）
    const template = t(`progress.record_toast_${toast.kind}`);
    const [prefix, suffix = ''] = template.split('{n}');

    // span 構築: prefix を 1 文字ずつ + 数字 span + suffix
    textEl.innerHTML = '';
    const preSpans: HTMLSpanElement[] = [];
    [...prefix].forEach((ch) => {
      const s = document.createElement('span');
      s.style.display = 'inline-block';
      if (ch === ' ') s.style.width = '.4ch';
      s.dataset.f = ch; s.textContent = ch;
      textEl.appendChild(s); preSpans.push(s);
    });
    const numSpan = document.createElement('span');
    numSpan.className = 'font-black'; numSpan.style.color = '#bfe9ff';
    numSpan.textContent = '0'; textEl.appendChild(numSpan);
    const sufSpan = document.createElement('span');
    sufSpan.style.color = '#bfe9ff'; sufSpan.textContent = suffix; textEl.appendChild(sufSpan);

    // タイミング(seq)
    const holoDur = 780, decStart = 320, decDur = 700, numStart = 880, numDur = 560;
    const END = Math.max(decStart + decDur, numStart + numDur, holoDur) + 60;
    const target = toast.pct;

    // ホログラム明滅 + 走査線
    root.style.opacity = '1';
    root.animate(
      [{ opacity: 0 }, { opacity: .6, offset: .1 }, { opacity: .2, offset: .15 }, { opacity: .9, offset: .24 }, { opacity: .5, offset: .32 }, { opacity: 1 }],
      { duration: holoDur, easing: 'linear', fill: 'forwards' }
    );
    scan.style.opacity = '1';
    scan.animate(
      [{ top: '-2px', opacity: 0 }, { top: '0px', opacity: 1, offset: .12 }, { top: '44px', opacity: 1, offset: .88 }, { top: '46px', opacity: 0 }],
      { duration: holoDur, easing: 'ease-out', fill: 'forwards' }
    );

    const s0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (my !== tokenRef.current) return;
      const e = now - s0;
      const n = preSpans.length;
      preSpans.forEach((s, i) => {
        const f = s.dataset.f || '';
        const lockAt = decStart + (i / n) * decDur * 0.8 + 50;
        if (e < decStart) { s.style.opacity = '0'; }
        else if (e < lockAt) { s.style.opacity = '0.65'; if (f !== ' ') s.textContent = rnd(); }
        else { s.textContent = f; s.style.opacity = '1'; }
      });
      if (e < numStart) { numSpan.textContent = '0'; }
      else {
        const p = Math.min(1, (e - numStart) / numDur);
        const ez = 1 - Math.pow(1 - p, 3);
        numSpan.textContent = String(Math.round(target * ez));
        numSpan.style.textShadow = p < 1 ? '0 0 14px rgba(160,230,255,.95)' : '0 0 8px rgba(150,230,255,.6)';
      }
      if (e < END) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // 4秒後に明滅フェードアウト → store クリア
    const outTimer = setTimeout(() => {
      if (my !== tokenRef.current) return;
      const a = root.animate(
        [{ opacity: 1 }, { opacity: .3, offset: .3 }, { opacity: .65, offset: .5 }, { opacity: 0 }],
        { duration: 440, fill: 'forwards' }
      );
      a.onfinish = () => { if (my === tokenRef.current) clearToast(); };
    }, HOLD);

    return () => { cancelAnimationFrame(raf); clearTimeout(outTimer); };
  }, [toast, t, clearToast]);

  if (!toast) return null;
  return (
    <div
      ref={rootRef}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] pointer-events-none whitespace-nowrap font-extrabold text-app-base"
      style={{
        opacity: 0, color: '#dff4ff', letterSpacing: '.03em',
        textShadow: '0 0 10px rgba(150,230,255,.6), 0 1px 2px rgba(0,0,0,.9)',
        padding: '6px 16px', borderRadius: '999px',
        background: 'radial-gradient(ellipse at center, rgba(8,14,28,0.74) 0%, rgba(8,14,28,0.35) 60%, rgba(8,14,28,0) 100%)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span ref={textRef} />
      <span ref={scanRef} className="absolute left-0 right-0 pointer-events-none"
        style={{ height: '2px', top: 0, opacity: 0, background: 'linear-gradient(90deg, transparent, rgba(150,230,255,.95), transparent)', boxShadow: '0 0 10px rgba(150,230,255,.9)' }} />
    </div>
  );
}
