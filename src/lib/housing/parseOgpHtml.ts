/**
 * HTML 文字列から OGP メタデータを抽出する純関数 (2026-05-27 新設、 B: OGP 汎用拡張)。
 *
 * Web 標準 API 不使用 (正規表現のみ) で server (Vercel Edge) + client (vitest) 両方から
 * 同一ロジック呼び出し可能。 DOMParser を使わないのは Edge runtime に存在しないため。
 *
 * 対応するメタ:
 * - og:image (og:image:url も fallback)
 * - og:title
 * - og:description
 * - og:site_name
 * - <title> (og:title 不在時の fallback)
 * - twitter:image (og:image 不在時の fallback)
 */

export interface OgpMetadata {
    /** og:image (or twitter:image) の絶対 URL。 取得不可なら null。 */
    image: string | null;
    /** og:title (or <title>) の文字列。 取得不可なら null。 */
    title: string | null;
    /** og:description の文字列。 取得不可なら null。 */
    description: string | null;
    /** og:site_name の文字列。 取得不可なら null。 */
    siteName: string | null;
}

/**
 * housingsnap.com 専用の追加画像抽出 (2026-05-27 hotfix23)。
 *
 * ハウジングスナップは 1 物件で 1F / 地下 / 庭 別の複数画像を持つ。 og:image は
 * 1 枚しか出ないが、 HTML 内 `<img src="...assets.housingsnap.com/.../_watermark.jpg">`
 * を全部抽出すれば 1-8 枚取得可能 (= LoPo の max 4 枚制約に乗る)。
 *
 * 抽出パターン (URL 固定):
 *   `https://assets.housingsnap.com/uploads/paragraph/image/<id>/<hash>_watermark.jpg`
 *
 * 順序は HTML 出現順 (= 1F → 地下 → 庭の表示順)。 重複排除済。
 */
export function extractHousingSnapImages(html: string): string[] {
    if (typeof html !== 'string' || html.length === 0) return [];
    const re =
        /https:\/\/assets\.housingsnap\.com\/uploads\/paragraph\/image\/\d+\/[a-f0-9]+_watermark\.jpg/gi;
    const matches = html.match(re) ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of matches) {
        if (!seen.has(url)) {
            seen.add(url);
            out.push(url);
        }
    }
    return out;
}

/**
 * meta tag の content 属性を property/name で検索する。
 * 属性順序 (property → content / content → property) の両方に対応。
 */
function extractMeta(html: string, key: string): string | null {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // property="og:..." content="..." の順
    const re1 = new RegExp(
        `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']*)["']`,
        'i',
    );
    const m1 = html.match(re1);
    if (m1?.[1]) return decodeHtmlEntities(m1[1]);
    // content="..." property="og:..." の順 (逆)
    const re2 = new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escapedKey}["']`,
        'i',
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeHtmlEntities(m2[1]);
    return null;
}

/** <title>...</title> を抽出する。 */
function extractTitleTag(html: string): string | null {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return m?.[1] ? decodeHtmlEntities(m[1].trim()) : null;
}

/** 相対 URL を絶対 URL に変換する。 失敗時 null。 */
function resolveAbsoluteUrl(href: string, baseUrl: string): string | null {
    if (typeof href !== 'string' || href.length === 0) return null;
    if (/^https?:\/\//i.test(href)) return href;
    if (href.startsWith('//')) return `https:${href}`;
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return null;
    }
}

/** よく出る HTML entity (&amp; &quot; &#x27; など) を decode する。 */
function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

/**
 * HTML から OgpMetadata を抽出する。
 * baseUrl は og:image が相対パスのときの解決基準 (= 通常は fetch した URL 自体)。
 */
export function parseOgpHtml(html: string, baseUrl: string): OgpMetadata {
    if (typeof html !== 'string' || html.length === 0) {
        return { image: null, title: null, description: null, siteName: null };
    }

    const rawImage =
        extractMeta(html, 'og:image') ??
        extractMeta(html, 'og:image:url') ??
        extractMeta(html, 'twitter:image');
    const image = rawImage ? resolveAbsoluteUrl(rawImage, baseUrl) : null;

    const title = extractMeta(html, 'og:title') ?? extractTitleTag(html);
    const description =
        extractMeta(html, 'og:description') ?? extractMeta(html, 'description');
    const siteName = extractMeta(html, 'og:site_name');

    return { image, title, description, siteName };
}
