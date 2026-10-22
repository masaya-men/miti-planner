import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { armorSVG } from './armor/svg';
import { ensureDefs } from './armor/defs';
import { readPalette } from './armor/palette';
import { stretchPlaced } from './armor/stretch';
import { useHtmlClassTick } from './armor/useHtmlClassTick';
import type { PlacedPanel, StretchFrame } from './armor/types';


interface Props { id: string; frame: StretchFrame; panels: PlacedPanel[]; className?: string }

/** 区画(親は position:relative 前提)の全面に、金属パネルの SVG を重ねて描く */
export function MilspecArmor({ id, frame, panels, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // 中身が同じなら描き直さない(親が毎回新しい配列を渡しても innerHTML を入れ替えない)
  const contentKey = useMemo(() => JSON.stringify([frame, panels]), [frame, panels]);
  const latest = useRef({ frame, panels });
  latest.current = { frame, panels };
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // 親の実寸を監視
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const en = entries[0];
      if (!en) return;
      // inset:0 と同じ基準にそろえるため border-box を優先する
      const bb = Array.isArray(en.borderBoxSize) ? en.borderBoxSize[0] : en.borderBoxSize;
      const w = bb ? bb.inlineSize : en.contentRect.width;
      const h = bb ? bb.blockSize : en.contentRect.height;
      if (w <= 0 || h <= 0) return;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // テーマ切替(<html> の class)で色が変わるので作り直す
  const paletteTick = useHtmlClassTick();

  // 描画(実寸・テーマのどれかが変わるたび。SVG に文字は無いので書体は無関係)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    ensureDefs();
    const { frame, panels } = latest.current;
    const pal = readPalette(document.documentElement);
    const W = size?.w ?? frame.w0;
    const H = size?.h ?? frame.h0;
    el.innerHTML = panels.map((p, i) => {
      const q = stretchPlaced(p, frame, W, H);
      if ('kind' in q.spec) return ''; // drawer / glow の描画は別系統(Task 2)
      return `<svg class="milspec-armor-panel" style="left:${q.x}px;top:${q.y}px" width="${q.w}" height="${q.h}" viewBox="0 0 ${q.w} ${q.h}">${armorSVG(q.spec, pal, `${id}-${i}`)}</svg>`;
    }).join('');
  }, [id, contentKey, size, paletteTick]);

  return <div ref={ref} className={`milspec-armor${className ? ` ${className}` : ''}`} data-ms-armor={id} aria-hidden="true" />;
}
