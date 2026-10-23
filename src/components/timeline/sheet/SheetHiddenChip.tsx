// スプシ表示のジョブ欄の「+(隠した数)」。押すと隠した技の小窓(SheetHiddenPopover)が開く。
// 列が 1 本以下で狭いときは「+」を省いて数だけの丸バッジにする(見本 Q2 案 b)。
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../../ui/Tooltip';

interface Props {
    count: number;
    /** 見えている列が 1 本以下 → 数だけの丸バッジ */
    narrow: boolean;
    onOpen: (e: React.MouseEvent) => void;
}

export const SheetHiddenChip: React.FC<Props> = ({ count, narrow, onOpen }) => {
    const { t } = useTranslation();
    const label = t('timeline.sheet_hidden_chip', { count });
    // Tooltip の外側の箱が位置決めを担う(ブラウザ標準の title は使わない)
    const wrapPos = narrow ? '!absolute !z-20 right-[1px] top-[3px]' : '!absolute !z-20 right-[3px] top-1/2 -translate-y-1/2';
    return (
        <Tooltip content={label} wrapperClassName={wrapPos}>
            <button
                type="button"
                data-sheet-hidden-chip=""
                aria-label={label}
                onClick={(e) => { e.stopPropagation(); onOpen(e); }}
                className={
                    'inline-flex items-center justify-center border border-app-border bg-app-surface2 text-app-text font-black leading-none cursor-pointer hover:bg-app-text hover:text-app-bg '
                    + (narrow
                        ? 'w-[13px] h-[13px] rounded-full text-[9px]'
                        : 'h-[15px] px-[5px] gap-[2px] rounded-full text-[10px]')
                }
            >
                {!narrow && <span>+</span>}
                <span className={narrow ? '' : 'text-[9px] font-bold'}>{count}</span>
            </button>
        </Tooltip>
    );
};
