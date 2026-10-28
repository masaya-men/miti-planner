import { useRef } from 'react';
import { zoomAt, type MapView } from '../../../lib/housing/mapZoom';

// パン(1本指/ドラッグ) + ピンチ(2本指)。pointer events で PC/タッチ統一。
export function useTourMapPointerGestures(
  wrapRef: React.RefObject<HTMLDivElement | null>,
  view: MapView,
  setView: React.Dispatch<React.SetStateAction<MapView>>,
  endIntro: () => void,
) {
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pan = useRef<{ sx: number; sy: number; tx0: number; ty0: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const localXY = (clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    endIntro(); // 演出中の操作は即中断(操作優先)
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      pan.current = { sx: e.clientX, sy: e.clientY, tx0: view.tx, ty0: view.ty };
      pinch.current = null;
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      pan.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = localXY((a.x + b.x) / 2, (a.y + b.y) / 2);
      const base = pinch.current;
      setView((v) => zoomAt(v, mid.x, mid.y, base.scale * (dist / base.dist)));
    } else if (pan.current) {
      const p = pan.current;
      setView((v) => ({ ...v, tx: p.tx0 + (e.clientX - p.sx), ty: p.ty0 + (e.clientY - p.sy) }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 1) {
      // ピンチ→単指: 残った指でパンを継続できるよう、その指の現在位置から pan を再初期化。
      const [rem] = [...ptrs.current.values()];
      pan.current = { sx: rem.x, sy: rem.y, tx0: view.tx, ty0: view.ty };
    }
    if (ptrs.current.size === 0) pan.current = null;
  };
  return { onPointerDown, onPointerMove, onPointerUp };
}
