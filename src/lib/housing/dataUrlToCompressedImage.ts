/**
 * data URL (= `data:image/webp;base64,...`) から `CompressedImage` を組み立てる
 * (2026-05-26 新設、 Twitter 動画フレーム抽出からの取り込み経路用)。
 *
 * - `extractVideoFrames` は canvas.toDataURL で WebP 0.75 の data URL を返す。
 * - 既存 `compressHousingImage` は File → CompressedImage を作るが、 動画フレームは
 *   既に compressed 済の dataURL でファイル経由しない。 そこで「data URL → File」
 *   の変換を一手に引き受ける薄い util として分離。
 *
 * 設計判断: ファイル名は `tweet-frame-<index>.webp` でユニーク化。 同じ tweet
 *   から 3 枚連続抽出する想定なので index を caller が渡す。
 */
import type { CompressedImage } from './imageCompression';

const DATA_URL_RE = /^data:([^;]+);base64,(.+)$/;

export function dataUrlToCompressedImage(dataUrl: string, fileName: string): CompressedImage {
    const match = DATA_URL_RE.exec(dataUrl);
    if (!match) throw new Error('invalid data URL');
    const mimeType = match[1];
    const base64 = match[2];

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });

    return {
        base64,
        mimeType,
        file,
        originalBytes: file.size,
        compressedBytes: file.size,
    };
}
