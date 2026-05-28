/**
 * syndication CDN レスポンス (cdn.syndication.twimg.com/tweet-result) から
 * photos + video を取り出す純関数 (2026-05-26 新設)。
 *
 * api/tweet-meta.ts (Edge runtime) と vitest (node runtime) の両方から
 * 同一ロジックを呼び出すため、 Web 標準 API すら避けて完全に Pure に書く。
 *
 * 抽出ルール (Allmarks `lib/embed/tweet-meta.ts` の知見を移植):
 * - `mediaDetails[]` を最優先 (canonical API order)。 video/animated_gif/photo 全部拾う
 * - mediaDetails が無くて `photos[]` だけある古い形式は静止画として救済
 * - `card.name === 'unified_card'` の場合、 `binding_values.unified_card.string_value` を
 *   JSON.parse して `media_entities` をウォーク (= X の "video_website" 等 promo カード対応)
 * - video は最初の 1 件のみ採用 (LoPo の物件画像は 1 ツイートあたり 1 動画想定)
 * - mp4 variants から最高 bitrate のものを選択
 */

type VideoVariant = {
    bitrate?: number;
    content_type?: string;
    url?: string;
};

type MediaDetail = {
    type?: string;
    media_url_https?: string;
    original_info?: { width?: number; height?: number };
    video_info?: {
        aspect_ratio?: [number, number];
        variants?: VideoVariant[];
    };
};

type UnifiedCardBinding = {
    type?: string;
    string_value?: string;
};

export type SyndicationRaw = {
    text?: string;
    full_text?: string;
    user?: {
        name?: string;
        screen_name?: string;
        profile_image_url_https?: string;
    };
    photos?: Array<{ url?: string; width?: number; height?: number }>;
    mediaDetails?: MediaDetail[];
    video?: unknown;
    card?: {
        name?: string;
        binding_values?: Record<string, UnifiedCardBinding>;
    };
};

export type TweetVideoPayload = {
    url: string;
    posterUrl: string;
    aspectRatio: number | null;
};

export type TweetMediaPayload = {
    photos: string[];
    /** photos と同じ順序・同じ長さ。 寸法不明な photo は null。 */
    photoAspectRatios: (number | null)[];
    video: TweetVideoPayload | null;
};

/** width/height から aspectRatio を計算。 どちらか欠けるか h<=0 なら null。 */
function ratioFromDims(w: number | undefined, h: number | undefined): number | null {
    return typeof w === 'number' && typeof h === 'number' && h > 0 ? w / h : null;
}

/** mp4 variants から最高 bitrate のものを 1 つ選ぶ。 mp4 が無ければ undefined。 */
export function pickBestMp4(variants: VideoVariant[] | undefined): string | undefined {
    if (!variants) return undefined;
    const mp4s = variants.filter(
        (v) => v.content_type === 'video/mp4' && typeof v.url === 'string',
    );
    if (mp4s.length === 0) return undefined;
    mp4s.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    return mp4s[0]?.url;
}

/** MediaDetail から TweetVideoPayload を取り出す。 video/animated_gif 以外は null。 */
function detailToVideoPayload(m: MediaDetail): TweetVideoPayload | null {
    if (m.type !== 'video' && m.type !== 'animated_gif') return null;
    const url = pickBestMp4(m.video_info?.variants);
    if (!url || typeof m.media_url_https !== 'string') return null;
    const ow = m.original_info?.width;
    const oh = m.original_info?.height;
    const aspectRatio = typeof ow === 'number' && typeof oh === 'number' && oh > 0 ? ow / oh : null;
    return { url, posterUrl: m.media_url_https, aspectRatio };
}

/** unified_card の string_value を JSON.parse して media_entities を取り出す。 */
function decodeUnifiedCardMediaEntities(
    binding: Record<string, UnifiedCardBinding> | undefined,
): MediaDetail[] {
    const sv = binding?.unified_card?.string_value;
    if (typeof sv !== 'string' || sv.length === 0) return [];
    try {
        const decoded = JSON.parse(sv) as { media_entities?: Record<string, MediaDetail> };
        const entities = decoded.media_entities;
        if (!entities || typeof entities !== 'object') return [];
        return Object.values(entities);
    } catch {
        return [];
    }
}

/**
 * syndication JSON から photos[] + video を取り出す。
 * 3 経路 (mediaDetails / photos 直下 / unified_card) を順に試す。
 */
export function extractTweetMediaPayload(raw: SyndicationRaw | null): TweetMediaPayload {
    if (!raw || typeof raw !== 'object') return { photos: [], photoAspectRatios: [], video: null };

    const photos: string[] = [];
    const photoAspectRatios: (number | null)[] = [];
    let video: TweetVideoPayload | null = null;

    if (Array.isArray(raw.mediaDetails) && raw.mediaDetails.length > 0) {
        for (const m of raw.mediaDetails) {
            if (m.type === 'photo' && typeof m.media_url_https === 'string') {
                photos.push(m.media_url_https);
                photoAspectRatios.push(ratioFromDims(m.original_info?.width, m.original_info?.height));
            } else if (!video) {
                video = detailToVideoPayload(m);
            }
        }
    }

    if (photos.length === 0 && Array.isArray(raw.photos)) {
        for (const p of raw.photos) {
            if (typeof p?.url === 'string') {
                photos.push(p.url);
                photoAspectRatios.push(ratioFromDims(p.width, p.height));
            }
        }
    }

    if (!video && raw.card?.name === 'unified_card') {
        for (const m of decodeUnifiedCardMediaEntities(raw.card.binding_values)) {
            video = detailToVideoPayload(m);
            if (video) break;
        }
    }

    return { photos, photoAspectRatios, video };
}
