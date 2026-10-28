// クライアント側レート制限: 1時間あたり最大15回
export const IMPORT_RATE_LIMIT = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間

function getImportTimestamps(): number[] {
    try {
        const raw = localStorage.getItem('fflogs-import-timestamps');
        if (!raw) return [];
        return JSON.parse(raw) as number[];
    } catch {
        return [];
    }
}

export function recordImport(): void {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const timestamps = getImportTimestamps().filter(t => t > cutoff);
    timestamps.push(now);
    localStorage.setItem('fflogs-import-timestamps', JSON.stringify(timestamps));
}

export function getRemainingImports(): number {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    const recentCount = getImportTimestamps().filter(t => t > cutoff).length;
    return Math.max(0, IMPORT_RATE_LIMIT - recentCount);
}
