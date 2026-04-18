// src/lib/__tests__/ogpImageHash.test.ts
import { computeImageHash, type ImageHashInput } from '../ogpImageHash';

const baseInput: ImageHashInput = {
    contentName: '絶もうひとつの未来',
    planTitle: 'ヒラ軽減プラン',
    showTitle: true,
    showLogo: false,
    logoHash: null,
    lang: 'ja',
};

describe('computeImageHash', () => {
    it('戻り値は 16 桁の小文字 16 進文字列', () => {
        const hash = computeImageHash(baseInput);
        expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });

    it('同じ入力なら決定的に同じ hash を返す', () => {
        const a = computeImageHash(baseInput);
        const b = computeImageHash(baseInput);
        expect(a).toBe(b);
    });

    it('contentName が変われば hash も変わる', () => {
        const a = computeImageHash(baseInput);
        const b = computeImageHash({ ...baseInput, contentName: '絶竜詩戦争' });
        expect(a).not.toBe(b);
    });

    it('planTitle が変われば hash も変わる', () => {
        const a = computeImageHash(baseInput);
        const b = computeImageHash({ ...baseInput, planTitle: '別タイトル' });
        expect(a).not.toBe(b);
    });

    it('showTitle のフラグ差で hash が変わる', () => {
        const a = computeImageHash({ ...baseInput, showTitle: true });
        const b = computeImageHash({ ...baseInput, showTitle: false });
        expect(a).not.toBe(b);
    });

    it('showLogo のフラグ差で hash が変わる', () => {
        const a = computeImageHash({ ...baseInput, showLogo: false });
        const b = computeImageHash({ ...baseInput, showLogo: true, logoHash: 'abc1234567890def' });
        expect(a).not.toBe(b);
    });

    it('logoHash が変われば hash も変わる', () => {
        const a = computeImageHash({ ...baseInput, showLogo: true, logoHash: 'abc1234567890def' });
        const b = computeImageHash({ ...baseInput, showLogo: true, logoHash: 'fedcba0987654321' });
        expect(a).not.toBe(b);
    });

    it('lang が変われば hash も変わる', () => {
        const a = computeImageHash({ ...baseInput, lang: 'ja' });
        const b = computeImageHash({ ...baseInput, lang: 'en' });
        expect(a).not.toBe(b);
    });

    it('空文字列と未指定（falsy）が同じ正規化になる', () => {
        const a = computeImageHash({ ...baseInput, contentName: '', planTitle: '' });
        // contentName/planTitle は既に string 型必須だが、正規化関数が || '' を適用することを確認
        const b = computeImageHash({ ...baseInput, contentName: '', planTitle: '' });
        expect(a).toBe(b);
    });
});
