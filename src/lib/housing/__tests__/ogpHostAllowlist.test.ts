import { describe, it, expect } from 'vitest';
import { isOgpUrlAllowed, getOgpAllowlist } from '../ogpHostAllowlist';

describe('getOgpAllowlist', () => {
    it('現在の 4 サイトを返す (固定値の回帰防止)', () => {
        expect(getOgpAllowlist()).toEqual([
            'housingsnap.com',
            'housing-collection-ff14.com',
            'studio-xiv.com',
            'thonhart.com',
        ]);
    });
});

describe('isOgpUrlAllowed - allowlist 通過', () => {
    it.each([
        'https://housingsnap.com/listing/123',
        'https://housing-collection-ff14.com/house/abc',
        'https://studio-xiv.com/tour/xyz',
        'https://thonhart.com/gallery/1',
    ])('%s は許可', (url) => {
        expect(isOgpUrlAllowed(url)).toBe(true);
    });
});

describe('isOgpUrlAllowed - protocol', () => {
    it('http は拒否 (https のみ)', () => {
        expect(isOgpUrlAllowed('http://housingsnap.com/x')).toBe(false);
    });
    it('ftp 等の他 protocol は拒否', () => {
        expect(isOgpUrlAllowed('ftp://housingsnap.com/x')).toBe(false);
    });
    it('data:, javascript: 等は拒否', () => {
        expect(isOgpUrlAllowed('data:text/html,<script>')).toBe(false);
        expect(isOgpUrlAllowed('javascript:alert(1)')).toBe(false);
    });
});

describe('isOgpUrlAllowed - サブドメインは完全一致でないので拒否', () => {
    it('サブドメインは拒否', () => {
        expect(isOgpUrlAllowed('https://www.housingsnap.com/x')).toBe(false);
        expect(isOgpUrlAllowed('https://cdn.housing-collection-ff14.com/x')).toBe(false);
    });
    it('homoglyph 攻撃 (housingsnap.com.evil.com) も拒否', () => {
        expect(isOgpUrlAllowed('https://housingsnap.com.evil.com/x')).toBe(false);
    });
});

describe('isOgpUrlAllowed - 私的/特殊 IP', () => {
    it.each([
        'https://10.0.0.1/x',
        'https://127.0.0.1/x',
        'https://169.254.169.254/latest/meta-data',
        'https://172.16.0.1/x',
        'https://192.168.1.1/x',
        'https://0.0.0.0/x',
        'https://100.64.0.1/x', // CGNAT
    ])('%s は拒否 (allowlist 外 + IP 経路でも多重防御)', (url) => {
        expect(isOgpUrlAllowed(url)).toBe(false);
    });
});

describe('isOgpUrlAllowed - 異常入力', () => {
    it('空文字は拒否', () => {
        expect(isOgpUrlAllowed('')).toBe(false);
    });
    it('非 string は拒否', () => {
        expect(isOgpUrlAllowed(null as unknown as string)).toBe(false);
        expect(isOgpUrlAllowed(undefined as unknown as string)).toBe(false);
    });
    it('壊れた URL は拒否', () => {
        expect(isOgpUrlAllowed('not a url')).toBe(false);
        expect(isOgpUrlAllowed('://broken')).toBe(false);
    });
});
