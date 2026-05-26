import { describe, it, expect } from 'vitest';
import { parseOgpHtml } from '../parseOgpHtml';

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
