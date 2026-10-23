import type { MouseEvent, PointerEvent } from 'react';

/**
 * モーダル背景(外側)クリックで閉じるための共通ハンドラ。
 * 押し始めも離したときも「背景そのもの」だった場合だけ閉じる。
 * (中で文字を選んで外で離した/外から中へドラッグした場合は閉じない)
 * 背景要素に `{...backdropClose(onClose)}` を展開して使う(背景が子要素の場合は、その子に data-backdrop を付ける)(フックではないので条件分岐内でも可)。
 * 背景のカーソルは cursor-default(通常の矢印)にすること。
 *
 * 入力途中の自動判定(窓ごとの配線は不要):
 *  - 窓の中の input / textarea / select / contenteditable が input・change イベントを 1 回でも出したら「変更あり」。
 *  - 変更あり: 外側クリックでは閉じず、窓の枠を短く縁取って(.backdrop-nudge)閉じなかったことを知らせる。
 *  - 変更なし: 閉じる。背景の要素が作り直される(=窓を開き直す)と変更なしに戻る。
 *  - 窓の範囲: 背景が中身を子に持つ場合は背景自身、持たない(中身と兄弟の)場合は親要素。
 *  - input イベントが出ない変更(貼り付け・ドラッグ・段階の進行など)がある窓だけ、第 2 引数 `{ dirty: true }` を足す。
 *  - 外側クリックが「保存して閉じる」等、捨てるわけではない窓は `{ autoGuard: false }`。
 */
interface GuardState {
  dirty: boolean;
}
const states = new WeakMap<HTMLElement, GuardState>();

export interface BackdropCloseOptions {
  /** 自動検知では拾えない変更がある(true の間は閉じない)。 */
  dirty?: boolean;
  /** false で自動検知を使わない(既定 true)。 */
  autoGuard?: boolean;
}

let downTarget: EventTarget | null = null;

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

function scopeOf(el: HTMLElement): HTMLElement {
  return el.childElementCount === 0 && el.parentElement ? el.parentElement : el;
}

/** 背景要素が画面に出たとき(ref)に、窓の範囲へ入力の検知を仕掛ける。ref は再描画のたびに呼ばれるので 1 要素 1 回だけ。 */
function attach(el: HTMLElement | null) {
  if (!el || states.has(el)) return;
  const state: GuardState = { dirty: false };
  states.set(el, state);
  const scope = scopeOf(el);
  const mark = (e: Event) => {
    const t = e.target;
    if (t instanceof HTMLElement && (t.matches(EDITABLE) || t.isContentEditable)) state.dirty = true;
  };
  scope.addEventListener('input', mark, true);
  scope.addEventListener('change', mark, true);
}

function findFrame(bd: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = scopeOf(bd);
  for (let i = 0; i < 3 && node; i++) {
    const next: HTMLElement | undefined = Array.from(node.children).find(
      (c): c is HTMLElement => c instanceof HTMLElement && c !== bd,
    );
    if (!next) return null;
    if (next.hasAttribute('data-backdrop')) { node = next; continue; }
    return next;
  }
  return null;
}

function nudge(bd: HTMLElement) {
  const frame = findFrame(bd);
  if (!frame) return;
  frame.classList.remove('backdrop-nudge');
  void frame.offsetWidth; // 連続クリックでもアニメを頭から再生する
  frame.classList.add('backdrop-nudge');
  window.setTimeout(() => frame.classList.remove('backdrop-nudge'), 700);
}

export function backdropClose(onClose?: () => void, options: BackdropCloseOptions = {}) {
  const { dirty = false, autoGuard = true } = options;
  return {
    ref: autoGuard ? attach : undefined,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      downTarget = e.target;
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      const isBackdrop = (t: EventTarget | null) =>
        t === e.currentTarget || (t instanceof HTMLElement && t.dataset.backdrop !== undefined);
      const ok = downTarget !== null && isBackdrop(downTarget) && isBackdrop(e.target);
      downTarget = null;
      if (!ok || !onClose) return;
      const changed = dirty || (autoGuard && states.get(e.currentTarget)?.dirty === true);
      if (changed) nudge(e.currentTarget);
      else onClose();
    },
  };
}
