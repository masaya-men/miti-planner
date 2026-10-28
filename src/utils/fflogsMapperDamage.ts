import type { TimelineEvent } from '../types';
import { roundDamageCeil } from './damageRounding';
import { DAMAGE_VARIANCE_BUFFER } from './fflogsMapperBasics';
import type { Norm } from './fflogsMapperTypes';

// ─────────────────────────────────────────────
// ダメージ算出
// ─────────────────────────────────────────────

/** TB用: max × 1.05 */
export function computeTBDamage(hits: Norm[]): number {
    if (hits.length === 0) return 0;
    const max = Math.max(...hits.map(n => n.rawDmg));
    return Math.floor(max * DAMAGE_VARIANCE_BUFFER);
}

/** AoE用: タンク除外 → multiplier多数派 → max × 1.05 */
export function computeAoEDamage(hits: Norm[]): number {
    if (hits.length === 0) return 0;
    if (hits.length === 1) return Math.floor(hits[0].rawDmg * DAMAGE_VARIANCE_BUFFER);

    // multiplierの最頻値を取得（バフ/デバフ持ちを除外）
    const counts = new Map<number, number>();
    for (const h of hits) counts.set(h.multiplier, (counts.get(h.multiplier) || 0) + 1);
    let bestMult = hits[0].multiplier;
    let bestCount = 0;
    for (const [mult, count] of counts) {
        if (count > bestCount || (count === bestCount && mult > bestMult)) {
            bestMult = mult;
            bestCount = count;
        }
    }
    const normal = hits.filter(h => h.multiplier === bestMult);
    const pool = normal.length > 0 ? normal : hits;
    return Math.floor(Math.max(...pool.map(n => n.rawDmg)) * DAMAGE_VARIANCE_BUFFER);
}

/** 同名技のダメージを統一（V5.0） */
export function unifyDamageForSameAbility(tl: TimelineEvent[]): void {
    const DEVIATION_THRESHOLD = 0.20;

    const groups = new Map<string, number[]>();
    for (let i = 0; i < tl.length; i++) {
        const ev = tl[i];
        if (!ev.damageAmount || ev.name.ja === 'AA' || ev.name.en === 'AA') continue;
        const isTB = ev.target === 'MT' || ev.target === 'ST';
        const key = isTB
            ? `${ev.name.ja}::TB`
            : `${ev.name.ja}::${ev.target ?? 'AoE'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(i);
    }

    for (const [, indices] of groups) {
        if (indices.length < 2) continue;
        const values = indices.map(i => tl[i].damageAmount!);
        const maxVal = Math.max(...values);
        const med = median(values);
        if (med === 0) continue;

        const hasTB = indices.some(i => tl[i].target === 'MT' || tl[i].target === 'ST');
        if (hasTB) {
            const unified = roundDamageCeil(maxVal);
            for (const i of indices) tl[i].damageAmount = unified;
            continue;
        }

        const allClose = values.every(v => Math.abs(v - med) / med <= DEVIATION_THRESHOLD);
        if (allClose) {
            const unified = roundDamageCeil(med);
            for (const i of indices) tl[i].damageAmount = unified;
        }
    }
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? Math.floor((s[mid - 1] + s[mid]) / 2) : s[mid];
}
