import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';

// 六角形の頂点を生成（cx, cy, r, 回転角deg）
function hex(cx: number, cy: number, r: number, rot = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2 + (rot * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// ブドウ粒の配置: [cx, cy, size, rotation]
const BERRIES: Array<[number, number, number, number]> = [
  // 上段（2粒）
  [42, 38, 10, 0],
  [58, 38, 10, 15],
  // 2段目（3粒）
  [34, 52, 10, 5],
  [50, 50, 11, 0],
  [66, 52, 10, 10],
  // 3段目（3粒）
  [36, 66, 10, 8],
  [52, 65, 10, 0],
  [66, 67, 9, 12],
  // 4段目（2粒）
  [42, 78, 9, 5],
  [56, 79, 9, 0],
  // 先端（1粒）
  [48, 90, 8, 10],
];

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const grapeRef = useRef<HTMLDivElement>(null);
  const rippleContainerRef = useRef<HTMLDivElement>(null);

  const createRipple = useCallback((x: number, y: number) => {
    const container = rippleContainerRef.current;
    if (!container) return;
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px;
      width: 0; height: 0;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 50%; pointer-events: none;
      transform: translate(-50%, -50%); z-index: 100001;
    `;
    container.appendChild(ripple);
    gsap.to(ripple, {
      width: 80, height: 80, opacity: 0,
      duration: 0.6, ease: 'power2.out',
      onComplete: () => ripple.remove(),
    });
  }, []);

  useEffect(() => {
    if ('ontouchstart' in window) return;

    // ページ全体のカーソルを強制的に非表示（button等のpointerも含む）
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { cursor: none !important; }';
    document.head.appendChild(style);

    const dot = dotRef.current;
    const ring = ringRef.current;
    const grape = grapeRef.current;
    if (!dot || !grape) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let gX = mouseX, gY = mouseY;
    let velX = 0, velY = 0, rotZ = 20;

    const moveCursor = (e: MouseEvent) => {
      gsap.set(dot, { x: e.clientX - 4, y: e.clientY - 4 });
      if (ring) gsap.to(ring, { x: e.clientX - 16, y: e.clientY - 16, duration: 0.15, ease: 'power2.out' });
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const handleClick = (e: MouseEvent) => { createRipple(e.clientX, e.clientY); };
    const handleHoverIn = (e: Event) => {
      if (dot) dot.style.display = 'none';
      if (ring) ring.style.display = '';
      (e.currentTarget as HTMLElement).style.cursor = 'none';
    };
    const handleHoverOut = () => {
      if (dot) dot.style.display = '';
      if (ring) ring.style.display = 'none';
    };

    const addHoverListeners = () => {
      const els = document.querySelectorAll('a, button, [data-hover], [role="button"]');
      els.forEach(el => { el.addEventListener('mouseenter', handleHoverIn); el.addEventListener('mouseleave', handleHoverOut); });
      return els;
    };
    let hoverables = addHoverListeners();
    const observer = new MutationObserver(() => {
      hoverables.forEach(el => { el.removeEventListener('mouseenter', handleHoverIn); el.removeEventListener('mouseleave', handleHoverOut); });
      hoverables = addHoverListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('click', handleClick);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      velX = (velX + (mouseX - gX) * 0.035) * 0.88;
      velY = (velY + (mouseY - gY) * 0.035) * 0.88;
      gX += velX; gY += velY;
      rotZ += ((20 - velX * 0.8) - rotZ) * 0.1;
      grape.style.transform = `translate(${gX}px, ${gY}px) translate(-50%, -50%) rotate(${rotZ}deg)`;
    };
    animId = requestAnimationFrame(animate);

    return () => {
      style.remove();
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animId);
      observer.disconnect();
      hoverables.forEach(el => { el.removeEventListener('mouseenter', handleHoverIn); el.removeEventListener('mouseleave', handleHoverOut); });
    };
  }, [createRipple]);

  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  return (
    <>
      <div ref={grapeRef} className="fixed pointer-events-none z-[100002]"
        style={{ width: 200, height: 260, left: 0, top: 0, mixBlendMode: 'difference', willChange: 'transform' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* === 茎 === */}
          <line x1="50" y1="28" x2="46" y2="8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="50" y1="28" x2="56" y2="10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="46" y1="8" x2="40" y2="3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="56" y1="10" x2="62" y2="5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          {/* === 葉 === Bパターン: 白塗り + 黒線 */}
          <polygon points="40,3 22,8 18,20 28,26 38,18"
            stroke="white" strokeWidth="1.2" fill="rgba(255,255,255,0.7)" strokeLinejoin="miter" />
          <line x1="40" y1="3" x2="26" y2="18" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
          <line x1="28" y1="10" x2="24" y2="20" stroke="rgba(0,0,0,0.2)" strokeWidth="0.4" />
          <polygon points="62,5 78,8 80,18 72,24 64,16"
            stroke="white" strokeWidth="1.2" fill="rgba(255,255,255,0.7)" strokeLinejoin="miter" />
          <line x1="62" y1="5" x2="74" y2="16" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
          <line x1="72" y1="10" x2="76" y2="18" stroke="rgba(0,0,0,0.2)" strokeWidth="0.4" />
          {/* === ブドウ粒 === Bパターン: 白塗り85% + 黒線 */}
          {BERRIES.map(([cx, cy, r, rot], i) => (
            <g key={i}>
              <polygon points={hex(cx, cy, r, rot)}
                stroke="rgba(0,0,0,0.8)" strokeWidth={1.2}
                fill="rgba(255,255,255,0.85)" strokeLinejoin="miter" />
              {[0, 2, 4].map(j => {
                const a = (Math.PI / 3) * j - Math.PI / 2 + (rot * Math.PI) / 180;
                return <line key={j} x1={cx} y1={cy}
                  x2={(cx + r * Math.cos(a)).toFixed(1)} y2={(cy + r * Math.sin(a)).toFixed(1)}
                  stroke="rgba(0,0,0,0.3)" strokeWidth="0.4" />;
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* 通常時: ドット */}
      <div ref={dotRef} className="fixed top-0 left-0 w-2 h-2 bg-white rounded-full pointer-events-none z-[100003] mix-blend-difference" />
      {/* ホバー時: リング（初期非表示） */}
      <div ref={ringRef} className="fixed top-0 left-0 w-8 h-8 border border-white/60 rounded-full pointer-events-none z-[100003] mix-blend-difference" style={{ display: 'none' }} />
      <div ref={rippleContainerRef} className="pointer-events-none" />
    </>
  );
}
