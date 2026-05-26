import { describe, it, expect } from 'vitest';
import {
    pickBestMp4,
    extractTweetMediaPayload,
} from '../tweetMetaExtract';

describe('pickBestMp4', () => {
    it('mp4 が無ければ undefined', () => {
        expect(pickBestMp4(undefined)).toBeUndefined();
        expect(pickBestMp4([])).toBeUndefined();
        expect(
            pickBestMp4([
                { content_type: 'application/x-mpegURL', url: 'https://x/a.m3u8' },
            ]),
        ).toBeUndefined();
    });

    it('mp4 が複数あれば最高 bitrate を選ぶ', () => {
        const v = pickBestMp4([
            { bitrate: 832000, content_type: 'video/mp4', url: 'https://x/lo.mp4' },
            { bitrate: 2176000, content_type: 'video/mp4', url: 'https://x/hi.mp4' },
            { bitrate: 1280000, content_type: 'video/mp4', url: 'https://x/mid.mp4' },
        ]);
        expect(v).toBe('https://x/hi.mp4');
    });

    it('bitrate 無し mp4 は 0 扱いで最下位', () => {
        const v = pickBestMp4([
            { content_type: 'video/mp4', url: 'https://x/no-br.mp4' },
            { bitrate: 500000, content_type: 'video/mp4', url: 'https://x/lo.mp4' },
        ]);
        expect(v).toBe('https://x/lo.mp4');
    });
});

describe('extractTweetMediaPayload', () => {
    it('raw が null/非object なら空ペイロード', () => {
        expect(extractTweetMediaPayload(null)).toEqual({ photos: [], video: null });
    });

    it('mediaDetails の photo 群を photos に抽出', () => {
        const payload = extractTweetMediaPayload({
            mediaDetails: [
                { type: 'photo', media_url_https: 'https://x/a.jpg' },
                { type: 'photo', media_url_https: 'https://x/b.jpg' },
            ],
        });
        expect(payload.photos).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
        expect(payload.video).toBeNull();
    });

    it('mediaDetails の video から TweetVideoPayload を抽出 (aspectRatio = w/h)', () => {
        const payload = extractTweetMediaPayload({
            mediaDetails: [
                {
                    type: 'video',
                    media_url_https: 'https://x/poster.jpg',
                    original_info: { width: 1920, height: 1080 },
                    video_info: {
                        variants: [
                            { bitrate: 832000, content_type: 'video/mp4', url: 'https://x/lo.mp4' },
                            { bitrate: 2176000, content_type: 'video/mp4', url: 'https://x/hi.mp4' },
                        ],
                    },
                },
            ],
        });
        expect(payload.video).toEqual({
            url: 'https://x/hi.mp4',
            posterUrl: 'https://x/poster.jpg',
            aspectRatio: 1920 / 1080,
        });
        expect(payload.photos).toEqual([]);
    });

    it('animated_gif も video として扱う', () => {
        const payload = extractTweetMediaPayload({
            mediaDetails: [
                {
                    type: 'animated_gif',
                    media_url_https: 'https://x/gif-poster.jpg',
                    original_info: { width: 600, height: 600 },
                    video_info: {
                        variants: [
                            { content_type: 'video/mp4', url: 'https://x/gif.mp4' },
                        ],
                    },
                },
            ],
        });
        expect(payload.video).toEqual({
            url: 'https://x/gif.mp4',
            posterUrl: 'https://x/gif-poster.jpg',
            aspectRatio: 1,
        });
    });

    it('photo + video が混在しても両方とれる', () => {
        const payload = extractTweetMediaPayload({
            mediaDetails: [
                { type: 'photo', media_url_https: 'https://x/p1.jpg' },
                {
                    type: 'video',
                    media_url_https: 'https://x/poster.jpg',
                    original_info: { width: 1280, height: 720 },
                    video_info: {
                        variants: [
                            { bitrate: 1024000, content_type: 'video/mp4', url: 'https://x/v.mp4' },
                        ],
                    },
                },
            ],
        });
        expect(payload.photos).toEqual(['https://x/p1.jpg']);
        expect(payload.video?.url).toBe('https://x/v.mp4');
    });

    it('mediaDetails 無し + photos 直下があれば静止画として救済 (旧形式)', () => {
        const payload = extractTweetMediaPayload({
            photos: [
                { url: 'https://x/old.jpg', width: 800, height: 600 },
            ],
        });
        expect(payload.photos).toEqual(['https://x/old.jpg']);
        expect(payload.video).toBeNull();
    });

    it('width/height 不正なら aspectRatio = null', () => {
        const payload = extractTweetMediaPayload({
            mediaDetails: [
                {
                    type: 'video',
                    media_url_https: 'https://x/poster.jpg',
                    video_info: {
                        variants: [{ content_type: 'video/mp4', url: 'https://x/v.mp4' }],
                    },
                },
            ],
        });
        expect(payload.video?.aspectRatio).toBeNull();
    });

    it('mp4 が無い video は null (HLS のみ等)', () => {
        const payload = extractTweetMediaPayload({
            mediaDetails: [
                {
                    type: 'video',
                    media_url_https: 'https://x/poster.jpg',
                    original_info: { width: 1280, height: 720 },
                    video_info: {
                        variants: [
                            { content_type: 'application/x-mpegURL', url: 'https://x/v.m3u8' },
                        ],
                    },
                },
            ],
        });
        expect(payload.video).toBeNull();
    });

    it('unified_card の media_entities から video を救済', () => {
        const decodedCardBody = JSON.stringify({
            media_entities: {
                m1: {
                    type: 'video',
                    media_url_https: 'https://x/card-poster.jpg',
                    original_info: { width: 1280, height: 720 },
                    video_info: {
                        variants: [
                            { bitrate: 1000000, content_type: 'video/mp4', url: 'https://x/card.mp4' },
                        ],
                    },
                },
            },
        });
        const payload = extractTweetMediaPayload({
            card: {
                name: 'unified_card',
                binding_values: {
                    unified_card: { type: 'STRING', string_value: decodedCardBody },
                },
            },
        });
        expect(payload.video?.url).toBe('https://x/card.mp4');
    });

    it('unified_card の string_value が壊れていても throw せず null', () => {
        const payload = extractTweetMediaPayload({
            card: {
                name: 'unified_card',
                binding_values: {
                    unified_card: { type: 'STRING', string_value: '{not-json' },
                },
            },
        });
        expect(payload.video).toBeNull();
    });
});
