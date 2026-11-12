import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 色の計算は CORS を返さない外部サイトの写真を中継(media.lopoly.app)から <img> で読む。
// 安全設定の img-src に中継が無いとブラウザが止め、21 件が「読めなかった家」に残った(2026-11-12)。
describe('安全設定(CSP)の img-src に写真の中継が入っている', () => {
    it('vercel.json の全 CSP の img-src に https://media.lopoly.app がある', () => {
        const text = readFileSync(resolve(__dirname, '../../../../vercel.json'), 'utf-8');
        const imgSrcs = [...text.matchAll(/img-src ([^;"]*)/g)].map((m) => m[1]);
        expect(imgSrcs.length).toBeGreaterThan(0);
        for (const src of imgSrcs) expect(src.split(/\s+/)).toContain('https://media.lopoly.app');
    });
});
