import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rippleContainerRef = useRef<HTMLDivElement>(null);

  // クリック時のリップルエフェクト
  const createRipple = useCallback((x: number, y: number) => {
    const container = rippleContainerRef.current;
    if (!container) return;

    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      pointer-events: none;
      transform: translate(-50%, -50%);
      z-index: 100001;
    `;
    container.appendChild(ripple);

    gsap.to(ripple, {
      width: 80,
      height: 80,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => ripple.remove(),
    });
  }, []);

  useEffect(() => {
    // タッチデバイスではスキップ
    if ('ontouchstart' in window) return;

    document.body.style.cursor = 'none';

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const moveCursor = (e: MouseEvent) => {
      gsap.set(dot, { x: e.clientX - 4, y: e.clientY - 4 });
      gsap.to(ring, { x: e.clientX - 20, y: e.clientY - 20, duration: 0.15, ease: 'power2.out' });
    };

    const handleHoverIn = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      gsap.to(ring, { scale: 1.8, opacity: 0.4, duration: 0.3 });
      gsap.to(dot, { scale: 0.5, duration: 0.3 });

      // 磁石効果 — カーソルが要素の中心に軽く引き寄せられる
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      gsap.to(ring, {
        x: centerX - 20,
        y: centerY - 20,
        duration: 0.4,
        ease: 'power3.out',
      });
    };

    const handleHoverOut = () => {
      gsap.to(ring, { scale: 1, opacity: 1, duration: 0.3 });
      gsap.to(dot, { scale: 1, duration: 0.3 });
    };

    const handleClick = (e: MouseEvent) => {
      createRipple(e.clientX, e.clientY);
      // ドットの「パルス」
      gsap.fromTo(dot, { scale: 2 }, { scale: 1, duration: 0.3, ease: 'power2.out' });
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('click', handleClick);

    // MutationObserverでホバー要素を動的に監視
    const addHoverListeners = () => {
      const hoverables = document.querySelectorAll('a, button, [data-hover]');
      hoverables.forEach(el => {
        el.addEventListener('mouseenter', handleHoverIn);
        el.addEventListener('mouseleave', handleHoverOut);
      });
      return hoverables;
    };

    let hoverables = addHoverListeners();

    const observer = new MutationObserver(() => {
      // DOM変更時にリスナーを再設定
      hoverables.forEach(el => {
        el.removeEventListener('mouseenter', handleHoverIn);
        el.removeEventListener('mouseleave', handleHoverOut);
      });
      hoverables = addHoverListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('click', handleClick);
      observer.disconnect();
      hoverables.forEach(el => {
        el.removeEventListener('mouseenter', handleHoverIn);
        el.removeEventListener('mouseleave', handleHoverOut);
      });
    };
  }, [createRipple]);

  // タッチデバイスではレンダリングしない
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  return (
    <>
      <div ref={dotRef} className="fixed top-0 left-0 w-2 h-2 bg-white rounded-full pointer-events-none z-[100001] mix-blend-difference" />
      <div ref={ringRef} className="fixed top-0 left-0 w-10 h-10 border border-white/40 rounded-full pointer-events-none z-[100001] mix-blend-difference" />
      <div ref={rippleContainerRef} className="pointer-events-none" />
    </>
  );
}
