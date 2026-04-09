import { useEffect, useRef, useCallback } from 'react';

interface CustomCursorProps {
  portalHover: 'cyan' | 'amber' | null;
}

export function CustomCursor({ portalHover }: CustomCursorProps) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rippleContainerRef = useRef<HTMLDivElement>(null);

  // マウス位置とリングの遅延追従用
  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const animIdRef = useRef<number>(0);

  const createRipple = useCallback((x: number, y: number, color: string) => {
    const container = rippleContainerRef.current;
    if (!container) return;

    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 4px;
      height: 4px;
      border: 1.5px solid ${color};
      border-radius: 50%;
      pointer-events: none;
      transform: translate(-50%, -50%);
      z-index: 100001;
      opacity: 1;
    `;
    container.appendChild(ripple);

    // requestAnimationFrame で手動アニメーション
    const startTime = performance.now();
    const duration = 600;

    const animateRipple = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const size = 4 + eased * 76;
      const opacity = 1 - eased;

      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.opacity = String(opacity);

      if (progress < 1) {
        requestAnimationFrame(animateRipple);
      } else {
        ripple.remove();
      }
    };
    requestAnimationFrame(animateRipple);
  }, []);

  // portalHover に応じた色を返す
  const getColor = useCallback((hover: 'cyan' | 'amber' | null): string => {
    if (hover === 'amber') return 'var(--color-portal-amber)';
    return 'var(--color-portal-cyan)';
  }, []);

  useEffect(() => {
    // タッチデバイスでは完全無効
    if ('ontouchstart' in window) return;

    // ページ全体のカーソルを非表示
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { cursor: none !important; }';
    document.head.appendChild(style);

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      // ドットはマウスに即追従
      dot.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
    };

    const onMouseDown = () => {
      // ドット収縮
      dot.style.transition = 'transform 80ms ease-out, width 80ms, height 80ms';
      dot.style.width = '3px';
      dot.style.height = '3px';
    };

    const onMouseUp = () => {
      dot.style.width = '8px';
      dot.style.height = '8px';
    };

    const onClick = (e: MouseEvent) => {
      const color = getColor(portalHoverRef.current);
      createRipple(e.clientX, e.clientY, color);
    };

    // requestAnimationFrame でリングを遅延追従
    const animate = () => {
      const dx = mousePos.current.x - ringPos.current.x;
      const dy = mousePos.current.y - ringPos.current.y;
      ringPos.current.x += dx * 0.12;
      ringPos.current.y += dy * 0.12;

      const rx = ringPos.current.x;
      const ry = ringPos.current.y;
      ring.style.transform = `translate(${rx - 16}px, ${ry - 16}px)`;

      animIdRef.current = requestAnimationFrame(animate);
    };
    animIdRef.current = requestAnimationFrame(animate);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('click', onClick);

    return () => {
      style.remove();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('click', onClick);
      cancelAnimationFrame(animIdRef.current);
    };
  }, [createRipple, getColor]);

  // portalHover 変化を ref 経由でクリックハンドラに渡す（再 effect 不要）
  const portalHoverRef = useRef<'cyan' | 'amber' | null>(null);
  portalHoverRef.current = portalHover;

  // dot/ring の色・サイズを portalHover に応じて更新
  useEffect(() => {
    if ('ontouchstart' in window) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const color = getColor(portalHover);

    dot.style.backgroundColor = color;
    dot.style.boxShadow = `0 0 6px 2px ${color}`;

    ring.style.borderColor = color;
    ring.style.boxShadow = `0 0 8px 2px ${color}40`;

    if (portalHover !== null) {
      // ホバー時: リングを拡大
      ring.style.width = '40px';
      ring.style.height = '40px';
      ring.style.opacity = '1';
    } else {
      // 通常時
      ring.style.width = '32px';
      ring.style.height = '32px';
      ring.style.opacity = '0.7';
    }
  }, [portalHover, getColor]);

  // タッチデバイスはレンダリングしない
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  return (
    <>
      {/* サイバーカーソル: ドット */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[100003] rounded-full"
        style={{
          width: '8px',
          height: '8px',
          backgroundColor: 'var(--color-portal-cyan)',
          boxShadow: '0 0 6px 2px var(--color-portal-cyan)',
          transition: 'background-color 200ms ease, box-shadow 200ms ease, width 80ms ease, height 80ms ease',
          willChange: 'transform',
        }}
      />

      {/* サイバーカーソル: リング */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 pointer-events-none z-[100002] rounded-full"
        style={{
          width: '32px',
          height: '32px',
          border: '1.5px solid var(--color-portal-cyan)',
          boxShadow: '0 0 8px 2px rgba(0,212,255,0.25)',
          opacity: 0.7,
          transition: 'border-color 200ms ease, box-shadow 200ms ease, width 200ms ease, height 200ms ease, opacity 200ms ease',
          willChange: 'transform',
        }}
      />

      {/* リップルコンテナ */}
      <div ref={rippleContainerRef} className="pointer-events-none" />
    </>
  );
}
