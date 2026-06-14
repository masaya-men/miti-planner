import type { TimelineEvent, Mitigation } from '../types';

/** イベントが「デバフ軽減不可」かつ当該軽減がデバフ系なら、% 軽減をブロックする。 */
export function isMitigationBlockedByEvent(
  event: Pick<TimelineEvent, 'ignoresDebuffMitigation'>,
  mitigation: Pick<Mitigation, 'appliesAsDebuff'>,
): boolean {
  return !!(event.ignoresDebuffMitigation && mitigation.appliesAsDebuff);
}

/** タイムラインの種別クリックループ順。循環外の値は physical に寄せる。 */
const DAMAGE_TYPE_CYCLE: Array<TimelineEvent['damageType']> = ['physical', 'magical', 'unavoidable'];

export function nextDamageType(current: TimelineEvent['damageType']): TimelineEvent['damageType'] {
  const i = DAMAGE_TYPE_CYCLE.indexOf(current);
  return DAMAGE_TYPE_CYCLE[(i + 1) % DAMAGE_TYPE_CYCLE.length]; // i=-1 のとき (i+1)=0 → physical
}
