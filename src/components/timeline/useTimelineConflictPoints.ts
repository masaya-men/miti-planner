import { useMemo } from 'react';
import type { AppliedMitigation } from '../../types';
import type { useMitigations } from '../../hooks/useSkillsData';
import type { ConflictPoint } from './conflictArrows';
import { sheetColumnIndex, SHEET_ICON_PX } from './sheet/sheetColumns';
import { sheetIconLeft } from './sheet/sheetGeometry';
import type { useTimelineRowLayout, useTimelineMemberXMap } from './useTimelineLayout';
import type { useTimelineDamage } from './useTimelineDamage';
import type { useTimelineSheetColumns } from './useTimelineSheetView';

interface UseTimelineConflictPointsArgs {
    timelineMitigations: AppliedMitigation[];
    conflictingIds: ReturnType<typeof useTimelineDamage>['conflictingIds'];
    lastPlacedMitigationId: string | null;
    hiddenPartyMemberIds: string[];
    rowLayout: ReturnType<typeof useTimelineRowLayout>['rowLayout'];
    isMobileTimeline: boolean;
    sheetWidth: number;
    memberLayout: ReturnType<typeof useTimelineMemberXMap>['memberLayout'];
    sheetColumnMap: ReturnType<typeof useTimelineSheetColumns>['sheetColumnMap'];
    MITIGATIONS: ReturnType<typeof useMitigations>;
}

/**
 * 画面外ガイド矢印用: 競合中インスタンスの列中央X + コンテンツ内絶対Y を算出。
 * Y は rowLayout(同じレンダーで計算済みの行の配置)から得る。旧実装の「直前レンダーの
 * timeToYMap を ref 経由で読む 1 レンダー分のラグ」は無くなった。
 * 初回マウント時の 1 フレームずれは ConflictOffscreenArrows 側で viewportHeight===0 中は
 * 描画しないことで緩和している。
 */
export function useTimelineConflictPoints({
    timelineMitigations, conflictingIds, lastPlacedMitigationId, hiddenPartyMemberIds,
    rowLayout, isMobileTimeline, sheetWidth, memberLayout, sheetColumnMap, MITIGATIONS,
}: UseTimelineConflictPointsArgs): ConflictPoint[] {
    return useMemo<ConflictPoint[]>(() => {
        return timelineMitigations
            // 表示/非表示スイッチで隠したメンバーの競合は、列自体が描画されないため画面外
            // ガイド矢印の対象からも除外する(競合検知=conflictingIds 自体は不変・見た目だけ)。
            .filter(m => conflictingIds.has(m.id) && m.id !== lastPlacedMitigationId && !hiddenPartyMemberIds.includes(m.ownerId))
            .map(m => {
                const y = rowLayout.topOf(m.time);
                if (isMobileTimeline) {
                    // モバイルは担当者ごとの列が無い(1本の行に全員分のアイコンが並ぶ)ため、
                    // ownerId を固定値にして矢印を「上下1個ずつ」に集約する(PCのように
                    // 担当者ごとにバラバラ出ると窮屈になるため)。x は行の水平中央。
                    return { id: m.id, ownerId: '__mobile__', y, columnCenterX: sheetWidth / 2 };
                }
                const layout = memberLayout.get(m.ownerId);
                // スプシ表示: そのスキルの列の中央(列が無ければメンバー列の中央)
                const sheetCi = sheetColumnMap ? sheetColumnIndex(sheetColumnMap.get(m.ownerId) ?? [], m.mitigationId, MITIGATIONS) : -1;
                return {
                    id: m.id,
                    ownerId: m.ownerId,
                    y,
                    // 列幅の中央 (ジョブ種別で列幅が変わるので width の中央)。
                    columnCenterX: !layout ? 0
                        : sheetCi >= 0 ? layout.left + sheetIconLeft(0, sheetCi) + SHEET_ICON_PX / 2
                        : layout.left + layout.width / 2,
                };
            });
    // memberLayout は Map で参照同一・中身が変化するため refVersion を直接含められない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timelineMitigations, conflictingIds, lastPlacedMitigationId, memberLayout, rowLayout, isMobileTimeline, sheetWidth, sheetColumnMap, MITIGATIONS]);
}
