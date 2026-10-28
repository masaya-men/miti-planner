import { describe, it, expect } from 'vitest';
import { parseHousingFromText } from '../../lib/housing/parseHousingFromText';

/**
 * ① アパート自動判定の根治 (2026-07-13 round2 A-4・最重要)。
 *
 * 根因: WARD_PLOT_DASH_RE (家用「区-番地」正規表現) がアパート文脈でも "N-M" を拾ってしまい、
 * "Topmast 1-13" (号棟1・部屋13) を誤って ward=1/plot=13 と読んでいた。
 * 対策: アパート文脈 (size candidates に 'Apartment' が入っている) が確定している間は
 * ward/plot 割当を一切スキップし、号棟(1|2 のみ)-部屋番号の "N-M" と、残った独立の
 * 数値トークンちょうど1つを区とみなす保守的な抽出に切り替える。確信が持てないものは
 * すべて undefined のまま返す (誤値を作らない)。
 */
describe('parseHousingFromText - ① アパート自動判定の根治 (2026-07-13 round2 A-4)', () => {
    it('本番テスト対象ツイート "Mist | 17 | Topmast 1-13 | Apartment" → 区17・号棟1・部屋13 (誤 ward=1/plot=13 にならない)', () => {
        const result = parseHousingFromText('Mist | 17 | Topmast 1-13 | Apartment');
        expect(result.area).toBe('Mist');
        expect(result.size).toBe('Apartment');
        // 根因だった誤読 (ward=1/plot=13) が起きていないことを明示的に固定する。
        expect(result.ward).not.toBe(1);
        expect(result.plot).toBeUndefined();
        // このテキストでは号棟-部屋番号・区とも保守的抽出で正しく取れる (確信が持てるケース)。
        expect(result.ward).toBe(17);
        expect(result.apartmentBuilding).toBe(1);
        expect(result.roomNumber).toBe(13);
    });

    it('語順違い: アパート名/サイズ語が先頭でも同じ結果になる', () => {
        const result = parseHousingFromText('Apartment | Mist | 17 | Topmast 1-13');
        expect(result.area).toBe('Mist');
        expect(result.size).toBe('Apartment');
        expect(result.ward).toBe(17);
        expect(result.apartmentBuilding).toBe(1);
        expect(result.roomNumber).toBe(13);
    });

    it('語順違い: 号棟-部屋番号が先頭でも同じ結果になる', () => {
        const result = parseHousingFromText('Topmast 1-13 | Mist | 17 | Apartment');
        expect(result.area).toBe('Mist');
        expect(result.ward).toBe(17);
        expect(result.apartmentBuilding).toBe(1);
        expect(result.roomNumber).toBe(13);
    });

    it('アパート名のみ (トップマスト表記ゆれ・日本語) でも区/号棟/部屋が誤爆しない', () => {
        const result = parseHousingFromText('Mana / Anima / トップマスト 17区 1-13');
        expect(result.area).toBe('Mist');
        expect(result.size).toBe('Apartment');
        expect(result.plot).toBeUndefined();
    });

    it('号棟番号が 1/2 以外 (例 "3-13") は確信が持てないため apartmentBuilding/roomNumber を空欄にする', () => {
        const result = parseHousingFromText('Mist | Topmast 3-13 | Apartment');
        expect(result.size).toBe('Apartment');
        expect(result.apartmentBuilding).toBeUndefined();
        expect(result.roomNumber).toBeUndefined();
        // 誤って ward/plot 側にも化けない (アパート文脈では house 用パターンを適用しない)
        expect(result.plot).toBeUndefined();
    });

    it('区の手がかりが複数残って曖昧なときは ward を空欄にする (誤値より空欄優先)', () => {
        // "17" と "5" の 2 つの独立した数値が残り、どちらが区か決め打てない。
        const result = parseHousingFromText('Mist | 17 | 5 | Topmast 1-13 | Apartment');
        expect(result.size).toBe('Apartment');
        expect(result.apartmentBuilding).toBe(1);
        expect(result.roomNumber).toBe(13);
        expect(result.ward).toBeUndefined();
    });

    it('号棟-部屋番号の手がかりが無くても、区が単独で確信を持てれば区だけ入る', () => {
        const result = parseHousingFromText('Mist | 17 | Apartment');
        expect(result.size).toBe('Apartment');
        expect(result.ward).toBe(17);
        expect(result.apartmentBuilding).toBeUndefined();
        expect(result.roomNumber).toBeUndefined();
    });
});

/**
 * 家 / FC 個室の回帰確認 (A-4 の変更がアパート分岐に閉じていることの固定)。
 * これらはすべて isApartmentContext=false のまま従来どおり WARD_PLOT_DASH_RE 等で
 * ward/plot を取得する経路を通る。
 */
describe('parseHousingFromText - 家/個室の回帰 (A-4 でアパート判定に誤って化けない)', () => {
    it('"ミスト 23-6 Mサイズ" は従来どおり house 扱い (ward=23, plot=6, size=M)', () => {
        const result = parseHousingFromText('ミスト 23-6 Mサイズ');
        expect(result.area).toBe('Mist');
        expect(result.ward).toBe(23);
        expect(result.plot).toBe(6);
        expect(result.size).toBe('M');
        expect(result.apartmentBuilding).toBeUndefined();
        expect(result.roomNumber).toBeUndefined();
    });

    it('sample1/2 (定番フォーマット) は roomNumber/apartmentBuilding を持たない', () => {
        const result = parseHousingFromText('Mana | Anima | Shirogane | 6-6 | Small');
        expect(result.ward).toBe(6);
        expect(result.plot).toBe(6);
        expect(result.size).toBe('S');
        expect(result.apartmentBuilding).toBeUndefined();
        expect(result.roomNumber).toBeUndefined();
    });

    it('FC個室キーワード検出は house 扱いのまま (ward/plot 従来どおり・アパート化しない)', () => {
        const result = parseHousingFromText('Lavender Beds 12-3 FC個室');
        expect(result.size).toBe('PrivateRoom');
        expect(result.area).toBe('LavenderBeds');
        expect(result.ward).toBe(12);
        expect(result.plot).toBe(3);
        expect(result.apartmentBuilding).toBeUndefined();
    });

    it('NA 英語表記 "w21 p58" は house 扱いのまま (アパート文脈と誤認しない)', () => {
        const result = parseHousingFromText('crystal | goblin | shirogane | w21 p58');
        expect(result.ward).toBe(21);
        expect(result.plot).toBe(58);
        expect(result.apartmentBuilding).toBeUndefined();
        expect(result.roomNumber).toBeUndefined();
    });
});
