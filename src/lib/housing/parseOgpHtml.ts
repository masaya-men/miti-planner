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
    return dedupOrdered(html.match(re) ?? []);
}

/**
 * studio-xiv.com 専用の追加画像抽出 (2026-05-27 hotfix24、 hotfix26 で dedup 改善)。
 *
 * Studio-XIV は WordPress (= `/wp-content/uploads/<year>/<month>/<filename>`) で配信。
 * 物件画像は `ffxiv_<timestamp>` というファイル名パターン (= ゲーム内スクリーンショットの
 * デフォルト名) なので、 サイトロゴ等の余計な画像を拾わず物件画像だけ抽出できる。
 *
 * 抽出パターン:
 *   `https://studio-xiv.com/wp-content/uploads/YYYY/MM/ffxiv_*.{png,jpg,jpeg,webp}`
 *
 * hotfix26 で dedup 改善: WordPress は同じ画像を `-WxH` suffix で複数解像度生成する
 * (例: `ffxiv_x-150x150.png` `ffxiv_x-768x512.png` `ffxiv_x.png`)。 URL 完全一致 dedup
 * だと別物として残ってしまい同じ画像が重複表示される。 suffix を取り除いたベース名で
 * dedup し、 full size URL を返す。
 */
export function extractStudioXivImages(html: string): string[] {
    if (typeof html !== 'string' || html.length === 0) return [];
    // クエリ可、 拡張子の後ろの ?... も拾うため `(?:\?[^"'\s>]*)?` で末尾を許容
    const re =
        /https:\/\/studio-xiv\.com\/wp-content\/uploads\/\d{4}\/\d{2}\/ffxiv_[\w.-]+?\.(?:png|jpe?g|webp)(?:\?[^"'\s>]*)?/gi;
    const matches = html.match(re) ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of matches) {
        const normalized = normalizeStudioXivUrl(url);
        if (!seen.has(normalized)) {
            seen.add(normalized);
            // 正規化後の URL (= full size の URL) を実際に返す
            out.push(normalized);
        }
    }
    return out;
}

/**
 * studio-xiv 画像 URL を正規化する純関数 (hotfix26 で導入、 hotfix27 で強化、 hotfix29 で export 化)。
 *
 * 入力例 → 出力 (全部同じ baseName に正規化される):
 *   ffxiv_x-1280x720-1.png?1779813917 → ffxiv_x-1.png
 *   ffxiv_x-1280x720-1.png            → ffxiv_x-1.png
 *   ffxiv_x-1.png                      → ffxiv_x-1.png
 *   ffxiv_x-320x320-1.png             → ffxiv_x-1.png
 *
 * 処理:
 *   1. クエリ (?以降) を削除 (= cache buster 等を無視)
 *   2. URL 中のどこにあっても `-WxH` を削除 (= リサイズ suffix を無視、 末尾固定ではない)
 */
export function normalizeStudioXivUrl(url: string): string {
    let u = url.split('?')[0];
    u = u.replace(/-\d+x\d+/g, '');
    return u;
}

/** URL 配列を出現順を保ちつつ重複排除する純関数。 */
function dedupOrdered(urls: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of urls) {
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

/** extractBodyText の既定打ち切り文字数 (呼び出し側が maxChars 未指定のとき)。 */
const DEFAULT_BODY_TEXT_MAX_CHARS = 4000;

/** 中身ごと捨てる (= 本文に出したくない) タグ。 script/style 等のノイズ源。 */
const BODY_TEXT_DROP_TAGS = [
    'script',
    'style',
    'noscript',
    'svg',
    'head',
    'nav',
    'header',
    'footer',
    'template',
] as const;

/**
 * 行の境界になるブロックレベル要素。 **開始タグ・終了タグの両方**を改行にする。
 * 終了タグだけを改行にすると `…<div>d</div><section>sec</section>` が `d` + `sec` ではなく
 * `dsec` に潰れる (`<section>` の開始位置に境界が無いため)。
 * `<br>` は単独で境界 (void 要素なので終了タグが無い)。
 */
const BODY_TEXT_BLOCK_BOUNDARY_RE =
    /<\/?(?:p|div|li|ul|ol|h[1-6]|tr|td|th|table|section|article|main|aside|blockquote|pre|figure|figcaption|form|dl|dt|dd|address)\b[^>]*>|<br\s*\/?>/gi;

/**
 * HTML からタグを除去して本文テキストにする (2026-07-10 新設、 B: og-fetch 本文返却)。
 *
 * 住所行が og:description の truncate (housingsnap は 120 字) に載らず本文 `<p>` に
 * しか無いページがあるため、 og-fetch が本文プレーンテキストも返せるようにする。
 * **住所の解析ロジックはここには置かない** — クライアント側 (parseHousingFromText) が
 * 担当する。 ここは「タグを剥がしてブロック境界の改行だけ保った plain text」を返す。
 *
 * 処理順:
 * 1. HTML コメントを除去 (中に `>` を含んでも安全に一括)。
 * 2. BODY_TEXT_DROP_TAGS を中身ごと除去 (open/close を同一タグ名で個別に、 非貪欲で
 *    ネストを食わない。 `<head\b` は語境界で `<header>` を巻き込まない)。
 * 3. **ソース中の生の改行・タブを空白へ畳む**。 HTML では改行はただの空白であって
 *    行の境界ではない (`<p>a\nb</p>` は 1 行の「a b」)。 ブロック境界を入れる前にやる。
 * 4. ブロックレベル要素の開始/終了タグと `<br>` を改行に置換 (= ここだけが行の境界)。
 * 5. 残りのタグを除去。
 * 6. `decodeHtmlEntities` で実体参照を戻す。
 * 7. 各行内の連続空白を 1 個に畳み、 行頭行末をトリム。
 * 8. 3 連以上の改行を 2 個に畳み、 全体をトリム。
 * 9. maxChars (既定 4000) で打ち切る。
 *
 * @param html   生 HTML
 * @param maxChars 打ち切り上限 (既定 DEFAULT_BODY_TEXT_MAX_CHARS)。 負値なら無制限。
 * @returns 本文テキスト。 空なら空文字列。
 */
export function extractBodyText(
    html: string,
    maxChars: number = DEFAULT_BODY_TEXT_MAX_CHARS,
): string {
    if (typeof html !== 'string' || html.length === 0) return '';

    let text = html;

    // 1. HTML コメント除去
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');

    // 2. 中身ごと捨てるタグ (script/style/...) を除去。 タグ名ごとに open/close を
    //    閉じ、 非貪欲 (`*?`) で複数ブロックをまたいで貪欲に食わないようにする。
    for (const tag of BODY_TEXT_DROP_TAGS) {
        const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
        text = text.replace(re, ' ');
    }

    // 3. ソースの改行/タブ/復帰は HTML では空白。 ブロック境界を入れる前に潰す。
    text = text.replace(/[\r\n\t\f\v]+/g, ' ');

    // 4. ブロック境界 (開始/終了タグ両方) と <br> を改行に
    text = text.replace(BODY_TEXT_BLOCK_BOUNDARY_RE, '\n');

    // 5. 残りのタグを除去
    text = text.replace(/<[^>]+>/g, '');

    // 6. 実体参照を戻す
    text = decodeHtmlEntities(text);

    // 7. 各行内の連続空白を 1 個に、 行頭行末トリム
    text = text
        .split('\n')
        .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
        .join('\n');

    // 8. 3 連以上の改行を 2 個に、 全体トリム
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    // 9. maxChars で打ち切り (負値は無制限)
    if (maxChars < 0 || text.length <= maxChars) return text;
    const cut = text.slice(0, maxChars);
    // slice はコードユニット単位なので、 サロゲートペア (絵文字等) の途中で切れることがある。
    // 末尾に高サロゲートだけが残ると壊れた文字になるので 1 コードユニット戻す。
    const lastCode = cut.charCodeAt(cut.length - 1);
    return lastCode >= 0xd800 && lastCode <= 0xdbff ? cut.slice(0, -1) : cut;
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
