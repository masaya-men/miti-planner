import React from 'react';
import clsx from 'clsx';
import type { PlanMemo } from '../../types';
import { timeSecToY, xRatioToPx } from './coords';
import './memo.css';

interface MemoOverlayProps {
    memos: PlanMemo[];
    timeToYMap: Map<number, number>;
    sheetWidth: number;
    /** メモモード ON 中は touchable、 OFF 中は readonly */
    interactive: boolean;
    /** クリック時 (= 編集モーダル起動)、 Task 12 で実装 */
    onMemoClick?: (memo: PlanMemo) => void;
}

export const MemoOverlay: React.FC<MemoOverlayProps> = ({
    memos,
    timeToYMap,
    sheetWidth,
    interactive,
    onMemoClick,
}) => {
    return (
        <>
            {memos.map(memo => {
                const top = timeSecToY(memo.timeSec, timeToYMap);
                const left = xRatioToPx(memo.xRatio, sheetWidth);
                return (
                    <div
                        key={memo.id}
                        className={clsx('plan-memo', !interactive && 'plan-memo--readonly')}
                        style={{ top: `${top}px`, left: `${left}px` }}
                        onClick={interactive ? () => onMemoClick?.(memo) : undefined}
                    >
                        {memo.text}
                    </div>
                );
            })}
        </>
    );
};
