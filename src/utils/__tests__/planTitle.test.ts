import { describe, it, expect } from 'vitest';
import { generateUniqueTitle } from '../planTitle';

describe('generateUniqueTitle', () => {
    it('既存に同名プランがなければ希望の名前をそのまま返す', () => {
        const plans = [
            { title: '別のプラン', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('絶もうあ', plans, 'm1s')).toBe('絶もうあ');
    });

    it('既存に同名プランがあれば (2) を付与', () => {
        const plans = [
            { title: '絶もうあ', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('絶もうあ', plans, 'm1s')).toBe('絶もうあ (2)');
    });

    it('既に (2) まである場合は (3) を付与', () => {
        const plans = [
            { title: '絶もうあ', contentId: 'm1s' },
            { title: '絶もうあ (2)', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('絶もうあ', plans, 'm1s')).toBe('絶もうあ (3)');
    });

    it('別コンテンツに同名があっても影響しない', () => {
        const plans = [
            { title: '絶もうあ', contentId: 'm2s' },
        ];
        expect(generateUniqueTitle('絶もうあ', plans, 'm1s')).toBe('絶もうあ');
    });

    it('既に末尾に (2) が付いた名前を渡してもベースで判定する', () => {
        const plans = [
            { title: '絶もうあ', contentId: 'm1s' },
            { title: '絶もうあ (2)', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('絶もうあ (2)', plans, 'm1s')).toBe('絶もうあ (3)');
    });

    it('番号が飛んでいても最大値+1を採用する', () => {
        const plans = [
            { title: '絶もうあ', contentId: 'm1s' },
            { title: '絶もうあ (5)', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('絶もうあ', plans, 'm1s')).toBe('絶もうあ (6)');
    });

    it('contentId が null 同士でもマッチする', () => {
        const plans = [
            { title: 'テスト', contentId: null },
        ];
        expect(generateUniqueTitle('テスト', plans, null)).toBe('テスト (2)');
    });

    it('空配列なら希望の名前をそのまま返す', () => {
        expect(generateUniqueTitle('絶もうあ', [], 'm1s')).toBe('絶もうあ');
    });

    it('部分一致しない別タイトルには影響されない', () => {
        const plans = [
            { title: '絶もうあ零式', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('絶もうあ', plans, 'm1s')).toBe('絶もうあ');
    });

    it('「M1S (3)」のみの環境で「M1S (3)」を複製すると「M1S (4)」になる（duplicateセマンティクス保持）', () => {
        const plans = [
            { title: 'M1S (3)', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('M1S (3)', plans, 'm1s')).toBe('M1S (4)');
    });

    it('衝突しない (5) 付き名は弄らない', () => {
        const plans = [
            { title: 'M1S', contentId: 'm1s' },
        ];
        expect(generateUniqueTitle('M1S (5)', plans, 'm1s')).toBe('M1S (5)');
    });
});
