// src/lib/__tests__/ogpHousingerCard.test.ts
import {
    buildHousingerOgCardParams,
    buildHousingerOgCardUrl,
    signHousingerOgCardParams,
    verifyHousingerOgCardSig,
    type HousingerOgCardInput,
} from '../ogpHousingerCard';

const SECRET = 'test-cron-secret';

const baseInput: HousingerOgCardInput = {
    pattern: 'grid',
    name: 'モグモグ工房',
    avatarUrl: 'https://example.com/avatar.png',
    imageUrls: [
        'https://example.com/1.png',
        'https://example.com/2.png',
        'https://example.com/3.png',
    ],
};

describe('buildHousingerOgCardParams', () => {
    it('パラメータの並び順は type → ver → pattern → name → bio → avatar → img の固定順', () => {
        const params = buildHousingerOgCardParams({ ...baseInput, bio: 'よろしくお願いします' });
        expect([...params.keys()]).toEqual(['type', 'ver', 'pattern', 'name', 'bio', 'avatar', 'img', 'img', 'img']);
    });

    it('bio未指定でもbioパラメータは空文字で含まれる(バージョン変更と合わせて必ずハッシュに反映する)', () => {
        const params = buildHousingerOgCardParams(baseInput);
        expect(params.get('bio')).toBe('');
    });

    it('imgs は先頭から最大10枚に切り詰められる', () => {
        const params = buildHousingerOgCardParams({
            ...baseInput,
            imageUrls: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
        });
        expect(params.getAll('img')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    });

    it('imageUrls が0枚でも name+avatar のみで組み立てられる', () => {
        const params = buildHousingerOgCardParams({ pattern: 'grid', name: 'ソロ活動家', avatarUrl: 'https://example.com/a.png', imageUrls: [] });
        expect(params.getAll('img')).toEqual([]);
        expect(params.get('name')).toBe('ソロ活動家');
        expect(params.get('avatar')).toBe('https://example.com/a.png');
    });

    it('avatarUrl が無ければ avatar パラメータを含まない', () => {
        const params = buildHousingerOgCardParams({ pattern: 'grid', name: '名無し', imageUrls: [] });
        expect(params.has('avatar')).toBe(false);
    });

    it('imageUrls に null/undefined/空文字が混ざっていても除去される', () => {
        const params = buildHousingerOgCardParams({
            pattern: 'grid',
            name: 'テスト',
            imageUrls: [null, '', undefined, 'https://example.com/x.png'],
        });
        expect(params.getAll('img')).toEqual(['https://example.com/x.png']);
    });

    it('name/avatarUrl が未指定でも安全に動く（空文字として扱う）', () => {
        const params = buildHousingerOgCardParams({ pattern: 'grid', name: '' });
        expect(params.get('name')).toBe('');
        expect(params.has('avatar')).toBe(false);
    });
});

describe('signHousingerOgCardParams', () => {
    it('16進24文字の署名を返す', async () => {
        const params = buildHousingerOgCardParams(baseInput);
        const sig = await signHousingerOgCardParams(params, SECRET);
        expect(sig).toMatch(/^[a-f0-9]{24}$/);
    });

    it('同じパラメータ・同じ秘密鍵なら決定的に同じ署名になる', async () => {
        const params1 = buildHousingerOgCardParams(baseInput);
        const params2 = buildHousingerOgCardParams(baseInput);
        const sig1 = await signHousingerOgCardParams(params1, SECRET);
        const sig2 = await signHousingerOgCardParams(params2, SECRET);
        expect(sig1).toBe(sig2);
    });

    it('パラメータが変われば署名も変わる', async () => {
        const params1 = buildHousingerOgCardParams(baseInput);
        const params2 = buildHousingerOgCardParams({ ...baseInput, name: '別の名前' });
        const sig1 = await signHousingerOgCardParams(params1, SECRET);
        const sig2 = await signHousingerOgCardParams(params2, SECRET);
        expect(sig1).not.toBe(sig2);
    });

    it('秘密鍵が変われば署名も変わる', async () => {
        const params = buildHousingerOgCardParams(baseInput);
        const sig1 = await signHousingerOgCardParams(params, SECRET);
        const sig2 = await signHousingerOgCardParams(params, 'another-secret');
        expect(sig1).not.toBe(sig2);
    });
});

describe('buildHousingerOgCardUrl / verifyHousingerOgCardSig', () => {
    it('組み立てたURLのクエリを検証すると true になる', async () => {
        const url = await buildHousingerOgCardUrl('https://lopoly.app', baseInput, SECRET);
        expect(url.startsWith('https://lopoly.app/api/og?')).toBe(true);
        const parsed = new URL(url);
        const ok = await verifyHousingerOgCardSig(parsed.searchParams, SECRET);
        expect(ok).toBe(true);
    });

    it('sig が無ければ検証は false', async () => {
        const params = buildHousingerOgCardParams(baseInput);
        const ok = await verifyHousingerOgCardSig(params, SECRET);
        expect(ok).toBe(false);
    });

    it('name を改ざんすると検証は false（sigはそのまま流用）', async () => {
        const url = await buildHousingerOgCardUrl('https://lopoly.app', baseInput, SECRET);
        const parsed = new URL(url);
        parsed.searchParams.set('name', '改ざんされた名前');
        const ok = await verifyHousingerOgCardSig(parsed.searchParams, SECRET);
        expect(ok).toBe(false);
    });

    it('pattern を改ざんすると検証は false（2案を別ハッシュ・別キャッシュにするための前提）', async () => {
        const url = await buildHousingerOgCardUrl('https://lopoly.app', baseInput, SECRET);
        const parsed = new URL(url);
        parsed.searchParams.set('pattern', 'sidebar');
        const ok = await verifyHousingerOgCardSig(parsed.searchParams, SECRET);
        expect(ok).toBe(false);
    });

    it('img を追加改ざんすると検証は false', async () => {
        const url = await buildHousingerOgCardUrl('https://lopoly.app', baseInput, SECRET);
        const parsed = new URL(url);
        parsed.searchParams.append('img', 'https://evil.example.com/injected.png');
        const ok = await verifyHousingerOgCardSig(parsed.searchParams, SECRET);
        expect(ok).toBe(false);
    });

    it('別の秘密鍵で検証すると false', async () => {
        const url = await buildHousingerOgCardUrl('https://lopoly.app', baseInput, SECRET);
        const parsed = new URL(url);
        const ok = await verifyHousingerOgCardSig(parsed.searchParams, 'wrong-secret');
        expect(ok).toBe(false);
    });

    it('imgs 0〜3枚のいずれでも往復できる', async () => {
        for (const imageUrls of [[], ['https://example.com/1.png'], ['https://example.com/1.png', 'https://example.com/2.png', 'https://example.com/3.png']]) {
            const url = await buildHousingerOgCardUrl('https://lopoly.app', { pattern: 'grid', name: 'テスト', imageUrls }, SECRET);
            const parsed = new URL(url);
            const ok = await verifyHousingerOgCardSig(parsed.searchParams, SECRET);
            expect(ok).toBe(true);
            expect(parsed.searchParams.getAll('img')).toEqual(imageUrls);
        }
    });
});
