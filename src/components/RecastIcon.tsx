import { forwardRef } from 'react';
import type { CSSProperties } from 'react';

interface RecastIconProps {
    iconUrl: string;
    alt: string;
}

/**
 * リキャスト行内に常駐する clockswipe アイコン。
 *
 * 親 (RecastRow) は ref 経由で以下の CSS variable を直接更新する:
 * - `--cd-display`: 'none' | 'flex' (表示/非表示)
 * - `--cd-angle`: 'Ndeg' (clockswipe の透明領域角度)
 * - `--cd-order`: 数値 (flex order、 並び順)
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
                    ['--cd-display' as string]: 'none',
                    ['--cd-angle' as string]: '0deg',
                    ['--cd-order' as string]: 0,
                } as CSSProperties}
            >
                <img src={iconUrl} alt={alt} />
                <span className="recast-num" />
            </div>
        );
    },
);
RecastIcon.displayName = 'RecastIcon';
