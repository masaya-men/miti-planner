import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

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

    const handleHoverIn = () => {
      gsap.to(ring, { scale: 1.8, opacity: 0.5, duration: 0.3 });
      gsap.to(dot, { scale: 0.5, duration: 0.3 });
    };

    const handleHoverOut = () => {
      gsap.to(ring, { scale: 1, opacity: 1, duration: 0.3 });
      gsap.to(dot, { scale: 1, duration: 0.3 });
    };

    window.addEventListener('mousemove', moveCursor);

    // ホバー可能な要素を監視
    const hoverables = document.querySelectorAll('a, button, [data-hover]');
    hoverables.forEach(el => {
      el.addEventListener('mouseenter', handleHoverIn);
      el.addEventListener('mouseleave', handleHoverOut);
    });

    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', moveCursor);
      hoverables.forEach(el => {
        el.removeEventListener('mouseenter', handleHoverIn);
        el.removeEventListener('mouseleave', handleHoverOut);
      });
    };
  }, []);

  // タッチデバイスではレンダリングしない
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  return (
    <>
      <div ref={dotRef} className="fixed top-0 left-0 w-2 h-2 bg-white rounded-full pointer-events-none z-[100001] mix-blend-difference" />
      <div ref={ringRef} className="fixed top-0 left-0 w-10 h-10 border border-white/50 rounded-full pointer-events-none z-[100001] mix-blend-difference" />
    </>
  );
}
