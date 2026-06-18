import type { DailyBest, PlanProgress } from '../types';

/** Date → 'YYYY-MM-DD' (JST = UTC+9) */
export function makeDayKey(date: Date): string {
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const y = jst.getUTCFullYear();
    const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(jst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** 同日は最高到達点に統合し、日付昇順で返す */
export function mergeDailyBest(list: DailyBest[], entry: DailyBest): DailyBest[] {
    const map = new Map<string, number>();
    for (const d of list) map.set(d.day, Math.max(map.get(d.day) ?? -Infinity, d.reachedPos));
    map.set(entry.day, Math.max(map.get(entry.day) ?? -Infinity, entry.reachedPos));
    return Array.from(map.entries())
        .map(([day, reachedPos]) => ({ day, reachedPos }))
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

export function removeDay(list: DailyBest[], day: string): DailyBest[] {
    return list.filter(d => d.day !== day);
}

/** 最高到達点 / 全長 * 100（cleared は 100）。0〜100 に丸めクランプ */
export function computeProgressPercent(progress: PlanProgress | undefined, timelineTotalSec: number): number {
    if (!progress) return 0;
    if (progress.cleared) return 100;
    if (timelineTotalSec <= 0 || progress.dailyBest.length === 0) return 0;
    const best = Math.max(...progress.dailyBest.map(d => d.reachedPos));
    return Math.max(0, Math.min(100, Math.round((best / timelineTotalSec) * 100)));
}

export function isEmptyProgress(progress: PlanProgress | undefined): boolean {
    if (!progress) return true;
    return (
        progress.dailyBest.length === 0 &&
        !progress.cleared &&
        progress.activeDays === undefined &&
        progress.activeHours === undefined
    );
}
