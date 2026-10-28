/**
 * 秒 → "M:SS"(負数は先頭に "-")。秒の小数部は切り捨てずそのまま出す(例 5.5 → "0:5.5")。
 * 小数を切り捨てたい表示は templateConversions.formatTime を使う。
 */
export function formatTimeKeepFraction(seconds: number): string {
    const abs = Math.abs(seconds);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${seconds < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}
