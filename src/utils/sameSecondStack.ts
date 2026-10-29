import type { Mitigation, AppliedMitigation } from '../types';
import { effectiveMaxCharges } from './chargeTracker';

/**
 * 同じ人が同じ秒に同じ技を重ねて置けるか(masaya 10-29)。
 * 2 回分ためられて相手を選ぶ技(オブレーション・ディヴァインベニゾン・星天交差等)だけ、別の人へなら同じ秒に使える。
 * それ以外は同じ秒に 2 回は使えないので、クリックで置く道では「同じ秒の同じ技=削除」、引っぱりでは置けない。
 */
export function canStackSameSecond(def: Pick<Mitigation, 'scope' | 'maxCharges' | 'chargeMinLevel'>): boolean {
    return def.scope === 'target' && effectiveMaxCharges(def) >= 2;
}

/** 同じ秒に置いてある同じ技(渡すのは同じ人の配置) */
export function sameSecondInstances(defId: string, time: number, ownerMitigations: AppliedMitigation[]): AppliedMitigation[] {
    return ownerMitigations.filter(am => am.mitigationId === defId && am.time === time);
}

/** 相手を選ぶ画面で使う: その秒にもう相手にした人 → 配置 ID / まだ足せるか(チャージが残っているか) */
export function sameSecondTargets(def: Pick<Mitigation, 'id' | 'maxCharges' | 'chargeMinLevel'>, time: number, ownerMitigations: AppliedMitigation[]) {
    const placed = sameSecondInstances(def.id, time, ownerMitigations);
    const used = new Map<string, string>();
    placed.forEach(am => { if (am.targetId) used.set(am.targetId, am.id); });
    return { used, canAddMore: placed.length < Math.max(1, effectiveMaxCharges(def)) };
}
