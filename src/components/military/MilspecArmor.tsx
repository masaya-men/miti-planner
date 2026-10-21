import { useLayoutEffect, useRef, useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore';
import { armorDefsSVG, armorSVG } from './armor/svg';
import { readPalette } from './armor/palette';
import { stretchPlaced } from './armor/stretch';
import type { PlacedPanel, StretchFrame } from './armor/types';

const DEFS_ID = 'milspec-armor-defs';

/** 粒子ノイズ(見本 js:1204-1207 と同じ)。canvas が使えない環境では '' を返す */
function makeNoiseUrl(): string {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    if (!x) return '';
    const im = x.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = Math.random() * 30;
    }
    x.putImageData(im, 0, 0);
    return c.toDataURL();
  } catch {
    return '';
  }
}

/** 共通 defs は画面に 1 つだけ。無ければ body 直下に作る(消さない = 他の区画も使う) */
function ensureDefs(): void {
  if (document.getElementById(DEFS_ID)) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg id="${DEFS_ID}" width="0" height="0" aria-hidden="true" style="position:absolute"><defs>${armorDefsSVG(makeNoiseUrl())}</defs></svg>`;
  const svg = wrap.firstElementChild;
  if (svg) document.body.appendChild(svg);
}

interface Props { id: string; frame: StretchFrame; panels: PlacedPanel[]; className?: string }

/** 区画(親は position:relative 前提)の全面に、金属パネルの SVG を重ねて描く */
export function MilspecArmor({ id, frame, panels, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [fontsTick, setFontsTick] = useState(0);

  // 親の実寸を監視
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r || r.width <= 0 || r.height <= 0) return;
      setSize((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // 書体の読込完了で作り直す
  useLayoutEffect(() => {
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) setFontsTick((n) => n + 1); });
    return () => { alive = false; };
  }, []);

  // 描画(実寸・テーマ・書体のどれかが変わるたび)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    ensureDefs();
    const pal = readPalette(document.documentElement);
    const W = size?.w ?? frame.w0;
    const H = size?.h ?? frame.h0;
    el.innerHTML = panels.map((p, i) => {
      const q = stretchPlaced(p, frame, W, H);
      return `<svg class="milspec-armor-panel" style="left:${q.x}px;top:${q.y}px" width="${q.w}" height="${q.h}" viewBox="0 0 ${q.w} ${q.h}">${armorSVG(q.spec, pal, `${id}-${i}`)}</svg>`;
    }).join('');
  }, [id, frame, panels, size, theme, fontsTick]);

  return <div ref={ref} className={`milspec-armor${className ? ` ${className}` : ''}`} data-ms-armor={id} aria-hidden="true" />;
}
