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
 */
function sortedEntries(timeToYMap: Map<number, number>): Array<[number, number]> {
    return Array.from(timeToYMap.entries()).sort((a, b) => a[0] - b[0]);
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
    // 隣接 entry の間で補間
    for (let i = 0; i < entries.length - 1; i++) {
        const [t0, y0] = entries[i];
        const [t1, y1] = entries[i + 1];
        if (timeSec >= t0 && timeSec <= t1) {
            const ratio = (timeSec - t0) / (t1 - t0);
            return y0 + ratio * (y1 - y0);
        }
    }
    return entries[entries.length - 1][1];
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
    for (let i = 0; i < entries.length - 1; i++) {
        const [t0, y0] = entries[i];
        const [t1, y1] = entries[i + 1];
        if (yPx >= y0 && yPx <= y1) {
            const ratio = y1 === y0 ? 0 : (yPx - y0) / (y1 - y0);
            return t0 + ratio * (t1 - t0);
        }
    }
    return entries[entries.length - 1][0];
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
