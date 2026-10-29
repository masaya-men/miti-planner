import { useEffect, useRef, type RefObject } from 'react';
import { useTutorialStore } from '../store/useTutorialStore';

export type DismissOnOutsideOptions = { allowDuringTutorial?: boolean };

// グローバルスタック: 複数パネルが重なった時に最前面だけが外側クリックに反応する
const dismissStack: Array<symbol> = [];

// 離してから click が来ない時の保険の待ち時間
const SWALLOW_MS = 400;

/**
 * 外側を押したら閉じる(閉じるだけ・その 1 回は下に届けない)。
 * insideRefs = パネル本体と portal で出した子。開くボタンは入れない(外扱い=押すと閉じるだけ)。
 */
export function useDismissOnOutside(
  isOpen: boolean,
  onDismiss: () => void,
  insideRefs: ReadonlyArray<RefObject<HTMLElement | null>>,
  options?: DismissOnOutsideOptions,
) {
  const callbackRef = useRef(onDismiss);
  callbackRef.current = onDismiss;
  const refsRef = useRef(insideRefs);
  refsRef.current = insideRefs;
  const allowDuringTutorialRef = useRef(options?.allowDuringTutorial ?? false);
  allowDuringTutorialRef.current = options?.allowDuringTutorial ?? false;

  useEffect(() => {
    if (!isOpen) return;

    const entry = Symbol('dismiss');
    dismissStack.push(entry);
    let stopTouchWait = () => {};

    const handlePointerDown = (e: PointerEvent) => {
      if (!allowDuringTutorialRef.current && useTutorialStore.getState().isActive) return;
      // スタックの最後（最前面）が自分の場合のみ反応
      if (dismissStack[dismissStack.length - 1] !== entry) return;
      const target = e.target as Node | null;
      if (target && refsRef.current.some((r) => r.current?.contains(target))) return;

      // 次の click 1 回だけ止める(押下は止めない=focus は動く)。
      // 時計は離した時から 400ms(ゆっくり押しても効く)。キャンセルされたら click は来ないのですぐ外す
      let timer = 0;
      const release = () => {
        document.removeEventListener('click', swallow, true);
        document.removeEventListener('pointerup', startTimer, true);
        document.removeEventListener('pointercancel', release, true);
        window.clearTimeout(timer);
      };
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        release();
      };
      const startTimer = () => {
        timer = window.setTimeout(release, SWALLOW_MS);
      };

      // 指はスクロールかタップか押した時点では決まらない: 離したら(タップ)閉じ、スクロールに変わったら(pointercancel)閉じない
      if (e.pointerType === 'touch') {
        const onUp = () => {
          stopWaiting();
          callbackRef.current();
          document.addEventListener('click', swallow, true);
          startTimer();
        };
        const stopWaiting = () => {
          document.removeEventListener('pointerup', onUp, true);
          document.removeEventListener('pointercancel', stopWaiting, true);
        };
        stopTouchWait();
        stopTouchWait = stopWaiting;
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', stopWaiting, true);
        return;
      }

      callbackRef.current();

      // 主ボタン以外は click が来ないので止めは置かない
      if (e.button !== 0) return;

      document.addEventListener('click', swallow, true);
      document.addEventListener('pointerup', startTimer, true);
      document.addEventListener('pointercancel', release, true);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      stopTouchWait();
      const idx = dismissStack.indexOf(entry);
      if (idx >= 0) dismissStack.splice(idx, 1);
    };
  }, [isOpen]);
}
