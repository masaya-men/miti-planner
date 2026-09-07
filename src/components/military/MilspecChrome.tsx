import { useSyncExternalStore } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

/** PC 判定を matchMedia で購読(resize で再評価。state は最小限)。
 *  SSR / 非ブラウザ環境は PC 扱い(getServerSnapshot = true)。 */
function usePcViewport(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 768px)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true,
  );
}

/** MIL-SPEC の全画面装飾オーバーレイ。themeStyle==='military' かつ PC のときだけ描画。
 *  外枠コンソール(四隅ブラケット + ビス + 型番)。pointer-events: none。
 *  weather/AO レイヤーは Task 4.2 で必要と判断されたら追加。 */
export function MilspecChrome() {
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const isPc = usePcViewport();
  if (themeStyle !== 'military' || !isPc) return null;
  return (
    <div
      className="milspec-chrome-root"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}
    >
      <div className="milspec-console-frame">
        <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
        <b className="tl" /><b className="tr" /><b className="bl" /><b className="br" />
        <span className="code">LoPo Combat Analysis System · MIL-SPEC Theme Profile · MSP-REV-C</span>
      </div>
    </div>
  );
}
