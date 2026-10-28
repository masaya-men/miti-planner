import React from 'react';
import type { AppliedMitigation, PartyMember } from '../../types';
import { isLivingDeadStyle } from '../../utils/livingDead';
import { shieldEffectBarEndsOnBarrierExhaustion } from '../../utils/barrierStacking';
import type { useMitigations } from '../../hooks/useSkillsData';
import type { useMitigationStore } from '../../store/useMitigationStore';
import { MitigationItem } from './MitigationItem';
import { barStartY, barEndY, childIconCutY } from './rowLayout';
import { sheetColumnIndex, SHEET_ICON_PX } from './sheet/sheetColumns';
import { sheetIconLeft } from './sheet/sheetGeometry';
import { placementsWithColumn } from './sheet/sheetCooldown';
import { SheetCooldownLines } from './sheet/SheetCooldownLines';
import type { useTimelineRowLayout, useTimelineMemberXMap } from './useTimelineLayout';
import type { useTimelineDamage } from './useTimelineDamage';
import type { useTimelineSheetColumns } from './useTimelineSheetView';
import type { useTimelineMitigationEditing } from './useTimelineMitigationEditing';
/** 描画用の 1 アイコン。実データの AppliedMitigation か、ホロスコープ等の子として差し込む仮想アイコン */type DisplayItem = AppliedMitigation & { isVirtual: boolean; parentId: string | null; iconOverride?: string; grayscale?: boolean };

type DamageResult = ReturnType<typeof useTimelineDamage>;
type MitigationStore = ReturnType<typeof useMitigationStore.getState>;

interface TimelineMitigationLayerProps {
    timelineMitigations: AppliedMitigation[];
    showPreStart: boolean;
    hideEmptyRows: boolean;
    hiddenPartyMemberIds: string[];
    MITIGATIONS: ReturnType<typeof useMitigations>;
    partyMembers: PartyMember[];
    memberLayout: ReturnType<typeof useTimelineMemberXMap>['memberLayout'];
    sheetColumnMap: ReturnType<typeof useTimelineSheetColumns>['sheetColumnMap'];
    livingDeadTriggers: DamageResult['livingDeadTriggers'];
    eventsByTime: ReturnType<typeof useTimelineRowLayout>['eventsByTime'];
    mitStartsByTime: Map<number, boolean>;
    maxTime: DamageResult['maxTime'];
    rowLayout: ReturnType<typeof useTimelineRowLayout>['rowLayout'];
    shieldExhaustedAt: DamageResult['shieldExhaustedAt'];
    barrierOverwrittenAt: DamageResult['barrierOverwrittenAt'];
    readOnly: boolean;
    removeMitigation: MitigationStore['removeMitigation'];
    updateMitigationTime: MitigationStore['updateMitigationTime'];
    partySortOrder: React.ComponentProps<typeof MitigationItem>['partySortOrder'];
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    conflictingIds: DamageResult['conflictingIds'];
    lastPlacedMitigationId: string | null;
    handleCellClick: ReturnType<typeof useTimelineMitigationEditing>['handleCellClick'];
    isMilspecTable: boolean;
}

/**
 * PC の軽減アイコン層(MitigationItem と効果棒・スプシ表示のリキャスト線)。Timeline から移したもの。
 * 元は毎描画で組み立てていたので React.memo にしない。Fragment を返す(ラッパー要素なし)。
 * スマホは各行内の MitiIcons が軽減表示を担うので、呼ぶ側で `!isMobileTimeline` のときだけ置く。
 */
export const TimelineMitigationLayer: React.FC<TimelineMitigationLayerProps> = ({
    timelineMitigations, showPreStart, hideEmptyRows, hiddenPartyMemberIds, MITIGATIONS, partyMembers, memberLayout,
    sheetColumnMap, livingDeadTriggers, eventsByTime, mitStartsByTime, maxTime, rowLayout, shieldExhaustedAt,
    barrierOverwrittenAt, readOnly, removeMitigation, updateMitigationTime, partySortOrder, scrollContainerRef,
    conflictingIds, lastPlacedMitigationId, handleCellClick, isMilspecTable,
}) => {
            // 表示/非表示スイッチで隠したメンバーの軽減バーはここで除外する。memberLayout 経由
            // (ヘッダー列の DOM ref 未登録→undefined)に頼ると colStart=0 の初回マウント用
            // fallback に乗って左端に誤描画されるため、必ずソースの時点で弾く。
            const visibleMitigations = timelineMitigations.filter(m =>
                (showPreStart || (m.time + m.duration > 0)) && (!hideEmptyRows || !m.autoHidden)
                && !hiddenPartyMemberIds.includes(m.ownerId)
            );

            const mitigationsByOwner: Record<string, typeof timelineMitigations> = {};

            visibleMitigations.forEach(m => {
                if (!mitigationsByOwner[m.ownerId]) mitigationsByOwner[m.ownerId] = [];
                mitigationsByOwner[m.ownerId].push(m);
            });

            const renderedItems: React.ReactElement[] = [];

            Object.entries(mitigationsByOwner).forEach(([, ownerMitigations]) => {
                const getRecast = (mitigationId: string): number => {
                    const def = MITIGATIONS.find((m) => m.id === mitigationId);
                    return def ? (def.recast || def.recast || 999) : 999;
                };

                const displayItems: DisplayItem[] = [];
                ownerMitigations.forEach(m => {
                    const def = MITIGATIONS.find((d) => d.id === m.mitigationId);
                    displayItems.push({ ...m, isVirtual: false, parentId: null });

                    if (def?.id === 'horoscope') {
                        const heliosEvents = ownerMitigations.filter((am) =>
                            (am.mitigationId === 'aspected_helios' || am.mitigationId === 'helios_conjunction') &&
                            am.ownerId === m.ownerId &&
                            am.time >= m.time &&
                            am.time < m.time + m.duration
                        );
                        heliosEvents.forEach(he => {
                            const displayTime = he.time + 1;
                            displayItems.push({
                                ...he,
                                id: `virtual-horo-${he.id}`,
                                time: displayTime,
                                duration: 29,
                                mitigationId: m.mitigationId,
                                isVirtual: true,
                                iconOverride: "/icons/horoscope_helios.png",
                                parentId: m.id
                            });
                        });
                    }
                    if (def?.id === 'earthly_star') {
                        const giantTime = m.time + 10;
                        if (giantTime < m.time + m.duration) {
                            displayItems.push({
                                ...m,
                                id: `virtual-giant-${m.id}`,
                                time: giantTime,
                                duration: m.duration - 10,
                                isVirtual: true,
                                iconOverride: "/icons/Giant_Dominance.png",
                                parentId: m.id
                            });
                        }
                    }
                    if (def && isLivingDeadStyle(def)) {
                        const tT = livingDeadTriggers.get(m.id);
                        if (tT !== undefined) {
                            // 原則、死亡時刻 tT(=致死被弾でウォーキングデッド発動)ちょうどに白黒アイコンを表示。
                            // 例外: tT がリビデ詠唱時刻(m.time)と同時刻=「使った瞬間に死亡」のときだけ、親リビデアイコンと
                            // 同じセルで重なるため 1 行下げる(ホロスコープ→ヘリオスの +1 と同じ重なり回避)。
                            // 効果窓の終端 tT+walkingDeadDuration は不変(下げた分 duration を縮める)。
                            const wdStart = tT === m.time ? tT + 1 : tT;
                            displayItems.push({
                                ...m,
                                id: `virtual-wd-${m.id}`,
                                time: wdStart,
                                duration: Math.max(1, def.walkingDeadDuration! - (wdStart - tT)),
                                isVirtual: true,
                                iconOverride: def.icon,
                                grayscale: true,
                                parentId: m.id,
                            });
                        }
                    }
                });

                // 時刻順を最優先 — 旧実装は recast 順を最優先していたため、 後の時刻に置かれた
                // 短 recast の異時刻アイコンが先に配置され、 先の時刻の長 recast アイコンが
                // 後から衝突回避で右にずれる現象が起きていた。 時刻順に並べることで「先に置いた
                // アイコンが後で押されない」 を保証する。
                displayItems.sort((a, b) => {
                    if (a.time !== b.time) return a.time - b.time;
                    // 同時刻のみタイブレーカー: horoscope/earthly_star (親) を先に
                    const isA_Base = a.mitigationId === 'horoscope' || a.mitigationId === 'earthly_star';
                    const isB_Base = b.mitigationId === 'horoscope' || b.mitigationId === 'earthly_star';
                    if (isA_Base && !isB_Base) return -1;
                    if (!isA_Base && isB_Base) return 1;
                    // 同時刻 / 同種別なら recast 短い順 → id 順
                    const rA = getRecast(a.mitigationId);
                    const rB = getRecast(b.mitigationId);
                    if (rA !== rB) return rA - rB;
                    return a.mitigationId.localeCompare(b.mitigationId);
                });

                const PLACEMENT_STEP = 12;
                const FULL_LANE_WIDTH = 24;
                const HALF_LANE_WIDTH = 12;
                const ICON_WIDTH = 24;
                const VISUAL_OFFSET = 2;  // 列左端からアイコンまでの視覚的オフセット (= 列幅設計の左右余白 L)
                const member = partyMembers.find(m => m.id === ownerMitigations[0]?.ownerId);
                const layout = memberLayout.get(ownerMitigations[0]?.ownerId);
                // 初回マウント時 layout 未確定 (refs が null) のため fallback 値で 1 フレーム描画。 2pass 目で実測値に上書きされる
                // セッション 17: T/H=151 (N=6 対称), DPS=53 (N=2 維持)
                // 詳細は src/styles/base/tokens-columns.css のコメント参照
                const fallbackColWidth = member?.role === 'tank' || member?.role === 'healer' ? 151 : 53;
                const colStart = layout?.left ?? 0;
                const colWidth = layout?.width ?? fallbackColWidth;
                // アイコン右端を「列右端 - VISUAL_OFFSET」 にキャップするため、 配置可能な最大 left は colWidth - VISUAL_OFFSET - ICON_WIDTH
                const MAX_LEFT = colWidth - VISUAL_OFFSET - ICON_WIDTH;
                // スプシ表示: 1 スキル = 1 列。レーン詰め(Phase 1)は通さず、列番号から left を決める
                const ownerSheetCols = sheetColumnMap ? (sheetColumnMap.get(ownerMitigations[0]?.ownerId) ?? []) : null;

                // ── Phase 1: 全アイコンの配置位置 (candidateLeft) を確定 ──
                // 既存のレーン詰めロジックを Phase 1 として分離。 時間重複を avoid して左から詰める
                const assignedPositions: { m: DisplayItem, left: number }[] = [];

                if (!ownerSheetCols) displayItems.forEach(mitigation => {
                    // duration:0 のマーカー(挑発等)も最低1行分の footprint を持つ扱いにし、
                    // 同時刻の他アイコンとの重なり回避(レーン分け)を効かせる
                    const ovDur = (d: number) => Math.max(1, d);
                    const timeOverlaps = assignedPositions.filter(a =>
                        (a.m.time < mitigation.time + ovDur(mitigation.duration)) &&
                        (a.m.time + ovDur(a.m.duration) > mitigation.time)
                    );

                    let candidateLeft = 0;
                    if (mitigation.isVirtual) {
                        const parentPos = assignedPositions.find(a => a.m.id === mitigation.parentId);
                        if (parentPos) {
                            candidateLeft = parentPos.left;
                        }
                    } else {
                        while (candidateLeft <= MAX_LEFT) {
                            const hasCollision = timeOverlaps.some(a => {
                                if (a.m.isVirtual && a.m.parentId === mitigation.id) return false;
                                const isSameTime = Math.abs(a.m.time - mitigation.time) < 1;
                                const threshold = isSameTime ? FULL_LANE_WIDTH : HALF_LANE_WIDTH;
                                return Math.abs(a.left - candidateLeft) < threshold;
                            });
                            if (!hasCollision) break;
                            candidateLeft += PLACEMENT_STEP;
                        }
                    }

                    if (candidateLeft > MAX_LEFT) candidateLeft = MAX_LEFT;

                    assignedPositions.push({ m: mitigation, left: candidateLeft });
                });

                // ── Phase 2: rendering ──
                // 列幅自体を「左右余白 2px + N×ICON_WIDTH」 で対称設計しているため、
                // クラスタシフトは不要 (T/H=124 / DPS=52 で N=5 / N=2 が完全フィット)。
                const positionByMitId = new Map<string, number>();
                assignedPositions.forEach(p => positionByMitId.set(p.m.id, p.left));

                displayItems.forEach(mitigation => {
                    const candidateLeft = positionByMitId.get(mitigation.id) ?? 0;

                    // スプシ表示: 描く列(仮想アイテムは親の配置の列)。どの列にも寄せられなければ描かない
                    let sheetLeft: number | null = null;
                    if (ownerSheetCols) {
                        const colMitId = mitigation.isVirtual
                            ? (displayItems.find(d => d.id === mitigation.parentId)?.mitigationId ?? mitigation.mitigationId)
                            : mitigation.mitigationId;
                        const ci = sheetColumnIndex(ownerSheetCols, colMitId, MITIGATIONS);
                        if (ci < 0) {
                            if (import.meta.env.DEV) console.warn('[sheet] no column', mitigation.mitigationId);
                            return;
                        }
                        sheetLeft = sheetIconLeft(colStart, ci);
                    }

                    const durationSeconds = Math.max(1, mitigation.duration);
                    const durationEndTime = mitigation.time + durationSeconds - 1;

                    // コンパクトモード: 終了時間が空行なら、その前の可視行に切り詰める
                    let effectiveEndTime = durationEndTime;
                    if (hideEmptyRows) {
                        const isEndVisible = eventsByTime.has(durationEndTime) || mitStartsByTime.has(durationEndTime);
                        if (!isEndVisible) {
                            // durationEndTime以下の最大の可視行を探す
                            let prevVisible = mitigation.time;
                            for (let t = durationEndTime; t >= mitigation.time; t--) {
                                if (eventsByTime.has(t) || mitStartsByTime.has(t)) {
                                    prevVisible = t;
                                    break;
                                }
                            }
                            effectiveEndTime = prevVisible;
                        }
                    }
                    // エフェクト棒もタイムライン末尾 (= maxTime = 行追加用空白行) でクリップ。
                    // 持続時間の長い学者スキル (鼓舞 30s 等) が末尾を超えて伸びる問題を防ぐ。
                    effectiveEndTime = Math.min(effectiveEndTime, maxTime);

                    // 縦位置はすべて rowLayout から(行の高さが攻撃数で変わっても帯が正しく伸びる)。
                    // top = 開始の秒の行の上端(MitigationItem の基準)。帯は最上段の中央(アイコン中央)から、
                    // 「効果がかかる最後の秒」の行の下端の 1px 上まで。
                    const top = rowLayout.topOf(mitigation.time);
                    const barTop = barStartY(rowLayout, mitigation.time);
                    const def = MITIGATIONS.find((m) => m.id === mitigation.mitigationId);
                    let height = Math.max(0, Math.round(barEndY(rowLayout, effectiveEndTime) - barTop));

                    if (!mitigation.isVirtual) {
                        if (def?.id === 'horoscope') {
                            const heliosInHoro = displayItems.filter((am) =>
                                am.isVirtual && am.parentId === mitigation.id
                            ).sort((a, b) => a.time - b.time);
                            if (heliosInHoro.length > 0) {
                                height = Math.max(0, Math.round(childIconCutY(rowLayout, heliosInHoro[0].time) - barTop));
                            }
                        }
                        if (def?.id === 'earthly_star' && durationSeconds > 10) {
                            height = Math.max(0, Math.round(childIconCutY(rowLayout, mitigation.time + 10) - barTop));
                        }
                        if (def && isLivingDeadStyle(def)) {
                            // WD 仮想アイコンの実際の開始(tT、重なり回避時は tT+1)で親バーを切る(ホロスコープと同じく仮想の time を参照)。
                            const wd = displayItems.find((am) => am.isVirtual && am.parentId === mitigation.id);
                            if (wd) {
                                height = Math.max(0, Math.round(childIconCutY(rowLayout, wd.time) - barTop));
                            }
                        }
                        // バリア(シールド)が吸収量を使い切ったら、その時点で棒を止める。
                        // スタック制シールド(ハイマ等)は damageMapResult 側で除外済み(壊れても継続扱い)。
                        // バリア + 持続 % 軽減の複合スキル(ホーリズム/原初の血気・猛り)は棒を切らない
                        // (バリアが割れても効果時間いっぱい % 軽減が乗り続けるため・2026-08-31 実機報告)。
                        // 既存の horoscope/earthly_star/WD クリップとは Math.min で共存させる。
                        if (def && shieldEffectBarEndsOnBarrierExhaustion(def) && shieldExhaustedAt.has(mitigation.id)) {
                            height = Math.min(height, Math.max(0, Math.round(barEndY(rowLayout, shieldExhaustedAt.get(mitigation.id)!) - barTop)));
                        }
                        // 上書き負けしたバリア: 負けた時刻で棒を止める(方式a)。overwritten に入るのはバリアのみなので def?.isShield 判定は不要。
                        if (barrierOverwrittenAt.has(mitigation.id)) {
                            height = Math.min(height, Math.max(0, Math.round(barEndY(rowLayout, barrierOverwrittenAt.get(mitigation.id)!) - barTop)));
                        }
                    }

                    const absoluteLeft = sheetLeft ?? colStart + VISUAL_OFFSET + candidateLeft;

                    renderedItems.push(
                        <MitigationItem
                            key={mitigation.id}
                            mitigation={mitigation}
                            rowLayout={rowLayout}
                            onRemove={(mitigation.isVirtual || readOnly) ? () => { } : removeMitigation}
                            onUpdateTime={(mitigation.isVirtual || readOnly) ? () => { } : updateMitigationTime}
                            top={top}
                            height={height}
                            left={absoluteLeft}
                            laneIndex={candidateLeft / PLACEMENT_STEP}
                            partySortOrder={partySortOrder}
                            scrollContainerRef={scrollContainerRef}
                            activeMitigations={ownerMitigations}
                            overlapOffset={0}
                            isVirtual={mitigation.isVirtual}
                            grayscale={mitigation.grayscale}
                            iconOverride={mitigation.iconOverride}
                            layoutReady={layout !== undefined}
                            isConflicting={conflictingIds.has(mitigation.id) && mitigation.id !== lastPlacedMitigationId}
                            onCellClick={handleCellClick}
                            slideOnSort={isMilspecTable}
                            iconPx={ownerSheetCols ? SHEET_ICON_PX : undefined}
                            onIconTap={ownerSheetCols && !mitigation.isVirtual ? handleCellClick : undefined}
                        />
                    );
                });

                // スプシ表示: リキャスト線(配置 1 件ごと・共有リキャストの列にも)
                if (ownerSheetCols) {
                    const ownerId = ownerMitigations[0]?.ownerId;
                    const ownerUses = timelineMitigations.filter(m => m.ownerId === ownerId);
                    // 線を引くのは「表に列がある配置」だけ(列が見つからない自動配置のドロー等は、押せるマス自体が無いので線も出さない)
                    const lineItems = placementsWithColumn(ownerUses, ownerSheetCols, MITIGATIONS);
                    renderedItems.push(
                        <SheetCooldownLines
                            key={`sheet-cd-${ownerId}`}
                            // autoHidden(戦闘前の自動配置)も判定(validateMitigationPlacement)には含まれるので線も引く。
                            // 表の折りたたみ(hideEmptyRows)で ownerMitigations から外れていても、持ち主の全配置から引く(ただし列がある配置だけ)
                            items={lineItems}
                            ownerUses={ownerUses}
                            cols={ownerSheetCols}
                            defs={MITIGATIONS}
                            colStart={colStart}
                            layout={rowLayout}
                            maxTime={maxTime}
                            isRowVisible={(t) => !hideEmptyRows || eventsByTime.has(t) || mitStartsByTime.has(t)}
                            layoutReady={layout !== undefined}
                        />
                    );
                }
            });

    return <>{renderedItems}</>;
};
