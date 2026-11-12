// 画像の URL / ファイル → 色(colorFamilies + colorRule)。計算はすべて利用者(管理者)のブラウザ。
// 失敗(CORS・画像消失・読めない形式)は null: 保存せず「色を確認中」のままにする。
import { extractPalette, PALETTE_RULE } from './housingExtractPalette';
import { readPixels16 } from './housingColorPixels';
import { housingImageVariant } from '../housingMediaUrl';
import { twitterImageVariant } from '../twitterImageVariant';
import { nextYoutubeThumbnailFallback, parseYoutubeThumbnailUrl } from '../youtubeUrl';
import { buildImageRelayUrl, CORS_RELAY_IMAGE_HOSTS } from '../tweetVideoProxy';

export interface ListingColors {
    colorFamilies: string[];
    colorRule: number;
}

/** 16×16 の画素 → 色。 */
export function colorsFromPixels(rgba: Uint8ClampedArray): ListingColors {
    return { colorFamilies: extractPalette(rgba), colorRule: PALETTE_RULE };
}

/** 色の計算に使う代表の写真の URL(thumbnail は thumbnailPath、sns は ogImageUrl)。無ければ null。 */
export function representativeUrlForColors(l: { imageMode?: string; ogImageUrl?: string; thumbnailPath?: string }): string | null {
    if (l.imageMode === 'thumbnail' && l.thumbnailPath) return l.thumbnailPath;
    if (l.imageMode === 'sns' && l.ogImageUrl) return l.ogImageUrl;
    return null;
}

function hostOf(url: string): string | null {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

/** 読みに行く URL の順番。16×16 に縮めるだけなので小さい版を先に、だめなら元の URL。YouTube は画質を落とす連鎖。
 *  CORS を返さない外部サイトは中継経由だけ(直接は canvas で読めない)。 */
export function colorCandidateUrls(url: string): string[] {
    const host = hostOf(url);
    if (host && CORS_RELAY_IMAGE_HOSTS.has(host)) return [buildImageRelayUrl(url)];
    if (parseYoutubeThumbnailUrl(url)) {
        const chain = [url];
        for (let next = nextYoutubeThumbnailFallback(url); next; next = nextYoutubeThumbnailFallback(next)) chain.push(next);
        return chain;
    }
    const small = twitterImageVariant(housingImageVariant(url, 480), 'small');
    return small === url ? [url] : [small, url];
}

const LOAD_TIMEOUT_MS = 8000;

/** 画像を CORS 付き・Referer なしで読み込む(X の画像は Referer 付きだと拒否されるため no-referrer が必須)。 */
function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (cors) img.crossOrigin = 'anonymous';
        img.referrerPolicy = 'no-referrer';
        const timer = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
        img.onload = () => { clearTimeout(timer); resolve(img); };
        img.onerror = () => { clearTimeout(timer); reject(new Error('load_failed')); };
        img.src = src;
    });
}

/** YouTube が最大画質の無い動画で返す 120×90 のグレー画像(default.jpg は正規にこの大きさなので除く)。 */
function isYoutubePlaceholder(img: HTMLImageElement): boolean {
    if (img.naturalWidth !== 120 || img.naturalHeight !== 90) return false;
    const parsed = parseYoutubeThumbnailUrl(img.src);
    return parsed !== null && parsed.quality !== 'default';
}

/** URL の写真から色を計算する。どの候補も読めなければ null。 */
export async function colorsFromImageUrl(url: string): Promise<ListingColors | null> {
    for (const candidate of colorCandidateUrls(url)) {
        try {
            const img = await loadImage(candidate, true);
            if (isYoutubePlaceholder(img)) continue;
            return colorsFromPixels(readPixels16(img));
        } catch {
            /* 次の候補へ(読み込み失敗・CORS で読めない) */
        }
    }
    return null;
}

/** 手元の画像(登録画面の base64)から色を計算する。同じ出どころなので CORS の問題は無い。 */
export async function colorsFromBase64(base64: string, mimeType: string): Promise<ListingColors | null> {
    try {
        const img = await loadImage(`data:${mimeType};base64,${base64}`, false);
        return colorsFromPixels(readPixels16(img));
    } catch {
        return null;
    }
}
