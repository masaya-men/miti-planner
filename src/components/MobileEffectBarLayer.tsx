import clsx from 'clsx';
import type { MobileEffectBarItem } from '../utils/mobileEffectBar';
import {
  MOBILE_EFFECT_BAR_WIDTH,
  MOBILE_EFFECT_BAR_SLOT_PITCH,
  MOBILE_EFFECT_BAR_ROW_INSET,
} from '../utils/mobileEffectBar';

interface MobileEffectBarLayerProps {
  bars: MobileEffectBarItem[];
  /** 競合(同スキルCDかぶり)中の軽減インスタンスID集合。'常時'/'連動'モードでは専用行アイコン
   * (.mobile-miti-icons)がopacity:0で隠れてこちらに変身しきっているため、パルス表示は
   * こちらのアイコンにも付けないと競合が一切見えなくなる(2026-08-14ユーザー実機FB)。 */
  conflictingIds?: Set<string>;
}

/**
 * モバイル軽減表: スクロール量に連動して専用行アイコンから変身するエフェクト棒のオーバーレイ層。
 * 変身の進み具合(0〜1)は親(Timeline.tsx)がコンテナに設定する `--mobile-effect-bar-progress`
 * というCSS変数で、伸縮・拡大縮小・横スライドはすべてCSS側(index.css)のtransformで行う
 * (React再レンダーなしでスクロールに追従させるため、このコンポーネント自身は常時マウントし続ける)。
 * 棒本体(mobile-effect-bar-fill)とアイコンを別要素にしているのは、棒の伸び(scaleY)がアイコンの
 * 縮小(scale)に干渉しないようにするため(子要素は親のtransformの影響を受けてしまう)。
 */
export const MobileEffectBarLayer: React.FC<MobileEffectBarLayerProps> = ({ bars, conflictingIds }) => {
  return (
    <div className="mobile-effect-bar-layer absolute inset-0 pointer-events-none md:hidden">
      {bars.map(bar => {
        const isConflicting = !!conflictingIds?.has(bar.id);
        return (
        <div
          key={bar.id}
          className="mobile-effect-bar-item absolute"
          style={{
            top: `${bar.top}px`,
            height: `${bar.height}px`,
            width: `${MOBILE_EFFECT_BAR_WIDTH}px`,
            right: `${MOBILE_EFFECT_BAR_ROW_INSET}px`,
            '--mobile-effect-bar-slot-x': `${bar.slotIndex * MOBILE_EFFECT_BAR_SLOT_PITCH}px`,
          } as React.CSSProperties}
        >
          <div
            className={clsx(
              'mobile-effect-bar-fill absolute inset-0 rounded-b-sm border-x',
              bar.colors.bg,
              bar.colors.border,
              bar.colors.shadow,
            )}
          />
          {isConflicting ? (
            // 競合中は脈動アニメ(.animate-conflict-pulse)をラッパーに逃がす。CSSアニメーションは
            // 対象プロパティ(opacity/transform)を丸ごと上書きするため、.mobile-effect-bar-icon本体
            // に付けると進み具合連動のopacity(静止時=0で不可視)が無視され、本来隠れているはずの
            // 競合アイコンだけが変身前の待機位置(画面右端そば)に薄く常時居座って見える不具合になる
            // (2026-08-14ユーザー実機FB「競合してるスキルだけ画面右に漏れて見える」の真因)。
            // ラッパーとアイコンを別要素にすれば、脈動のopacity/scaleは進み具合側のopacity/scaleと
            // 掛け算で合成されるため、進み具合0のときは従来通り完全に不可視へ戻る。
            <div
              className="mobile-effect-bar-icon-slot absolute animate-conflict-pulse"
              style={{ top: '0px', left: '50%' }}
            >
              <img
                src={bar.iconUrl}
                alt=""
                className="mobile-effect-bar-icon absolute inset-0 rounded object-cover max-w-none ring-1 ring-amber-400"
              />
            </div>
          ) : (
            <img
              src={bar.iconUrl}
              alt=""
              className="mobile-effect-bar-icon absolute rounded object-cover max-w-none"
              style={{
                // 使用した秒の行より上(=前の行)にアイコンがはみ出さないよう、bar.top(=使用時刻の行)
                // を基準に真下へ描画する(実機FB: 前の行に配置されて見える不具合の修正)。
                top: '0px',
                left: '50%',
              }}
            />
          )}
        </div>
        );
      })}
    </div>
  );
};
