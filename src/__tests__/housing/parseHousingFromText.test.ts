import { describe, it, expect } from 'vitest';
import { parseHousingFromText } from '../../lib/housing/parseHousingFromText';

describe('parseHousingFromText - 定番フォーマット', () => {
    it('sample 1: Mana/Anima/Shirogane 6-6 Small', () => {
        const text = `Mana
Anima
Shirogane | 6-6 | Small | Commission

#FF14housing #FFXIVHousing #FF14ハウジング #FF14 #FFXIV`;
        const result = parseHousingFromText(text);
        expect(result.dc).toBe('Mana');
        expect(result.server).toBe('Anima');
        expect(result.area).toBe('Shirogane');
        expect(result.ward).toBe(6);
        expect(result.plot).toBe(6);
        expect(result.size).toBe('S');
    });

    it('sample 2: Materia/Bismarck/LavenderBeds 23-6 Large with prefix message', () => {
        const text = `完成しました！見にきてください！！！
ありがとうございます！

Materia
Bismarck
Lavender Beds | 23-6 | Large

#FF14housing #FFXIVHousing #FF14ハウジング #FF14 #FFXIV`;
        const result = parseHousingFromText(text);
        expect(result.dc).toBe('Materia');
        expect(result.server).toBe('Bismarck');
        expect(result.area).toBe('LavenderBeds');
        expect(result.ward).toBe(23);
        expect(result.plot).toBe(6);
        expect(result.size).toBe('L');
    });
});

describe('parseHousingFromText - 略称・俗語', () => {
    it('sample 3: Mana┆Hades┆⚐Gob 2-23 S (Unicode 縦線 + 飾り + 略称)', () => {
        const result = parseHousingFromText('Mana┆Hades┆⚐Gob 2-23 S');
        expect(result.dc).toBe('Mana');
        expect(result.server).toBe('Hades');
        expect(result.area).toBe('Goblet');
        expect(result.ward).toBe(2);
        expect(result.plot).toBe(23);
        expect(result.size).toBe('S');
    });

    it('sample 4: Mana-Ixionエンピ-4-2M (ハイフン連結 + 略称)', () => {
        const text = `【住所】
Mana-Ixionエンピ-4-2M

※見学の際はFCハウスのためご迷惑にならないように配慮をお願いいたします。`;
        const result = parseHousingFromText(text);
        expect(result.dc).toBe('Mana');
        expect(result.server).toBe('Ixion');
        expect(result.area).toBe('Empyreum');
        expect(result.ward).toBe(4);
        expect(result.plot).toBe(2);
        expect(result.size).toBe('M');
    });

    it('区切り文字なしの自由文', () => {
        const result = parseHousingFromText('シロガネ6番地6番に来てねManaのAnimaサーバーです');
        expect(result.area).toBe('Shirogane');
        expect(result.dc).toBe('Mana');
        expect(result.server).toBe('Anima');
        expect(result.ward).toBe(6);
        expect(result.plot).toBe(6);
    });

    it('鯖俗語 (Anima鯖)', () => {
        const result = parseHousingFromText('アニマ鯖のシロガネ6-6');
        expect(result.server).toBe('Anima');
        expect(result.dc).toBe('Mana');
        expect(result.area).toBe('Shirogane');
        expect(result.ward).toBe(6);
        expect(result.plot).toBe(6);
    });

    it('FC個室キーワード検出', () => {
        const result = parseHousingFromText('Lavender Beds 12-3 FC個室');
        expect(result.size).toBe('PrivateRoom');
        expect(result.area).toBe('LavenderBeds');
        expect(result.ward).toBe(12);
        expect(result.plot).toBe(3);
    });

    it('アパート名検出 (トップマスト)', () => {
        const result = parseHousingFromText('Mana / Anima / トップマスト');
        expect(result.area).toBe('Mist');
        expect(result.size).toBe('Apartment');
    });
});

describe('parseHousingFromText - 棄却ケース', () => {
    it('完全自由文 (語句なし) は抽出ゼロ', () => {
        const result = parseHousingFromText('家完成しました〜！ 来てね');
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
        expect(result.area).toBeUndefined();
        expect(result.ward).toBeUndefined();
        expect(result.size).toBeUndefined();
    });

    it('範囲外番地は棄却 (99-99)', () => {
        const result = parseHousingFromText('シロガネ 99-99 L');
        expect(result.ward).toBeUndefined();
        expect(result.plot).toBeUndefined();
        expect(result.area).toBe('Shirogane');
        expect(result.size).toBe('L');
    });

    it('DC とサーバーの矛盾 (Mana + Bismarck) で棄却', () => {
        const result = parseHousingFromText('Mana Bismarck シロガネ 6-6 S');
        expect(result.ambiguity).toContain('dcServerMismatch');
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
        expect(result.area).toBe('Shirogane');
    });
});

describe('parseHousingFromText - 俗称 alias', () => {
    it('葉脈 → LavenderBeds', () => {
        const result = parseHousingFromText('葉脈 12-3 M');
        expect(result.area).toBe('LavenderBeds');
        expect(result.ward).toBe(12);
        expect(result.plot).toBe(3);
        expect(result.size).toBe('M');
    });
});

describe('parseHousingFromText - 短い ASCII alias 誤爆防止 (2026-07-10 実バグ)', () => {
    it('英語自由文の "had" をサーバー Hades と誤検出しない (housingsnap og:description)', () => {
        // 実際の housingsnap.com/47205 の og:description。"had" が Had(=Hades/Mana) と exact 一致し
        // まったく別物件に "ManaのHades" が入力される誤爆を起こしていた。
        const result = parseHousingFromText(
            "rainforest [M]\ni've finally had the energy and motivation to redo my personal shirogane home. i opted for an overgrown build",
        );
        expect(result.server).toBeUndefined();
        expect(result.dc).toBeUndefined();
        expect(result.area).toBe('Shirogane'); // area だけは正しく拾える
    });

    it('フル名 "Mana"/"Hades" は従来どおり検出する (退行なし)', () => {
        const result = parseHousingFromText('Mana Hades シロガネ 6-6 S');
        expect(result.dc).toBe('Mana');
        expect(result.server).toBe('Hades');
    });

    it('NA 英語表記 "crystal | goblin | shirogane | w21 p58" を正しく抽出', () => {
        const result = parseHousingFromText('crystal | goblin | shirogane | w21 p58');
        expect(result.dc).toBe('Crystal');
        expect(result.server).toBe('Goblin');
        expect(result.area).toBe('Shirogane');
        expect(result.ward).toBe(21);
        expect(result.plot).toBe(58);
    });
});
