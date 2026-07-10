import { describe, it, expect } from 'vitest';
import { extractHousingAddressFromPage, scoreHousingCandidate } from '../../lib/housing/extractHousingAddressFromPage';
import { extractBodyText, parseOgpHtml } from '../../lib/housing/parseOgpHtml';

/**
 * housingsnap.com/47205 の実 HTML 抜粋 (parseOgpHtml.test.ts と同じ構造)。
 * og:description は 120 字で truncate され住所行が落ちる。住所行は本文の入れ子 `<p>` にしか無い。
 */
const HOUSINGSNAP_EXCERPT = `<!doctype html>
<html>
<head>
  <title>rainforest [M] - HOUSING SNAP</title>
  <meta property="og:title" content="rainforest [M]">
  <meta property="og:description" content="i&#39;ve finally had the energy and motivation to redo my personal shirogane home. i opted for an overgrown build that fe...">
</head>
<body>
  <header><nav><ul><li>ホーム</li></ul></nav></header>
  <div class="main-text-box">
    <p><p>i've finally had the energy and motivation to redo my personal shirogane home. i opted for an overgrown build that felt like a rainforest. i tried to match the colors + vibe with the garden. i'd love if you visited. &#9825;</p>

<p>crystal | goblin | shirogane | w21 p58.
</p></p>
  </div>
  <footer><p>&copy; HOUSING SNAP</p></footer>
</body>
</html>`;

describe('実 HTML e2e: parseOgpHtml → extractBodyText → extractHousingAddressFromPage', () => {
    it('本文にしか無い住所行を拾い上げ、og:description の "had" に釣られない', () => {
        const meta = parseOgpHtml(HOUSINGSNAP_EXCERPT, 'https://housingsnap.com/47205');
        const bodyText = extractBodyText(HOUSINGSNAP_EXCERPT);

        // 前提: 住所行は本文に1行として現れ、og:description には載っていない。
        expect(bodyText.split('\n')).toContain('crystal | goblin | shirogane | w21 p58.');
        expect(meta.description).not.toContain('w21');

        const result = extractHousingAddressFromPage({
            title: meta.title,
            description: meta.description,
            bodyText,
        });
        expect(result.dc).toBe('Crystal');
        expect(result.server).toBe('Goblin');
        expect(result.area).toBe('Shirogane');
        expect(result.ward).toBe(21);
        expect(result.plot).toBe(58);
        expect(result.ambiguity).toEqual([]);
    });

    it('本文が無い (旧 og-fetch のレスポンス) と住所は取れないが誤爆もしない', () => {
        const meta = parseOgpHtml(HOUSINGSNAP_EXCERPT, 'https://housingsnap.com/47205');
        const result = extractHousingAddressFromPage({
            title: meta.title,
            description: meta.description,
            bodyText: null,
        });
        // 誤爆 (Mana / Hades) が起きないこと。これが 2026-07-10 の実バグだった。
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
        expect(result.plot).toBeUndefined();
        expect(result.area).toBe('Shirogane');
    });
});

describe('extractHousingAddressFromPage - ページ候補スコアリング', () => {
    // Test 1: 実 HTML 相当の複数行本文から、住所行 "crystal | goblin | shirogane | w21 p58." が選ばれる。
    //   本文 <div class="main-text-box"> 末尾の <p> に住所行がある構造を再現。
    it('複数行本文から住所行を選び全フィールドを抽出する', () => {
        const page = {
            title: 'rainforest [M]',
            description:
                "i've finally had the energy and motivation to redo my personal shirogane home. i opted for an overgrown",
            bodyText: [
                'rainforest [M]',
                "i've finally had the energy and motivation to redo my personal shirogane home.",
                'i opted for an overgrown build with lots of plants.',
                'crystal | goblin | shirogane | w21 p58.',
            ].join('\n'),
        };
        const result = extractHousingAddressFromPage(page);
        expect(result.dc).toBe('Crystal');
        expect(result.server).toBe('Goblin');
        expect(result.area).toBe('Shirogane');
        expect(result.ward).toBe(21);
        expect(result.plot).toBe(58);
    });

    // Test 2: og:description だけ (英語自由文・ward/plot 無し) → dc/server undefined、area=Shirogane のみ。
    it('og:description だけなら dc/server は undefined で area だけ取れる', () => {
        const page = {
            description:
                "i've finally had the energy and motivation to redo my personal shirogane home.",
        };
        const result = extractHousingAddressFromPage(page);
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
        expect(result.area).toBe('Shirogane');
    });

    // Test 3: og:title "rainforest [M]" 単体では何も確定しない (score < 1 → 住所なし)。
    it('og:title rainforest [M] 単体では何も確定しない', () => {
        const result = extractHousingAddressFromPage({ title: 'rainforest [M]' });
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
        expect(result.area).toBeUndefined();
        expect(result.ward).toBeUndefined();
        expect(result.plot).toBeUndefined();
        expect(result.size).toBeUndefined();
        expect(result.ambiguity).toEqual([]);
    });

    // 空ページは住所なし
    it('空ページは全フィールド undefined', () => {
        const result = extractHousingAddressFromPage({});
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
        expect(result.area).toBeUndefined();
        expect(result.ambiguity).toEqual([]);
    });

    // スコアリングの内訳確認 (テストしやすさのため公開している scoreHousingCandidate)
    it('住所行は ward/plot・dc/server・area・区切り記号で高得点になる', () => {
        const { score, result } = scoreHousingCandidate('crystal | goblin | shirogane | w21 p58.');
        // ward/plot(+4) + server(+3)+dc(+1)=+4 + area(+2) + 区切り2個以上(+1) = 11
        expect(score).toBe(11);
        expect(result.server).toBe('Goblin');
    });

    it('住所らしくない自由文は低得点 (1 未満)', () => {
        const { score } = scoreHousingCandidate('i finally had time to build a house');
        expect(score).toBeLessThan(1);
    });
});
