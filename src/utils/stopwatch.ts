/** 経過秒数を算出する純粋関数。startedAt が null なら停止中。
 *  @param accumulatedMs これまでに溜まった経過(ミリ秒)
 *  @param startedAt 計測再開時刻(performance.now 値)。停止中は null
 *  @param now 現在時刻(performance.now 値) */
export function computeElapsed(accumulatedMs: number, startedAt: number | null, now: number): number {
    const totalMs = startedAt === null ? accumulatedMs : accumulatedMs + (now - startedAt);
    return totalMs / 1000;
}

/** 捕捉した小数秒を最も近い整数秒へ丸める。
 *  タイムラインは整数秒グリッド (gridLines) で行を生成し eventsByTime.get(整数) で
 *  完全一致照合するため、小数秒のままだと行に乗らず描画されない。 .5 は繰り上げ。 */
export function snapToSecond(seconds: number): number {
    return Math.round(seconds);
}

/** 秒(小数可)を MM:SS.CC 形式へ。端数は切り捨て(伸ばさない)。 */
export function formatStopwatch(seconds: number): string {
    const safe = Math.max(0, seconds);
    const totalCentis = Math.floor(safe * 100);
    const cc = totalCentis % 100;
    const totalSecs = Math.floor(totalCentis / 100);
    const ss = totalSecs % 60;
    const mm = Math.floor(totalSecs / 60);
    const p2 = (n: number) => n.toString().padStart(2, '0');
    return `${p2(mm)}:${p2(ss)}.${p2(cc)}`;
}
