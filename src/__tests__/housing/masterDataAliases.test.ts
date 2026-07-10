import { describe, it, expect } from 'vitest';
import { serverMasterData, housingAreaMasterData } from '../../data/masterData';

/**
 * 住所抽出の誤爆を「パーサ側のフィルタ」ではなく「辞書の不変条件」で防ぐ (2026-07-10)。
 *
 * 短い ASCII 略称は英語の一般語と衝突する (`Man`=man / `Had`=had / `Ex`=ex / `Gil`=gil)。
 * これを alias に載せると、 ツイートの英語自由文がそのまま DC/サーバーに化ける。
 * パーサ側で文脈ゲートや質フィルタを重ねるのは対症療法なので、 データ側で禁止する。
 */
const isShortAscii = (alias: string): boolean =>
    alias.length < 4 && /^[\x00-\x7f]+$/.test(alias);

describe('masterData: DC / サーバーの alias に短い ASCII 略称を入れない', () => {
    it('DC の alias', () => {
        const offenders: string[] = [];
        for (const [dcId, dc] of Object.entries(serverMasterData)) {
            for (const alias of dc.aliases) {
                if (isShortAscii(alias)) offenders.push(`${dcId}: "${alias}"`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('サーバーの alias', () => {
        const offenders: string[] = [];
        for (const dc of Object.values(serverMasterData)) {
            for (const [serverId, aliases] of Object.entries(dc.servers)) {
                for (const alias of aliases) {
                    if (isShortAscii(alias)) offenders.push(`${serverId}: "${alias}"`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('同じ alias が DC とサーバーの両方に登録されていない (Mat = Mateus と Materia の自己矛盾を防ぐ)', () => {
        const dcAliases = new Set<string>();
        const serverAliases = new Set<string>();
        for (const dc of Object.values(serverMasterData)) {
            for (const a of dc.aliases) dcAliases.add(a.toLowerCase());
            for (const aliases of Object.values(dc.servers)) {
                for (const a of aliases) serverAliases.add(a.toLowerCase());
            }
        }
        const collisions = [...dcAliases].filter((a) => serverAliases.has(a));
        expect(collisions).toEqual([]);
    });

    it('フル名と日本語 alias は残っている (削除しすぎていない)', () => {
        expect(serverMasterData.Mana.aliases).toContain('Mana');
        expect(serverMasterData.Mana.aliases).toContain('マナ');
        expect(serverMasterData.Mana.servers.Hades).toContain('Hades');
        expect(serverMasterData.Mana.servers.Hades).toContain('ハデス');
        // 4 文字以上の ASCII 略称は実使用があるので残す
        expect(serverMasterData.Primal.servers.Excalibur).toContain('Exca');
        expect(serverMasterData.Crystal.aliases).toContain('Crys');
    });
});

/**
 * エリアの短縮 alias は**実在する**ので残す (実ツイート `Mana┆Hades┆⚐Gob 2-23 S`)。
 * エリアは 5 択しかなく、 誤って別エリアになっても住所の他フィールドで気付ける。
 */
describe('masterData: エリアの短縮 alias は残す', () => {
    it('Gob / Mis / Emp / LB が生きている', () => {
        expect(housingAreaMasterData.Goblet.aliases).toContain('Gob');
        expect(housingAreaMasterData.Mist.aliases).toContain('Mis');
        expect(housingAreaMasterData.Empyreum.aliases).toContain('Emp');
        expect(housingAreaMasterData.LavenderBeds.aliases).toContain('LB');
    });
});
