import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { TOOLTIP_BOX_CLASS } from '../ui/Tooltip';
import { placeTooltipPopup } from '../ui/tooltipPlacement';
import { matchesMobile } from '../../hooks/useIsMobile';

// ボード(.milspec-app)の中の title 属性はブラウザの灰色の箱になる。標準テーマはアプリのツールチップ(ui/Tooltip)なので、
// MIL-SPEC でも同じ箱で出す(masaya 2026-10-22)。部品ごとに書き換えると取りこぼすので、ボードの根元で 1 つだけ委譲して拾う。
// 乗っている間だけ title を外して(ブラウザの箱を止める)、離れたら戻す。箱は body へ portal = 標準の見た目。

const SHOW_DELAY = 100;  // ui/Tooltip の既定 delay と同じ
const LEAVE_GRACE = 80;  // ui/Tooltip の LEAVE_GRACE と同じ

export function MilspecTitleTooltip({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const [text, setText] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || matchesMobile(window)) return; // スマホは ui/Tooltip と同じく出さない

    let cur: HTMLElement | null = null;
    let label = '';
    let showT: ReturnType<typeof setTimeout> | undefined;
    let hideT: ReturnType<typeof setTimeout> | undefined;
    let shown = false;
    // 乗っている間に React が title を付け直したら、その都度外して文言を更新する
    const mo = new MutationObserver(() => {
      if (!cur) return;
      const t = cur.getAttribute('title');
      if (t == null) return;
      label = t;
      cur.removeAttribute('title');
      if (shown) setText(t);
    });

    const place = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        if (popupRef.current) placeTooltipPopup(popupRef.current, cursor.current.x, cursor.current.y);
      });
    };
    const release = () => {
      mo.disconnect();
      if (cur && label && !cur.hasAttribute('title')) cur.setAttribute('title', label);
      cur = null;
      label = '';
    };
    const hideNow = () => {
      clearTimeout(showT);
      clearTimeout(hideT);
      release();
      shown = false;
      setText(null);
    };

    const onOver = (e: PointerEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY };
      const target = e.target as Element | null;
      if (cur && target && cur.contains(target)) { clearTimeout(hideT); return; } // 同じ要素の中を移動しただけ
      const el = target?.closest?.('[title]') as HTMLElement | null;
      if (!el || !root.contains(el) || !el.getAttribute('title')) return;
      hideNow();
      cur = el;
      label = el.getAttribute('title') ?? '';
      el.removeAttribute('title');
      mo.observe(el, { attributes: true, attributeFilter: ['title'] });
      showT = setTimeout(() => { shown = true; setText(label); }, SHOW_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      if (!cur) return;
      const to = e.relatedTarget as Node | null;
      if (to && cur.contains(to)) return;
      clearTimeout(showT);
      clearTimeout(hideT);
      hideT = setTimeout(hideNow, LEAVE_GRACE);
    };
    const onMove = (e: PointerEvent) => {
      if (!cur) return;
      cursor.current = { x: e.clientX, y: e.clientY };
      if (shown) place();
    };

    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
    root.addEventListener('pointermove', onMove);
    // 掴んだ瞬間に閉じる(ui/Tooltip と同じ・capture で先に拾う)
    document.addEventListener('pointerdown', hideNow, true);
    return () => {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
      root.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', hideNow, true);
      cancelAnimationFrame(raf.current);
      hideNow();
    };
  }, [rootRef]);

  // 出た直後に位置を決める
  useLayoutEffect(() => {
    if (text && popupRef.current) placeTooltipPopup(popupRef.current, cursor.current.x, cursor.current.y);
  }, [text]);

  if (!text) return null;
  return createPortal(
    <motion.div
      ref={popupRef}
      data-ms-title-tip=""
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ position: 'fixed', zIndex: 99999, pointerEvents: 'none', left: -9999, top: -9999 }}
      className={TOOLTIP_BOX_CLASS}
    >
      {text}
    </motion.div>,
    document.body,
  );
}
