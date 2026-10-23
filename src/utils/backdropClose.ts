import type { MouseEvent, PointerEvent } from 'react';

/**
 * モーダル背景(外側)クリックで閉じるための共通ハンドラ。
 * 押し始めも離したときも「背景そのもの」だった場合だけ閉じる。
 * (中で文字を選んで外で離した/外から中へドラッグした場合は閉じない)
 * 背景要素に `{...backdropClose(onClose)}` を展開して使う(背景が子要素の場合は、その子に data-backdrop を付ける)(フックではないので条件分岐内でも可)。
 * 背景のカーソルは cursor-default(通常の矢印)にすること。
 * 入力途中の内容がある窓は、dirty のとき onClose を渡さず `backdropClose(dirty ? undefined : onClose)` とする。
 */
let downTarget: EventTarget | null = null;

export function backdropClose(onClose?: () => void) {
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      downTarget = e.target;
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      const isBackdrop = (t: EventTarget | null) =>
        t === e.currentTarget || (t instanceof HTMLElement && t.dataset.backdrop !== undefined);
      const ok = downTarget !== null && isBackdrop(downTarget) && isBackdrop(e.target);
      downTarget = null;
      if (ok) onClose?.();
    },
  };
}
