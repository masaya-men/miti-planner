/** バーコードの計算(見本 barH / ヘッダー SN js:876): 偶数番目だけ黒線、各線の幅 = 値×k、間隔 k(既定 k=0.7)。h は描画高さで幅計算には影響しない */
export function barcodeRects(_h: number, bars: number[] = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1], k = 0.7): { w: number; rects: { x: number; w: number }[] } {
  let x = 0;
  const rects: { x: number; w: number }[] = [];
  bars.forEach((w, i) => {
    if (i % 2 === 0) rects.push({ x, w: w * k });
    x += w * k + k;
  });
  return { w: x, rects };
}
