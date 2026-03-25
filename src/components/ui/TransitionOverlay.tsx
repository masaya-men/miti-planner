import React, { useCallback, useRef } from 'react';

export type TransitionVariant = 'theme' | 'language' | 'plan' | 'default';

const ANIM_LEAD_TIME = 500;
const SETTLE_DELAY = 400;
const FADE_OUT_DURATION = 250;

// ─────────────────────────────────────────────
// CSS（一度だけ注入。transform/opacity のみ → GPU 60fps）
// ─────────────────────────────────────────────

const STYLE_ID = 'transition-overlay-styles';

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
/* ── 共通 ── */
.t-overlay {
  position:fixed; inset:0; z-index:99999;
  display:flex; align-items:center; justify-content:center; flex-direction:column; gap:14px;
  pointer-events:auto; opacity:1;
}
.t-overlay.fading { opacity:0; transition:opacity ${FADE_OUT_DURATION}ms ease; }
.t-label { font-size:11px; font-weight:800; letter-spacing:0.12em; opacity:0.5; color:var(--color-app-text,#fff); }
.t-dot { will-change:opacity; animation: t-dot-in 1.8s ease-in-out infinite; opacity:0; }
.t-d1 { animation-delay:0s; }
.t-d2 { animation-delay:.15s; }
.t-d3 { animation-delay:.3s; }
.t-d4 { animation-delay:.45s; }
.t-d5 { animation-delay:.6s; }
.t-d6 { animation-delay:.75s; }
@keyframes t-dot-in {
  0%   { opacity:0; }
  16%  { opacity:1; }
  60%  { opacity:1; }
  80%  { opacity:0; }
  100% { opacity:0; }
}

/* ═══════ テーマ: ローラー（シンプル上下） ═══════ */
.t-roller-stage { position:relative; width:56px; height:64px; }
.t-roller-arm {
  position:absolute; left:4px; top:0; width:48px; height:48px;
  will-change:transform;
  animation: t-roller 1.4s ease-in-out infinite;
}
@keyframes t-roller {
  0%   { transform: translateY(-10px); }
  50%  { transform: translateY(14px); }
  100% { transform: translateY(-10px); }
}
/* ペンキの滴（ローラーの左右から垂れる） */
.t-drip {
  position:absolute; border-radius:50%; background:var(--color-app-text,#fff);
  will-change:transform,opacity;
}
.t-drip-1 { left:12px; top:44px; width:4px; height:4px; animation:t-drip-a 1s ease-in infinite; }
.t-drip-2 { left:38px; top:46px; width:3px; height:3px; animation:t-drip-b 1s ease-in .35s infinite; }
.t-drip-3 { left:25px; top:48px; width:3px; height:3px; animation:t-drip-a 1s ease-in .65s infinite; }
@keyframes t-drip-a {
  0%   { transform:translateY(0) scaleY(1) scaleX(1); opacity:.4; }
  40%  { transform:translateY(6px) scaleY(1.4) scaleX(.7); opacity:.25; }
  100% { transform:translateY(22px) scaleY(.6) scaleX(.3); opacity:0; }
}
@keyframes t-drip-b {
  0%   { transform:translateY(0) scale(1); opacity:.35; }
  100% { transform:translateY(20px) scale(.15); opacity:0; }
}

/* ═══════ 言語: 鉛筆 ═══════ */
.t-pencil-stage { position:relative; width:60px; height:52px; }
.t-pencil-body {
  position:absolute; left:0; top:0; width:48px; height:48px;
  will-change:transform;
  animation: t-pencil .5s ease-in-out infinite;
  transform-origin:16px 36px;
}
@keyframes t-pencil {
  0%   { transform:translate(-4px,2px) rotate(-4deg); }
  25%  { transform:translate(5px,-2px) rotate(4deg); }
  50%  { transform:translate(-3px,3px) rotate(-2deg); }
  75%  { transform:translate(5px,-1px) rotate(3deg); }
  100% { transform:translate(-4px,2px) rotate(-4deg); }
}
/* 鉛筆の先端の火花（書いてる感） */
.t-spark {
  position:absolute; left:8px; top:34px; width:3px; height:3px;
  border-radius:50%; background:var(--color-app-text,#fff);
  will-change:transform,opacity;
  animation: t-spark .25s ease-out infinite alternate;
}
@keyframes t-spark {
  0%   { transform:scale(0.5) translate(0,0); opacity:.6; }
  100% { transform:scale(1.2) translate(2px,-2px); opacity:0; }
}
/* テキスト行（タイプライター風に左から出現） */
.t-tline {
  position:absolute; height:2.5px; border-radius:1px;
  background:var(--color-app-text,#fff); transform-origin:left center;
  will-change:transform,opacity;
}
.t-tline-1 { right:0; top:14px; width:24px; animation:t-type1 1.2s ease-in-out infinite; }
.t-tline-2 { right:0; top:22px; width:24px; animation:t-type2 1.2s ease-in-out .2s infinite; }
.t-tline-3 { right:0; top:30px; width:24px; animation:t-type3 1.2s ease-in-out .4s infinite; }
@keyframes t-type1 {
  0%,100% { transform:scaleX(1); opacity:.3; }
  30%     { transform:scaleX(.1); opacity:.04; }
  60%     { transform:scaleX(1.1); opacity:.35; }
}
@keyframes t-type2 {
  0%,100% { transform:scaleX(.7); opacity:.2; }
  30%     { transform:scaleX(.05); opacity:.03; }
  60%     { transform:scaleX(.9); opacity:.28; }
}
@keyframes t-type3 {
  0%,100% { transform:scaleX(.85); opacity:.18; }
  30%     { transform:scaleX(.08); opacity:.02; }
  60%     { transform:scaleX(1); opacity:.25; }
}
/* 消しカス（鉛筆から飛ぶ小さな粒） */
.t-eraser-bit {
  position:absolute; border-radius:50%; background:var(--color-app-text,#fff);
  will-change:transform,opacity;
}
.t-eraser-1 { left:14px; top:32px; width:2px; height:2px; animation:t-erase .6s ease-out infinite; }
.t-eraser-2 { left:16px; top:34px; width:1.5px; height:1.5px; animation:t-erase .6s ease-out .15s infinite; }
.t-eraser-3 { left:12px; top:36px; width:2px; height:2px; animation:t-erase .6s ease-out .3s infinite; }
@keyframes t-erase {
  0%   { transform:translate(0,0) scale(1); opacity:.3; }
  100% { transform:translate(var(--ex,6px),var(--ey,-10px)) scale(0); opacity:0; }
}

/* ═══════ プラン: ページめくり ═══════ */
.t-pages-stage { position:relative; width:52px; height:56px; perspective:120px; }
.t-pg { position:absolute; border-radius:2px; background:var(--color-app-text,#fff); }
.t-pg-3 { left:10px; top:0; width:32px; height:44px; opacity:.06; }
.t-pg-2 { right:7px; top:2px; width:32px; height:44px; opacity:.12; will-change:transform; animation:t-pg2 1.4s ease-in-out .15s infinite; transform-origin:right center; }
.t-pg-1 {
  right:4px; top:4px; width:32px; height:44px; opacity:.3;
  transform-origin:right center; will-change:transform;
  animation:t-pg1 1.4s ease-in-out infinite;
}
@keyframes t-pg1 {
  0%   { transform:rotateY(0); }
  30%  { transform:rotateY(85deg); }
  60%  { transform:rotateY(85deg); }
  100% { transform:rotateY(0); }
}
@keyframes t-pg2 {
  0%   { transform:rotateY(0); }
  40%  { transform:rotateY(40deg); }
  70%  { transform:rotateY(40deg); }
  100% { transform:rotateY(0); }
}
/* ページから飛ぶ文字の粒 */
.t-char-bit {
  position:absolute; width:3px; height:3px; border-radius:1px;
  background:var(--color-app-text,#fff);
  will-change:transform,opacity;
}
.t-char-1 { left:20px; top:20px; animation:t-char 1.4s ease-out .2s infinite; }
.t-char-2 { left:24px; top:28px; animation:t-char 1.4s ease-out .5s infinite; }
.t-char-3 { left:18px; top:36px; animation:t-char 1.4s ease-out .8s infinite; }
@keyframes t-char {
  0%   { transform:translate(0,0) scale(1) rotate(0deg); opacity:0; }
  10%  { transform:translate(2px,-2px) scale(1); opacity:.25; }
  100% { transform:translate(20px,-16px) scale(0) rotate(40deg); opacity:0; }
}

/* ═══════ デフォルト ═══════ */
.t-spinner {
  width:20px; height:20px; border-radius:50%;
  border:2px solid transparent; border-top-color:var(--color-app-text,#fff);
  will-change:transform; animation:t-spin .7s linear infinite;
}
@keyframes t-spin { to { transform:rotate(360deg); } }
`;
    document.head.appendChild(s);
}

// ─────────────────────────────────────────────
// HTML生成
// ─────────────────────────────────────────────

function createThemeContent(): string {
    return `
<div class="t-roller-stage">
  <div class="t-roller-arm">
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style="display:block;margin:auto;">
      <rect x="8" y="4" width="32" height="12" rx="6" fill="var(--color-app-text,#fff)" opacity="0.9"/>
      <line x1="16" y1="7" x2="16" y2="13" stroke="var(--color-app-bg,#000)" stroke-width="1" opacity="0.2"/>
      <line x1="24" y1="7" x2="24" y2="13" stroke="var(--color-app-bg,#000)" stroke-width="1" opacity="0.2"/>
      <line x1="32" y1="7" x2="32" y2="13" stroke="var(--color-app-bg,#000)" stroke-width="1" opacity="0.2"/>
      <rect x="22" y="16" width="4" height="12" rx="1.5" fill="var(--color-app-text,#fff)" opacity="0.45"/>
      <rect x="19" y="28" width="10" height="4" rx="2" fill="var(--color-app-text,#fff)" opacity="0.3"/>
    </svg>
  </div>
  <div class="t-drip t-drip-1"></div>
  <div class="t-drip t-drip-2"></div>
  <div class="t-drip t-drip-3"></div>
</div>
<span class="t-label">PAINTING<span class="t-dot t-d1">.</span><span class="t-dot t-d2">.</span><span class="t-dot t-d3">.</span><span class="t-dot t-d4">.</span><span class="t-dot t-d5">.</span><span class="t-dot t-d6">.</span></span>`;
}

function createLanguageContent(): string {
    return `
<div class="t-pencil-stage">
  <svg class="t-pencil-body" width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="13" y="4" width="6" height="28" rx="1.5" fill="var(--color-app-text,#fff)" opacity="0.85" transform="rotate(-25 16 18)"/>
    <polygon points="12,32 18,32 15,38" fill="var(--color-app-text,#fff)" opacity="0.95" transform="rotate(-25 16 18)"/>
    <rect x="13" y="1" width="6" height="4" rx="1.5" fill="var(--color-app-text,#fff)" opacity="0.4" transform="rotate(-25 16 18)"/>
  </svg>
  <div class="t-spark"></div>
  <div class="t-tline t-tline-1"></div>
  <div class="t-tline t-tline-2"></div>
  <div class="t-tline t-tline-3"></div>
  <div class="t-eraser-bit t-eraser-1" style="--ex:8px;--ey:-12px;"></div>
  <div class="t-eraser-bit t-eraser-2" style="--ex:-4px;--ey:-8px;"></div>
  <div class="t-eraser-bit t-eraser-3" style="--ex:6px;--ey:-14px;"></div>
</div>
<span class="t-label">REWRITING<span class="t-dot t-d1">.</span><span class="t-dot t-d2">.</span><span class="t-dot t-d3">.</span><span class="t-dot t-d4">.</span><span class="t-dot t-d5">.</span><span class="t-dot t-d6">.</span></span>`;
}

function createPlanContent(): string {
    return `
<div class="t-pages-stage">
  <div class="t-pg t-pg-3"></div>
  <div class="t-pg t-pg-2"></div>
  <div class="t-pg t-pg-1"></div>
  <div class="t-char-bit t-char-1"></div>
  <div class="t-char-bit t-char-2"></div>
  <div class="t-char-bit t-char-3"></div>
</div>
<span class="t-label">LOADING<span class="t-dot t-d1">.</span><span class="t-dot t-d2">.</span><span class="t-dot t-d3">.</span><span class="t-dot t-d4">.</span><span class="t-dot t-d5">.</span><span class="t-dot t-d6">.</span></span>`;
}

function createDefaultContent(): string {
    return `<div class="t-spinner"></div>`;
}

const CONTENT_CREATORS: Record<TransitionVariant, () => string> = {
    theme: createThemeContent,
    language: createLanguageContent,
    plan: createPlanContent,
    default: createDefaultContent,
};

// ─────────────────────────────────────────────
// DOM操作（React完全バイパス）
// ─────────────────────────────────────────────

function showOverlay(variant: TransitionVariant): HTMLDivElement {
    ensureStyles();
    const overlay = document.createElement('div');
    overlay.className = 't-overlay';
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-app-bg').trim() || '#000';
    overlay.style.backgroundColor = bgColor;
    overlay.innerHTML = CONTENT_CREATORS[variant]();
    document.body.appendChild(overlay);
    return overlay;
}

function hideOverlay(overlay: HTMLDivElement): Promise<void> {
    return new Promise(resolve => {
        overlay.classList.add('fading');
        setTimeout(() => { overlay.remove(); resolve(); }, FADE_OUT_DURATION);
    });
}

// ─────────────────────────────────────────────
// React Context
// ─────────────────────────────────────────────

interface TransitionContextValue {
    runTransition: (callback: () => void | Promise<void>, variant?: TransitionVariant) => void;
}

const TransitionContext = React.createContext<TransitionContextValue | null>(null);

export function useTransitionOverlay() {
    const ctx = React.useContext(TransitionContext);
    if (!ctx) throw new Error('useTransitionOverlay must be used within TransitionOverlayProvider');
    return ctx;
}

export const TransitionOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const lockRef = useRef(false);

    const runTransition = useCallback((callback: () => void | Promise<void>, v: TransitionVariant = 'default') => {
        if (lockRef.current) return;
        lockRef.current = true;

        const overlay = showOverlay(v);

        // ① アニメーションを滑らかに見せる
        setTimeout(async () => {
            // ② コールバック実行（重い処理）
            try {
                await callback();
            } catch (e) {
                console.error('Transition callback error:', e);
            }

            // ③ 処理後に背景色を再取得（テーマ切替で色が変わるため）
            const newBg = getComputedStyle(document.documentElement).getPropertyValue('--color-app-bg').trim() || '#000';
            overlay.style.backgroundColor = newBg;

            // ④ 再描画安定後にフェードアウト
            setTimeout(async () => {
                await hideOverlay(overlay);
                lockRef.current = false;
            }, SETTLE_DELAY);
        }, ANIM_LEAD_TIME);
    }, []);

    return (
        <TransitionContext.Provider value={{ runTransition }}>
            {children}
        </TransitionContext.Provider>
    );
};
