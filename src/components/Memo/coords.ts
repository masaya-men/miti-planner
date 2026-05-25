/**
 * Memo 座標変換ヘルパ。
 *
 * LoPo 軽減表は縦軸 = 時間 (Timeline.tsx で y = (time - offsetTime) * pixelsPerSecond)、
 * 横軸 = パーティーメンバー横並び。 メモはシート上の任意 (timeSec, xRatio) に置く。
 *
 * - timeSec: 連続値の秒数 (= 縦座標の絶対値、 ウィンドウ縦サイズ変わっても保たれる)
 * - xRatio:  シート横幅に対する 0.0〜1.0 比率 (= ウィンドウ幅変わっても比例追従)
 */

export interface MemoCoords {
    timeSec: number;
    xRatio: number;
}

/** y 座標 (px) → timeSec。 Timeline.tsx の y = (time - offsetTime) * pixelsPerSecond の逆 */
export function pxToTimeSec(yPx: number, pixelsPerSecond: number, offsetTime: number): number {
    if (pixelsPerSecond <= 0) return offsetTime;
    return yPx / pixelsPerSecond + offsetTime;
}

/** timeSec → y 座標 (px)。 Timeline.tsx と同じ計算 */
export function timeSecToPx(timeSec: number, pixelsPerSecond: number, offsetTime: number): number {
    return (timeSec - offsetTime) * pixelsPerSecond;
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

/**
 * 座標を [0, maxTime] × [0, 1] にクランプ (画面外配置防止)。
 *
 * v1 仕様: timeSec の下限は 0 固定 = preStart 領域 (offsetTime=-10〜0) にはメモを置けない。
 * preStart にもメモを置きたい要望が出たら minTime 引数を追加する。
 */
export function clampMemoCoords(coords: MemoCoords, maxTime: number): MemoCoords {
    return {
        timeSec: Math.max(0, Math.min(maxTime, coords.timeSec)),
        xRatio: Math.max(0, Math.min(1, coords.xRatio)),
    };
}
