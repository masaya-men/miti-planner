export const LAST_OPENED_KEY = 'plan-last-opened';

/** localStorage から lastOpenedAt マップを取得 */
export function getLastOpenedMap(): Record<string, number> {
    try {
        const raw = localStorage.getItem(LAST_OPENED_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** 指定プランの lastOpenedAt を更新 */
export function setLastOpened(planId: string, timestamp: number): void {
    const map = getLastOpenedMap();
    map[planId] = timestamp;
    localStorage.setItem(LAST_OPENED_KEY, JSON.stringify(map));
}

/**
 * 指定日数以上開かれていないプランIDを返す
 * lastOpenedAt が未記録のプランも対象
 */
export function getStalePlanIds(planIds: string[], days: number): string[] {
    const map = getLastOpenedMap();
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return planIds.filter(id => {
        const lastOpened = map[id];
        return lastOpened === undefined || lastOpened < threshold;
    });
}
