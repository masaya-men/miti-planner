import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface HousingTourAddErrorBubbleProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  /** null/空文字なら何も描画しない。 */
  message: string | null;
}

/** 吹き出しの max-width(220px)の半分+画面端マージン(8px)。left はこの値で
 * viewport 内にクランプする(CSS 側の translateX(-50%) 中央寄せ込みの計算)。 */
const BUBBLE_HALF_WIDTH_MARGIN = 118;

/**
 * ボタンの真上に一時的なエラーメッセージを出す吹き出し。カードの overflow:hidden に
 * クリップされないよう、ListingCard.tsx の visibilityMenuPos と同じ手法(document.body へ
 * portal + getBoundingClientRect 基準の fixed 配置)を使う。
 * スマホでの画面端はみ出し対策として、左右位置を viewport 内にクランプする
 * (design spec 2026-08-10 housing-tour-add-feedback-design.md 88行目)。
 */
export const HousingTourAddErrorBubble: React.FC<HousingTourAddErrorBubbleProps> = ({
  anchorRef,
  message,
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!message || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const rawLeft = rect.left + rect.width / 2;
    const clampedLeft = Math.min(
      Math.max(rawLeft, BUBBLE_HALF_WIDTH_MARGIN),
      window.innerWidth - BUBBLE_HALF_WIDTH_MARGIN,
    );
    setPos({ top: rect.top, left: clampedLeft });
  }, [message, anchorRef]);

  if (!message || !pos) return null;

  return createPortal(
    <div
      className="housing-tour-error-bubble"
      role="status"
      data-testid="housing-tour-error-bubble"
      style={{ top: pos.top, left: pos.left }}
    >
      {message}
    </div>,
    document.body,
  );
};
