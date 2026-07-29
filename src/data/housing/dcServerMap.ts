export type Region = 'JP' | 'NA' | 'EU' | 'OCE' | 'KR' | 'CN' | 'TW';

export interface DCServers {
    region: Region;
    servers: string[];
}

export const DC_SERVER_MAP: Record<string, DCServers> = {
    Elemental: { region: 'JP', servers: ['Aegis', 'Atomos', 'Carbuncle', 'Garuda', 'Gungnir', 'Kujata', 'Tonberry', 'Typhon'] },
    Gaia: { region: 'JP', servers: ['Alexander', 'Bahamut', 'Durandal', 'Fenrir', 'Ifrit', 'Ridill', 'Tiamat', 'Ultima'] },
    Mana: { region: 'JP', servers: ['Anima', 'Asura', 'Chocobo', 'Hades', 'Ixion', 'Masamune', 'Pandaemonium', 'Titan'] },
    Meteor: { region: 'JP', servers: ['Belias', 'Mandragora', 'Ramuh', 'Shinryu', 'Unicorn', 'Valefor', 'Yojimbo', 'Zeromus'] },
    Aether: { region: 'NA', servers: ['Adamantoise', 'Cactuar', 'Faerie', 'Gilgamesh', 'Jenova', 'Midgardsormr', 'Sargatanas', 'Siren'] },
    Primal: { region: 'NA', servers: ['Behemoth', 'Excalibur', 'Exodus', 'Famfrit', 'Hyperion', 'Lamia', 'Leviathan', 'Ultros'] },
    Crystal: { region: 'NA', servers: ['Balmung', 'Brynhildr', 'Coeurl', 'Diabolos', 'Goblin', 'Malboro', 'Mateus', 'Zalera'] },
    Dynamis: { region: 'NA', servers: ['Halicarnassus', 'Maduin', 'Marilith', 'Seraph', 'Cuchulainn', 'Golem', 'Kraken', 'Rafflesia'] },
    Chaos: { region: 'EU', servers: ['Cerberus', 'Louisoix', 'Moogle', 'Omega', 'Phantom', 'Ragnarok', 'Sagittarius', 'Spriggan'] },
    Light: { region: 'EU', servers: ['Alpha', 'Lich', 'Odin', 'Phoenix', 'Raiden', 'Shiva', 'Twintania', 'Zodiark'] },
    Shadow: { region: 'EU', servers: ['Innocence', 'Pixie', 'Titania', 'Tycoon'] },
    Materia: { region: 'OCE', servers: ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'] },
    // 韓国 (物理分離リージョン)。ワールド名はグローバルと同名だが dc+server の組で常に区別される。
    Korea: { region: 'KR', servers: ['Carbuncle', 'Chocobo', 'Moogle', 'Tonberry', 'Fenrir'] },
    // 中国 (物理分離リージョン)。内部キーは正典 CSV の en 列を英数字のみに詰めた CamelCase。
    ChocoboCN: { region: 'CN', servers: ['RubySea', 'Yanxia', 'Haimaochaya', 'CosmicHarmony', 'PhantomIslands', 'TheHolyGround', 'SproutPond', 'AmberPlains'] },
    MoogleCN: { region: 'CN', servers: ['Shirogane', 'RhalgrsReach', 'PlatinumMirage', 'TravelersDock', 'TheDawnChamber', 'TheAery', 'DreamfeatherRealm', 'HaukkeManor'] },
    FatCatCN: { region: 'CN', servers: ['AmethystShallows', 'MorDhona', 'TheGreatWall', 'BreezyBeach', 'TheAurumVale', 'CrescentCove', 'TheLostCity'] },
    MameshibaCN: { region: 'CN', servers: ['TheCrystalTower', 'SilvertearLake', 'CostaDelSol', 'Ishgard', 'BlackTeaRiver'] },
    // 台湾/香港/マカオ/シンガポール/マレーシア (物理分離リージョン・UserJoy運営、2025-12-10開始)。
    // 公式サイト (https://www.ffxiv.com.tw/web/worldstatus/index.aspx) を2026-07-27に再確認した結果、
    // 全7ワールドは単一のDCに属する (中国版のような複数DC分割はまだ発生していない)。
    // DCの正式名称は公式サイト・公式告知のいずれにも見当たらないため、内部キーは`TW`をそのまま採用
    // (表示名は用語辞書側で解決するため内部キーが英語風の仮名でも実害はない)。
    // ワールド名は公式サイト表記(繁体字)をそのまま内部キーにはできないため、
    // 英語表記 (Ifrit/Garuda/Leviathan/Phoenix/Odin/Bahamut/Titan) をローマ字内部キーに採用。
    TW: { region: 'TW', servers: ['Ifrit', 'Garuda', 'Leviathan', 'Phoenix', 'Odin', 'Bahamut', 'Titan'] },
};

export const ALL_DCS: string[] = Object.keys(DC_SERVER_MAP);
export const ALL_REGIONS: Region[] = ['JP', 'NA', 'EU', 'OCE', 'KR', 'CN', 'TW'];

export function dcsForRegion(region: Region): string[] {
    return ALL_DCS.filter((dc) => DC_SERVER_MAP[dc].region === region);
}

export function serversForDC(dc: string): string[] {
    return DC_SERVER_MAP[dc]?.servers ?? [];
}

export function regionForDC(dc: string): Region | null {
    return DC_SERVER_MAP[dc]?.region ?? null;
}

/**
 * 日本ワールド / 日本 DC のカタカナ読み (検索専用)。英語表記のワールド/DC 名を
 * 日本語カタカナでも検索できるようにする。略称 (例「パンデモ」) は検索の部分一致で
 * 自動的にヒットするため、正式な読みのみ登録する (造語・略称を辞書に足さない)。
 * 北米/欧州/オセアニアのワールドは公式カタカナが無いため対象外 (英語検索のまま)。
 * 読みはユーザー (FF14 プレイヤー) 検証済み (2026-07-13)。
 */
export const JP_KATAKANA_READINGS: Record<string, string> = {
    // DC
    Elemental: 'エレメンタル', Gaia: 'ガイア', Mana: 'マナ', Meteor: 'メテオ',
    // Elemental ワールド
    Aegis: 'イージス', Atomos: 'アトモス', Carbuncle: 'カーバンクル', Garuda: 'ガルーダ',
    Gungnir: 'グングニル', Kujata: 'クジャタ', Tonberry: 'トンベリ', Typhon: 'テュポーン',
    // Gaia ワールド
    Alexander: 'アレキサンダー', Bahamut: 'バハムート', Durandal: 'デュランダル', Fenrir: 'フェンリル',
    Ifrit: 'イフリート', Ridill: 'リディル', Tiamat: 'ティアマット', Ultima: 'アルテマ',
    // Mana ワールド
    Anima: 'アニマ', Asura: 'アスラ', Chocobo: 'チョコボ', Hades: 'ハーデス',
    Ixion: 'イクシオン', Masamune: 'マサムネ', Pandaemonium: 'パンデモニウム', Titan: 'タイタン',
    // Meteor ワールド
    Belias: 'ベリアス', Mandragora: 'マンドラゴラ', Ramuh: 'ラムウ', Shinryu: 'シンリュウ',
    Unicorn: 'ユニコーン', Valefor: 'ヴァルファーレ', Yojimbo: 'ヨウジンボウ', Zeromus: 'ゼロムス',
};

/** 英語のワールド/DC 名にカタカナ読みがあれば返す (日本のみ・検索用)。無ければ null。 */
export function katakanaReading(name: string): string | null {
    return JP_KATAKANA_READINGS[name] ?? null;
}
