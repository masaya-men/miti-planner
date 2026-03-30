/**
 * テキスト → パーティクル座標ユーティリティ
 *
 * Pretextでテキストメトリクスを事前計算し、オフスクリーンCanvasに描画。
 * 不透明ピクセルをサンプリングしてThree.jsワールド座標に変換する。
 * パーティクル集合アニメーション用。
 */
import { prepare, layout } from '@chenglou/pretext';

export interface TextParticleTargets {
  /** x, y ペアの配列（length = particleCount * 2） */
  positions: Float32Array;
  /** テキストのワールド座標幅 */
  textWidth: number;
  /** テキストのワールド座標高さ */
  textHeight: number;
}

/**
 * テキストからパーティクルターゲット座標を生成
 *
 * @param text - 描画するテキスト（例: "LoPo"）
 * @param font - CSSフォント指定（例: "bold 200px 'M PLUS 1'"）
 * @param particleCount - パーティクル数
 * @param viewWidth - カメラのビュー幅（ワールド座標）
 * @param viewHeight - カメラのビュー高さ（ワールド座標）
 */
export function generateTextTargets(
  text: string,
  font: string,
  particleCount: number,
  viewWidth: number,
  viewHeight: number,
): TextParticleTargets {
  // --- Pretextでテキストメトリクスを事前計算 ---
  const prepared = prepare(text, font);
  const textMetrics = layout(prepared, 9999, 1.0); // 1行想定（十分な幅を確保）

  // --- オフスクリーンCanvasにテキストを描画 ---
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Pretextのメトリクスと Canvas measureText を併用してピクセルサイズを決定
  ctx.font = font;
  const canvasMetrics = ctx.measureText(text);
  const textPixelWidth = canvasMetrics.width;
  // Pretextの高さ情報を優先的に使用、フォールバックはCanvas計測
  const textPixelHeight = textMetrics.height > 0
    ? textMetrics.height
    : (canvasMetrics.actualBoundingBoxAscent ?? 160) +
      (canvasMetrics.actualBoundingBoxDescent ?? 40);

  // 2倍解像度でキャンバスを確保（余白付き）
  const scale = 2;
  const padding = 20;
  const cw = Math.ceil(textPixelWidth * scale) + padding * 2;
  const ch = Math.ceil(textPixelHeight * scale) + padding * 2;
  canvas.width = cw;
  canvas.height = ch;

  // 描画
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, cw, ch);
  // scale倍のフォントサイズで描画
  const fontSizeMatch = font.match(/(\d+)px/);
  const baseFontSize = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 200;
  ctx.font = font.replace(`${baseFontSize}px`, `${baseFontSize * scale}px`);
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'top';
  ctx.fillText(text, padding, padding);

  // --- 不透明ピクセルをサンプリング ---
  const imageData = ctx.getImageData(0, 0, cw, ch);
  const pixels = imageData.data;
  const step = 2; // 2ピクセルごとにサンプリング
  const opaquePixels: { x: number; y: number }[] = [];

  for (let y = 0; y < ch; y += step) {
    for (let x = 0; x < cw; x += step) {
      const idx = (y * cw + x) * 4;
      // R チャンネルで白判定（alpha > 128 相当）
      if (pixels[idx] > 128) {
        opaquePixels.push({ x, y });
      }
    }
  }

  // --- ピクセル座標 → ワールド座標に変換 ---
  // テキストがビュー幅の60%を占めるようスケール（高さがビューを超える場合は縮小）
  const maxWorldWidth = viewWidth * 0.6;
  const maxWorldHeight = viewHeight * 0.5;
  const scaleByWidth = maxWorldWidth / (textPixelWidth * scale);
  const scaleByHeight = maxWorldHeight / (textPixelHeight * scale);
  const worldScale = Math.min(scaleByWidth, scaleByHeight);
  const worldTextWidth = textPixelWidth * scale * worldScale;
  const worldTextHeight = textPixelHeight * scale * worldScale;

  // キャンバス中央をワールド原点にマッピング
  const halfCw = cw / 2;
  const halfCh = ch / 2;

  // 不透明ピクセルをワールド座標に変換
  const worldPixels = opaquePixels.map(p => ({
    x: (p.x - halfCw) * worldScale,
    y: -(p.y - halfCh) * worldScale, // Y軸反転（Canvas→Three.js）
  }));

  // --- particleCount 分のターゲット座標を生成 ---
  const positions = new Float32Array(particleCount * 2);

  if (worldPixels.length === 0) {
    // フォールバック: ピクセルが見つからない場合は原点
    return { positions, textWidth: worldTextWidth, textHeight: worldTextHeight };
  }

  // シャッフル（Fisher-Yates）
  for (let i = worldPixels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [worldPixels[i], worldPixels[j]] = [worldPixels[j], worldPixels[i]];
  }

  // ピクセル数が足りない場合はサイクルして割り当て
  for (let i = 0; i < particleCount; i++) {
    const px = worldPixels[i % worldPixels.length];
    positions[i * 2] = px.x;
    positions[i * 2 + 1] = px.y;
  }

  return { positions, textWidth: worldTextWidth, textHeight: worldTextHeight };
}
