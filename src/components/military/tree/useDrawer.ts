import React from 'react';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

/**
 * 引き出しの開閉(見本 milspec-v11.js の foldTo / js:1120-1134 をそのまま)。
 * 開く = 460ms で高さ 0 → +5px の行き過ぎ → 本来の高さ、子は 110ms + 45ms*i 遅れて左から滑り込む。
 * 閉じる = 340ms で +3px 膨らんでから 0 へ。reduced(または animate 非対応)なら hidden を切り替えるだけ。
 */
function foldDrawer(list: HTMLElement, open: boolean, reduced: boolean): void {
  if (reduced || typeof list.animate !== 'function') { list.hidden = !open; return; }
  if (open) {
    list.hidden = false;
    const h = list.scrollHeight;
    list.style.overflow = 'hidden';
    const a = list.animate([
      { height: '0px', easing: 'cubic-bezier(.7,0,.2,1)' },
      { height: h + 5 + 'px', offset: 0.78, easing: 'ease-in-out' },
      { height: h + 'px' },
    ], { duration: 460 });
    a.onfinish = () => { list.style.overflow = ''; };
    [...list.children].forEach((c, i) => c.animate([
      { transform: 'translateX(-10px)', opacity: 0 },
      { transform: 'translateX(1px)', opacity: 1, offset: 0.7 },
      { transform: 'none', opacity: 1 },
    ], { duration: 360, delay: 110 + i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  } else {
    const h = list.offsetHeight;
    list.style.overflow = 'hidden';
    const a = list.animate([
      { height: h + 'px', easing: 'cubic-bezier(.5,0,.9,.5)' },
      { height: h + 3 + 'px', offset: 0.15, easing: 'cubic-bezier(.6,0,.9,.4)' },
      { height: '0px' },
    ], { duration: 340 });
    a.onfinish = () => { list.hidden = true; list.style.overflow = ''; };
  }
}

/** 開閉の状態 + 引き出しの実体(hidden は初期値だけ React が決め、以後は foldDrawer が直接動かす) */
export function useDrawer(initialOpen: boolean) {
  const reduced = useReducedMotion();
  const [open, setOpenState] = React.useState(initialOpen);
  const openRef = React.useRef(initialOpen);
  const initialHidden = React.useRef(!initialOpen).current;
  const listRef = React.useRef<HTMLDivElement>(null);
  const setOpen = React.useCallback((next: boolean) => {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpenState(next);
    if (listRef.current) foldDrawer(listRef.current, next, reduced);
  }, [reduced]);
  return { open, setOpen, listRef, initialHidden, reduced };
}
