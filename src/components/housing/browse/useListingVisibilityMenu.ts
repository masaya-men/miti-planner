import { useEffect, useRef, useState } from 'react';
import { useDismissOnOutside } from '../../../hooks/useDismissOnOutside';

/**
 * ListingCard (マイページ) の公開状態切替ポップオーバーの開閉・位置・外側クリック/Esc で閉じる処理。
 */
export function useListingVisibilityMenu() {
  // マイページ: 公開状態切替ポップオーバーの開閉。カードごとに独立 (HousingDetailKebab と同仕様)。
  // カード自体が overflow:hidden (角丸のため) を持つため、メニューはカード内の絶対配置ではなく
  // createPortal で document.body 直下に出す (でないとカードの縁でクリップされ表示が崩れる・
  // 2026-07-24 実機指摘)。ボタンとメニューが DOM 上は離れた場所になるため、外側クリック判定は
  // 両方の ref を見る。
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [visibilityMenuPos, setVisibilityMenuPos] = useState<{ top: number; right: number } | null>(null);
  const visibilityBtnRef = useRef<HTMLButtonElement | null>(null);
  const visibilityMenuPortalRef = useRef<HTMLDivElement | null>(null);
  useDismissOnOutside(visibilityMenuOpen, () => setVisibilityMenuOpen(false), [visibilityBtnRef, visibilityMenuPortalRef]);
  useEffect(() => {
    if (!visibilityMenuOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisibilityMenuOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [visibilityMenuOpen]);
  return { visibilityMenuOpen, setVisibilityMenuOpen, visibilityMenuPos, setVisibilityMenuPos, visibilityBtnRef, visibilityMenuPortalRef };
}
