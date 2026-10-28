import type { FFLogsRawEvent } from '../api/fflogsTypes';

// ─────────────────────────────────────────────
// 定数・ユーティリティ
// ─────────────────────────────────────────────

export const AA_NAMES = new Set(['Attack', 'Shot', '攻撃', 'Attaque', 'Attacke']);
export const AA_PROXIMITY_MS = 500;
export const GROUPING_WINDOW_MS = 800;
export const MERGE_WINDOW_MS = 2000;
export const DAMAGE_VARIANCE_BUFFER = 1.05;

export function isAutoAttackName(name: string): boolean {
    return AA_NAMES.has(name.trim());
}

export function mapDamageType(t: number | undefined): 'physical' | 'magical' | 'unavoidable' {
    if (t === undefined) return 'magical';
    if (t === 1 || t === 2 || t === 3 || t === 4 || t === 128) return 'physical';
    return 'magical';
}

export function getRawDamage(ev: FFLogsRawEvent): number {
    if (ev.unmitigatedAmount !== undefined && ev.unmitigatedAmount > 0) return ev.unmitigatedAmount;
    const visible = (ev.amount || 0) + (ev.absorbed || 0);
    return Math.floor(visible / Math.max(ev.multiplier || 1, 0.01));
}

export function genId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'ffl_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export function dedupe(events: FFLogsRawEvent[]): FFLogsRawEvent[] {
    const m = new Map<string, FFLogsRawEvent>();
    for (const ev of events) {
        const p = ev.packetID;
        if (p === undefined) continue;
        const key = `${p}:${ev.targetID ?? 0}`;
        const ex = m.get(key);
        if (!ex || getRawDamage(ev) > getRawDamage(ex)) m.set(key, ev);
    }
    return [...m.values(), ...events.filter(e => e.packetID === undefined)];
}
