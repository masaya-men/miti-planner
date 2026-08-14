/**
 * Memo 座標変換ヘルパ。
 *
 * LoPo 軽減表は縦軸 = 時間で「行ごとに高さが動的」 ([Timeline.tsx:2409] の sheet container
 * height は gridLines を累積した動的計算)。 そのため線形変換 (y = time × pps) は使えず、
 * Timeline が持つ `timeToYMap` (Map<time, y>) を逆引きする必要がある。
 *
 * - timeSec: 連続値の秒数 (= 時間軸上の絶対値)
 * - xRatio:  シート横幅に対する 0.0〜1.0 比率
 */

export interface MemoCoords {
    timeSec: number;
    xRatio: number;
}

/**
 * timeToYMap (time → y) を時刻昇順の配列に変換。
 * gridLines が含む全 time に対応する y を返す (gridLines 順で y も増加)。
 *
 * timeSecToY/yToTimeSec は Timeline.tsx のスクロールハンドラから毎スクロールイベントで
 * 呼ばれるため、ここを Map オブジェクト参照キーの WeakMap でキャッシュする(2026-08-14
 * ユーザー実機報告「スマホでスクロールが重い」の実測プロファイルで、この毎回の配列化+
 * ソートがスクロール処理の体感重さの大半を占めていたと判明)。
 * timeToYMapRef.current は常に新しい Map インスタンスへの丸ごと差し替えでのみ更新され
 * (in-place の set/delete は無い)、内容が変わるときは必ず参照も変わるため、参照キーの
 * キャッシュが古い結果を返すことはない。
 */
const sortedEntriesCache = new WeakMap<Map<number, number>, Array<[number, number]>>();
function sortedEntries(timeToYMap: Map<number, number>): Array<[number, number]> {
    const cached = sortedEntriesCache.get(timeToYMap);
    if (cached) return cached;
    const sorted = Array.from(timeToYMap.entries()).sort((a, b) => a[0] - b[0]);
    sortedEntriesCache.set(timeToYMap, sorted);
    return sorted;
}

/**
 * timeSec → y (px)。 動的高さに対応するため、 隣接する gridLine の間で線形補間。
 * map に直接ある time なら map の値を返す。 maxTime を超える / 最小未満は端の値にクランプ。
 */
export function timeSecToY(timeSec: number, timeToYMap: Map<number, number>): number {
    const entries = sortedEntries(timeToYMap);
    if (entries.length === 0) return 0;
    if (timeSec <= entries[0][0]) return entries[0][1];
    if (timeSec >= entries[entries.length - 1][0]) return entries[entries.length - 1][1];
    // 隣接 entry の間で補間。entries は time 昇順なので二分探索で区間を求める
    // (2026-08-14、毎スクロールイベントで呼ばれるため全走査版は負荷が大きかった)。
    let lo = 0, hi = entries.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (entries[mid][0] <= timeSec) lo = mid; else hi = mid;
    }
    const [t0, y0] = entries[lo];
    const [t1, y1] = entries[hi];
    const ratio = t1 === t0 ? 0 : (timeSec - t0) / (t1 - t0);
    return y0 + ratio * (y1 - y0);
}

/**
 * y (px) → timeSec。 timeSecToY の逆。 隣接する gridLine の間で線形補間。
 * sheet 範囲外 (yPx < 最初の y, yPx > 最後の y) なら null を返す = メモ作成不可。
 */
export function yToTimeSec(yPx: number, timeToYMap: Map<number, number>): number | null {
    const entries = sortedEntries(timeToYMap);
    if (entries.length === 0) return null;
    if (yPx < entries[0][1]) return null;
    if (yPx > entries[entries.length - 1][1]) return null;
    // entries は time 昇順 = y も昇順(gridLines順でyも増加)なので、yPx でも二分探索できる。
    let lo = 0, hi = entries.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (entries[mid][1] <= yPx) lo = mid; else hi = mid;
    }
    const [t0, y0] = entries[lo];
    const [t1, y1] = entries[hi];
    const ratio = y1 === y0 ? 0 : (yPx - y0) / (y1 - y0);
    return t0 + ratio * (t1 - t0);
}

/**
 * 表の展開/折りたたみ (動的高さの変化) の前後でスクロールのアンカーを維持するための
 * 新しい scrollTop を求める。anchorTimeSec を新しい timeToYMap で y に変換し、
 * その時刻がビューポート中央に来るよう clientHeight の半分を引く (0 未満は 0 にクランプ)。
 * 高さが変わっても「見ていた時刻」が画面中央付近に留まる。
 */
export function reanchorScrollTop(
    anchorTimeSec: number,
    timeToYMap: Map<number, number>,
    clientHeight: number,
): number {
    const centerY = timeSecToY(anchorTimeSec, timeToYMap);
    return Math.max(0, centerY - clientHeight / 2);
}

/** x 座標 (px) → xRatio (0〜1) */
export function pxToXRatio(xPx: number, widthPx: number): number {
    if (widthPx <= 0) return 0;
    return xPx / widthPx;
}

/** xRatio (0〜1) → x 座標 (px) */
export function xRatioToPx(xRatio: number, widthPx: number): number {
    return xRatio * widthPx;
}

/** xRatio を [0, 1] にクランプ。 横軸は完全自由なので clamp で OK。 */
export function clampXRatio(xRatio: number): number {
    return Math.max(0, Math.min(1, xRatio));
}
