// 画像要素 → 16×16 の RGBA(1024 要素)。ブラウザ専用(canvas)。
// AllMarks の readDownscaled(canvas, 16) と同じ考え方。CORS で許可されていない画像は
// 「汚染された canvas」になり getImageData が例外を投げる → 呼び出し側で null(= 確認中のまま)にする。
export const COLOR_SAMPLE_SIZE = 16;

export function readPixels16(img: CanvasImageSource): Uint8ClampedArray {
    const canvas = document.createElement('canvas');
    canvas.width = COLOR_SAMPLE_SIZE;
    canvas.height = COLOR_SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img, 0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE);
    return ctx.getImageData(0, 0, COLOR_SAMPLE_SIZE, COLOR_SAMPLE_SIZE).data;
}
