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

describe('parseHousingFromText - v2 実 HTML 由来のパターン (2026-07-10)', () => {
    // Test 4: 自由文 + 住所行をまとめて与えても、"had" は何にも一致しないので server=Goblin になる。
    //   ("Had" は 2026-07-10 に Hades の alias から削除された。masterDataAliases.test.ts 参照)
    it('本文全体 (自由文 + 住所行) でも server=Goblin になる', () => {
        const text = [
            "i've finally had the energy and motivation to redo my personal shirogane home.",
            'crystal | goblin | shirogane | w21 p58.',
        ].join('\n');
        const result = parseHousingFromText(text);
        expect(result.server).toBe('Goblin');
        expect(result.dc).toBe('Crystal');
        expect(result.area).toBe('Shirogane');
        expect(result.ward).toBe(21);
        expect(result.plot).toBe(58);
        expect(result.ambiguity).toEqual([]);
    });

    // Test 5: "w21 p58." の末尾ピリオドが正規表現の \b を壊さない (plot=58 が取れる)。
    it('w21 p58. の末尾ピリオドで plot が壊れない', () => {
        const result = parseHousingFromText('crystal | goblin | shirogane | w21 p58.');
        expect(result.ward).toBe(21);
        expect(result.plot).toBe(58);
        expect(result.dc).toBe('Crystal');
        expect(result.server).toBe('Goblin');
        expect(result.area).toBe('Shirogane');
    });

    // Test 6: 英語自由文の "had" は何にも一致しない (Hades の alias から削除済み)。
    it('英語自由文の "had" は DC/サーバーに化けない', () => {
        const result = parseHousingFromText('i finally had time to build');
        expect(result.server).toBeUndefined();
        expect(result.dc).toBeUndefined();
    });

    it('"had" 単体でも何にも一致しない (辞書から消えているので文脈に依らない)', () => {
        expect(parseHousingFromText('had').server).toBeUndefined();
        expect(parseHousingFromText('had').dc).toBeUndefined();
        // 区切り記号だらけの「住所らしい」文脈でも化けない
        expect(parseHousingFromText('had | had | had | 5-3').server).toBeUndefined();
    });
});

/**
 * 英語の一般語が DC/サーバーに化けないことの退行ガード (2026-07-10)。
 *
 * 根治は**辞書側**で行った (`Man` / `Had` / `Ex` 等 63 件の短い ASCII 略称を
 * DC・サーバーの alias から削除。 `masterDataAliases.test.ts` が再登録を機械的に禁止)。
 * かつては誤爆した結果 `multipleDc` に引っかかり、 正しい DC/サーバーまで巻き添えで
 * 棄却されていた。 ここではその症状が二度と出ないことを固定する。
 */
describe('parseHousingFromText - 英語の一般語が DC/サーバーに化けない', () => {
    it('英文の "man" が Crystal の住所を巻き添えにしない', () => {
        const result = parseHousingFromText('man this took ages. Crystal Goblin Shirogane 21-58');
        expect(result.ambiguity).toEqual([]);
        expect(result.dc).toBe('Crystal');
        expect(result.server).toBe('Goblin');
        expect(result.ward).toBe(21);
        expect(result.plot).toBe(58);
    });

    it('英文の "had" が Crystal の住所を巻き添えにしない', () => {
        const result = parseHousingFromText('i had fun. crystal | goblin | shirogane | w21 p58');
        expect(result.ambiguity).toEqual([]);
        expect(result.dc).toBe('Crystal');
        expect(result.server).toBe('Goblin');
    });

    it('英文の "ex" が Crystal の住所を巻き添えにしない', () => {
        const result = parseHousingFromText(
            'ex boyfriend built this. crystal | goblin | shirogane | w21 p58',
        );
        expect(result.ambiguity).toEqual([]);
        expect(result.dc).toBe('Crystal');
        expect(result.server).toBe('Goblin');
    });

    it('エリアの短縮 alias は実在するので残す (sample3 の Gob→Goblet)', () => {
        const result = parseHousingFromText('Mana┆Hades┆⚐Gob 2-23 S');
        expect(result.area).toBe('Goblet');
        expect(result.server).toBe('Hades');
    });
});

/**
 * 敵対的レビューで実証された誤爆パターンの回帰ガード (2026-07-10)。
 * 住所を書いた文にはほぼ必ず ward/plot が付くので、 「ward/plot があれば略称を許す」 という
 * 文脈ゲートでは**一番危ない場面で正確にゲートが開いて**しまう。 だから辞書側で根治した。
 */
describe('parseHousingFromText - ward/plot を含む英文でも誤爆しない', () => {
    it('"Finally had my dream home! Mist w5 p3 M" が Hades を捏造しない', () => {
        const result = parseHousingFromText('Finally had my dream home! Mist w5 p3 M');
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
        // 住所そのものは従来どおり取れる
        expect(result.area).toBe('Mist');
        expect(result.ward).toBe(5);
        expect(result.plot).toBe(3);
    });

    it('"my ex visited" の "ex" が Excalibur を捏造しない', () => {
        const result = parseHousingFromText('my ex visited Mist 5-3 M');
        expect(result.server).toBeUndefined();
        expect(result.dc).toBeUndefined();
    });

    it('別 DC のサーバーが複数一致したら曖昧として棄却する (multipleServer)', () => {
        // Hades=Mana / Unicorn=Meteor。 出現順の先頭 (Hades) が黙って勝ってはいけない。
        // multipleDc は「DC 名そのもの」 の複数一致しか見ないのでこれを取りこぼしていた。
        const result = parseHousingFromText('Hades | Unicorn | Mist | 5-3');
        expect(result.ambiguity).toContain('multipleServer');
        expect(result.dc).toBeUndefined();
        expect(result.server).toBeUndefined();
    });
});

/**
 * エリア名 (`Mist` / `Goblet`) はそのまま英単語だが、 エリアの短縮 alias (`Gob` / `Emp`) は
 * 実在するので残してある。 部分一致 pass ではエリアの短縮 alias を使わないことで、
 * 文中の一般語が正解を奪わないようにしている。
 */
describe('parseHousingFromText - area は英単語に奪われない', () => {
    it('"Emp 5-3 M what a goblet of wine" は Empyreum ("goblet" に奪われない)', () => {
        expect(parseHousingFromText('Emp 5-3 M what a goblet of wine').area).toBe('Empyreum');
    });

    it('"Gob 5-3 M through the morning mist" は Goblet ("mist" に奪われない)', () => {
        expect(parseHousingFromText('Gob 5-3 M through the morning mist').area).toBe('Goblet');
    });
});

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
