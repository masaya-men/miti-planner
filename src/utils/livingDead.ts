import type { Mitigation, PartyMember, TimelineEvent } from '../types';

/** 二段階無敵(ウォーキングデッド型)か。データ駆動: isInvincible かつ walkingDeadDuration>0。 */
export function isLivingDeadStyle(def: Mitigation): boolean {
    return !!def.isInvincible && typeof def.walkingDeadDuration === 'number' && def.walkingDeadDuration > 0;
}

/** 実効ターゲットの最大HP。MT/ST は当該メンバー、それ以外は H1。見つからなければ 1。
 *  既存の致死判定 (CheatSheetView/TimelineRow/MobileTimelineRow) と同一ロジック。 */
export function maxHpForEffectiveTarget(
    effTarget: TimelineEvent['target'],
    partyMembers: PartyMember[],
): number {
    if (effTarget === 'MT' || effTarget === 'ST') {
        return partyMembers.find(m => m.id === effTarget)?.stats.hp || 1;
    }
    return partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
}

export interface LivingDeadInstance {
    id: string;                  // AppliedMitigation.id (配置インスタンス)
    time: number;                // 配置時刻
    duration: number;            // リビデ窓(=10)
    walkingDeadDuration: number; // ウォーキングデッド窓(=10)
    ownerId: string;
    targetId?: string;
}

/**
 * 1イベントを評価し、有効なリビングデッドのいずれかで生存するか判定する。
 * イベントは時刻昇順で評価されること(引き金=窓内で最初の致死を保証するため)。
 * triggers は呼び出し側が保持する可変 Map (ldInstanceId -> 引き金時刻 tT)。本関数が更新する。
 *
 * @param eventTime 評価対象イベントの時刻
 * @param mitigatedWithoutLivingDead リビデの無敵を除いた軽減後ダメージ(他軽減・他無敵適用後・バリア前)
 * @param maxHp 実効ターゲットの最大HP
 * @param livingDeads このイベントの context に適用されるリビデ全インスタンス
 * @param triggers 可変状態 (ldInstanceId -> tT)
 * @returns 生存するなら true
 */
export function resolveLivingDeadSurvival(
    eventTime: number,
    mitigatedWithoutLivingDead: number,
    maxHp: number,
    livingDeads: LivingDeadInstance[],
    triggers: Map<string, number>,
): boolean {
    let survived = false;
    for (const ld of livingDeads) {
        const tT = triggers.get(ld.id);
        if (tT !== undefined) {
            // 発動済み: ウォーキングデッド窓 [tT, tT+wd) 内なら生存
            if (eventTime >= tT && eventTime < tT + ld.walkingDeadDuration) survived = true;
        } else {
            // 未発動: リビデ窓 [time, time+duration) 内かつ致死なら、ここで発動
            const inWindow = eventTime >= ld.time && eventTime < ld.time + ld.duration;
            if (inWindow && mitigatedWithoutLivingDead > 0 && mitigatedWithoutLivingDead >= maxHp) {
                triggers.set(ld.id, eventTime);
                survived = true;
            }
        }
    }
    return survived;
}
