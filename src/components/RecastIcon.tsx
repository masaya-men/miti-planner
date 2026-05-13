import { forwardRef } from 'react';
import type { CSSProperties } from 'react';

interface RecastIconProps {
    iconUrl: string;
    alt: string;
}

/**
 * リキャスト行内に常駐する clockswipe アイコン。
 *
 * 親 (RecastRow) は ref 経由で以下の CSS variable を直接更新する。
 * いずれも **文字列** で扱う (CSS variable は本質的に文字列、 数値混在を避けて契約を明確化):
 * - `--cd-display`: `'none'` | `'flex'` (表示/非表示)
 * - `--cd-angle`: `'Ndeg'` (clockswipe の透明領域角度)
 * - `--cd-order`: 数値文字列 (flex order、 並び順)。 親側は `String(n)` で書き込む
 *
 * 残秒テキストは ref.current.querySelector('.recast-num').textContent で更新する。
 */
export const RecastIcon = forwardRef<HTMLDivElement, RecastIconProps>(
    ({ iconUrl, alt }, ref) => {
        return (
            <div
                ref={ref}
                className="recast-icon"
                style={{
                    '--cd-display': 'none',
                    '--cd-angle': '0deg',
                    '--cd-order': '0',
                } as CSSProperties}
            >
                <img src={iconUrl} alt={alt} />
                <span className="recast-num" />
            </div>
        );
    },
);
RecastIcon.displayName = 'RecastIcon';
