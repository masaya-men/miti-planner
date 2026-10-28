import React from 'react';
import type { AppliedMitigation } from '../../types';
import { MobileEffectBarLayer } from '../MobileEffectBarLayer';
import {
    computeMobileEffectBars,
    MOBILE_EFFECT_BAR_ROW_INSET,
    MOBILE_EFFECT_BAR_SLOT_PITCH,
} from '../../utils/mobileEffectBar';
import type { useMitigations } from '../../hooks/useSkillsData';
import type { useTimelineRowLayout } from './useTimelineLayout';
import type { useTimelineDamage } from './useTimelineDamage';
import { getMitigationColorClasses } from './mitigationItemColors';

type DamageResult = ReturnType<typeof useTimelineDamage>;
type RowLayoutResult = ReturnType<typeof useTimelineRowLayout>;

interface TimelineMobileEffectBarsProps {
    showPreStart: boolean;
    sheetWidth: number;
    hiddenPartyMemberIds: string[];
    timelineMitigations: AppliedMitigation[];
    MITIGATIONS: ReturnType<typeof useMitigations>;
    rowLayout: RowLayoutResult['rowLayout'];
    hideEmptyRows: boolean;
    maxTime: DamageResult['maxTime'];
    eventsByTime: RowLayoutResult['eventsByTime'];
    mitStartsByTime: Map<number, boolean>;
    shieldExhaustedAt: DamageResult['shieldExhaustedAt'];
    barrierOverwrittenAt: DamageResult['barrierOverwrittenAt'];
    mobileConflictingIds: DamageResult['mobileConflictingIds'];
}

/**
 * スマホの効果棒(軽減の効果時間を行の奥に縦の棒で描く)。Timeline から移したもの。
 * 元は毎描画で組み立てていたので React.memo にしない。
 */
export const TimelineMobileEffectBars: React.FC<TimelineMobileEffectBarsProps> = ({
    showPreStart, sheetWidth, hiddenPartyMemberIds, timelineMitigations, MITIGATIONS, rowLayout, hideEmptyRows,
    maxTime, eventsByTime, mitStartsByTime, shieldExhaustedAt, barrierOverwrittenAt, mobileConflictingIds,
}) => {
    // 行の文字(攻撃名・ダメージ等)より奥に描画するため、renderItems(行本体)より
    // 前にマウントする(z-index を持たない同士は DOM 順で手前/奥が決まる)。
    // このFragment内の他の兄弟ブロック(フェーズ/ラベルオーバーレイ)と同じく、
    // 各IIFEは自分のスコープなので offsetTime をローカルで再計算する。
    const offsetTime = showPreStart ? -10 : 0;
    // 画面幅から横に並べられる最大同時本数を算出。
    // sheetWidth 未計測時(初回フレーム)はモバイル最小幅を仮定した安全値にフォールバック。
    const availableWidth = sheetWidth > 0 ? sheetWidth : 350;
    const maxConcurrent = Math.max(
        1,
        Math.floor((availableWidth - MOBILE_EFFECT_BAR_ROW_INSET * 2) / MOBILE_EFFECT_BAR_SLOT_PITCH)
    );
    // 表示/非表示スイッチで隠したメンバーの効果棒は除外(見た目だけの絞り込み・2026-08-19)。
    const visibleTimelineMitigationsForBars = hiddenPartyMemberIds.length === 0
        ? timelineMitigations
        : timelineMitigations.filter(m => !hiddenPartyMemberIds.includes(m.ownerId));
    const mobileBars = computeMobileEffectBars({
        timelineMitigations: visibleTimelineMitigationsForBars,
        mitigationDefs: MITIGATIONS,
        timeToYMap: rowLayout.timeToY,
        pixelsPerSecond: rowLayout.unitPx,
        offsetTime,
        hideEmptyRows,
        maxTime,
        eventsByTime,
        mitStartsByTime,
        showPreStart,
        maxConcurrent,
        getColorClasses: (jobId, ownerId) => getMitigationColorClasses(jobId, ownerId, 'role'),
        shieldExhaustedAt,
        barrierOverwrittenAt,
    });
    return <MobileEffectBarLayer bars={mobileBars} conflictingIds={mobileConflictingIds} />;
};
