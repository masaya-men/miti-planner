import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';

// ブドウの粒配置（cx%, cy%, サイズ%, 明度）
// 上が狭く下が広い逆三角→ブドウは上が広く下が尖る
const GRAPES: Array<[number, number, number, number]> = [
  // 茎
  [50, 2, 4, 0.35],
  [50, 7, 5, 0.4],
  // 最上段（2粒）
  [42, 15, 14, 0.9],
  [58, 15, 14, 0.8],
  // 2段目（3粒）
  [32, 28, 15, 0.75],
  [50, 26, 15, 0.85],
  [68, 28, 15, 0.7],
  // 3段目（4粒 — 一番幅広）
  [24, 42, 14, 0.65],
  [40, 40, 15, 0.8],
  [56, 41, 15, 0.72],
  [72, 43, 14, 0.6],
  // 4段目（3粒）
  [32, 56, 14, 0.7],
  [50, 55, 15, 0.78],
  [66, 57, 14, 0.58],
  // 5段目（2粒）
  [40, 69, 13, 0.62],
  [58, 70, 13, 0.55],
  // 先端（1粒）
  [50, 82, 12, 0.5],
];

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const grapeRef = useRef<HTMLDivElement>(null);
  const rippleContainerRef = useRef<HTMLDivElement>(null);
  const isHoveringRef = useRef(false);

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
    document.body.style.cursor = 'none';

    const dot = dotRef.current;
    const grape = grapeRef.current;
    if (!dot || !grape) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let gX = mouseX;
    let gY = mouseY;
    let velX = 0;
    let velY = 0;
    let rotZ = 20;

    const moveCursor = (e: MouseEvent) => {
      gsap.set(dot, { x: e.clientX - 4, y: e.clientY - 4 });
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleClick = (e: MouseEvent) => {
      createRipple(e.clientX, e.clientY);
    };

    const handleHoverIn = () => {
      isHoveringRef.current = true;
      dot.style.display = 'none';
      document.body.style.cursor = 'pointer';
    };
    const handleHoverOut = () => {
      isHoveringRef.current = false;
      dot.style.display = '';
      document.body.style.cursor = 'none';
    };

    const addHoverListeners = () => {
      const els = document.querySelectorAll('a, button, [data-hover], [role="button"]');
      els.forEach(el => {
        el.addEventListener('mouseenter', handleHoverIn);
        el.addEventListener('mouseleave', handleHoverOut);
      });
      return els;
    };
    let hoverables = addHoverListeners();

    const observer = new MutationObserver(() => {
      hoverables.forEach(el => {
        el.removeEventListener('mouseenter', handleHoverIn);
        el.removeEventListener('mouseleave', handleHoverOut);
      });
      hoverables = addHoverListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('click', handleClick);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const spring = 0.035;
      const damping = 0.88;
      velX = (velX + (mouseX - gX) * spring) * damping;
      velY = (velY + (mouseY - gY) * spring) * damping;
      gX += velX;
      gY += velY;

      const targetRot = 20 - velX * 0.8;
      rotZ += (targetRot - rotZ) * 0.1;

      grape.style.transform = `translate(${gX}px, ${gY}px) translate(-50%, -50%) rotate(${rotZ}deg)`;
    };
    animId = requestAnimationFrame(animate);

    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animId);
      observer.disconnect();
      hoverables.forEach(el => {
        el.removeEventListener('mouseenter', handleHoverIn);
        el.removeEventListener('mouseleave', handleHoverOut);
      });
    };
  }, [createRipple]);

  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  return (
    <>
      <div
        ref={grapeRef}
        className="fixed pointer-events-none z-[100002]"
        style={{
          width: 160,
          height: 200,
          left: 0,
          top: 0,
          mixBlendMode: 'difference',
          willChange: 'transform',
        }}
      >
        {GRAPES.map(([cx, cy, size, opacity], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${cx}%`,
              top: `${cy}%`,
              width: `${size}%`,
              height: `${size}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: `rgba(255, 255, 255, ${opacity})`,
              // 各粒にハイライト（左上に薄い光沢）
              backgroundImage: i >= 2
                ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,${opacity * 0.3}) 0%, transparent 60%)`
                : undefined,
            }}
          />
        ))}
      </div>

      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-2 h-2 bg-white rounded-full pointer-events-none z-[100003] mix-blend-difference"
      />

      <div ref={rippleContainerRef} className="pointer-events-none" />
    </>
  );
}
