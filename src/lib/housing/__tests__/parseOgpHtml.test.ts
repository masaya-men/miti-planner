import { describe, it, expect } from 'vitest';
import {
    parseOgpHtml,
    extractHousingSnapImages,
    extractStudioXivImages,
} from '../parseOgpHtml';

const BASE = 'https://housingsnap.com/listing/123';

describe('parseOgpHtml - 標準的な OGP', () => {
    it('og:image / og:title / og:description / og:site_name を抽出', () => {
        const html = `
            <html><head>
                <meta property="og:image" content="https://cdn.housingsnap.com/img/a.jpg">
                <meta property="og:title" content="ステキな家">
                <meta property="og:description" content="シロガネ 6-6 のおうち">
                <meta property="og:site_name" content="Housing Snap">
            </head></html>
        `;
        const result = parseOgpHtml(html, BASE);
        expect(result.image).toBe('https://cdn.housingsnap.com/img/a.jpg');
        expect(result.title).toBe('ステキな家');
        expect(result.description).toBe('シロガネ 6-6 のおうち');
        expect(result.siteName).toBe('Housing Snap');
    });

    it('属性順が逆 (content → property) でも抽出できる', () => {
        const html = `<meta content="https://x/img.jpg" property="og:image">`;
        expect(parseOgpHtml(html, BASE).image).toBe('https://x/img.jpg');
    });

    it('シングルクォート属性も抽出できる', () => {
        const html = `<meta property='og:title' content='Single Quote'>`;
        expect(parseOgpHtml(html, BASE).title).toBe('Single Quote');
    });
});

describe('parseOgpHtml - fallback chain', () => {
    it('og:image なし → og:image:url にフォールバック', () => {
        const html = `<meta property="og:image:url" content="https://x/url.jpg">`;
        expect(parseOgpHtml(html, BASE).image).toBe('https://x/url.jpg');
    });

    it('og:image:url なし → twitter:image にフォールバック', () => {
        const html = `<meta name="twitter:image" content="https://x/tw.jpg">`;
        expect(parseOgpHtml(html, BASE).image).toBe('https://x/tw.jpg');
    });

    it('og:title なし → <title> タグにフォールバック', () => {
        const html = `<html><head><title>Page Title</title></head></html>`;
        expect(parseOgpHtml(html, BASE).title).toBe('Page Title');
    });

    it('og:description なし → meta name="description" にフォールバック', () => {
        const html = `<meta name="description" content="A description">`;
        expect(parseOgpHtml(html, BASE).description).toBe('A description');
    });
});

describe('parseOgpHtml - 相対 URL の絶対化', () => {
    it('相対パス /a.jpg は baseUrl の origin で解決', () => {
        const html = `<meta property="og:image" content="/img/a.jpg">`;
        expect(parseOgpHtml(html, BASE).image).toBe('https://housingsnap.com/img/a.jpg');
    });

    it('protocol-relative //cdn/a.jpg は https: 付加', () => {
        const html = `<meta property="og:image" content="//cdn.x/a.jpg">`;
        expect(parseOgpHtml(html, BASE).image).toBe('https://cdn.x/a.jpg');
    });
});

describe('parseOgpHtml - HTML entity decode', () => {
    it('&amp; / &quot; / &#039; などを decode', () => {
        const html = `<meta property="og:title" content="A &amp; B &quot;C&quot; &#039;D&#039;">`;
        expect(parseOgpHtml(html, BASE).title).toBe(`A & B "C" 'D'`);
    });
});

describe('extractHousingSnapImages - hotfix23 housingsnap 複数画像対応', () => {
    it('_watermark.jpg の URL を出現順に抽出する', () => {
        const html = `
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/100/aaa111_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/200/bbb222_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/300/ccc333_watermark.jpg">
        `;
        expect(extractHousingSnapImages(html)).toEqual([
            'https://assets.housingsnap.com/uploads/paragraph/image/100/aaa111_watermark.jpg',
            'https://assets.housingsnap.com/uploads/paragraph/image/200/bbb222_watermark.jpg',
            'https://assets.housingsnap.com/uploads/paragraph/image/300/ccc333_watermark.jpg',
        ]);
    });

    it('重複は排除する (同じ URL が複数 <img> に出ても 1 回のみ)', () => {
        const html = `
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/1/abc123_watermark.jpg">
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/1/abc123_watermark.jpg">
        `;
        expect(extractHousingSnapImages(html)).toHaveLength(1);
    });

    it('_thumb.jpg や別パターンの URL は無視', () => {
        const html = `
            <img src="https://assets.housingsnap.com/uploads/paragraph/image/1/abc123_thumb.jpg">
            <img src="https://assets.housingsnap.com/uploads/avatar/2/abc123_watermark.jpg">
            <img src="https://other.com/abc123_watermark.jpg">
        `;
        expect(extractHousingSnapImages(html)).toEqual([]);
    });

    it('html 不在/異常入力なら空配列', () => {
        expect(extractHousingSnapImages('')).toEqual([]);
        expect(extractHousingSnapImages(null as unknown as string)).toEqual([]);
    });
});

describe('extractStudioXivImages - hotfix24 studio-xiv.com 複数画像対応', () => {
    it('ffxiv_<timestamp> パターンの画像を出現順に抽出する', () => {
        const html = `
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_20260526_220559_382-1.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_20260526_220725_441-1.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_20260512_201654_418-1.png">
        `;
        expect(extractStudioXivImages(html)).toEqual([
            'https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_20260526_220559_382-1.png',
            'https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_20260526_220725_441-1.png',
            'https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_20260512_201654_418-1.png',
        ]);
    });

    it('ロゴ等の ffxiv_ で始まらない画像は無視', () => {
        const html = `
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/site-logo.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/banner.jpg">
        `;
        expect(extractStudioXivImages(html)).toEqual([]);
    });

    it('webp / jpg / jpeg 拡張子も対応', () => {
        const html = `
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_a.webp">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_b.jpg">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_c.jpeg">
        `;
        expect(extractStudioXivImages(html)).toHaveLength(3);
    });

    it('重複は排除', () => {
        const html = `
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_x.png">
            <a href="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_x.png">link</a>
        `;
        expect(extractStudioXivImages(html)).toHaveLength(1);
    });

    it('hotfix26: WordPress リサイズ suffix (-WxH) を取り除いてベース名で dedup', () => {
        const html = `
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_x-150x150.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_x-768x512.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_x.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_y-300x200.png">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_y.png">
        `;
        // ffxiv_x と ffxiv_y の 2 つだけ、 全部 full size URL に正規化
        expect(extractStudioXivImages(html)).toEqual([
            'https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_x.png',
            'https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_y.png',
        ]);
    });

    it('hotfix26: webp / jpg の suffix も dedup 対象', () => {
        const html = `
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_a-150x150.webp">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_a.webp">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_b-300x200.jpg">
            <img src="https://studio-xiv.com/wp-content/uploads/2026/05/ffxiv_b.jpg">
        `;
        expect(extractStudioXivImages(html)).toHaveLength(2);
    });

    it('html 不在/異常入力なら空配列', () => {
        expect(extractStudioXivImages('')).toEqual([]);
        expect(extractStudioXivImages(null as unknown as string)).toEqual([]);
    });
});

describe('parseOgpHtml - 異常/欠落', () => {
    it('空 HTML は全部 null', () => {
        expect(parseOgpHtml('', BASE)).toEqual({
            image: null,
            title: null,
            description: null,
            siteName: null,
        });
    });

    it('og:title content が空文字なら <title> に fallback', () => {
        const html = `<meta property="og:title" content=""><title>From Title Tag</title>`;
        expect(parseOgpHtml(html, BASE).title).toBe('From Title Tag');
    });
});
