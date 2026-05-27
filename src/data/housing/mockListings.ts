import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';
import type { Region } from './dcServerMap';

/**
 * ギャラリー表示用 view-model。 Firestore `HousingListing` → galleryAdapter 経由でこの形に整形される。
 *
 * - house: plot + size を持つ。 apartmentBuilding / roomNumber は undefined
 * - apartment: apartmentBuilding (1=本街 / 2=拡張街) + roomNumber を持つ。 plot/size は undefined
 *
 * `buildingType` は 2026-05-27 アパート対応で追加。 旧 mock データ (MOCK_LISTINGS) は plot/size を持つため
 * `buildingType` 未定義 = house として表示側で扱う (後方互換)。
 */
export interface MockListing {
    id: string;
    ownerUid: string;
    dc: string;
    server: string;
    region: Region;
    area: HousingArea;
    ward: number;
    /** 'house' | 'apartment'。 旧データは未定義 (= house 扱い) */
    buildingType?: 'house' | 'apartment';
    /** house 専用: 区画番号 1-60 (本街 1-30 / 拡張街 31-60) */
    plot?: number;
    /** house 専用: S/M/L */
    size?: HousingSize;
    /** apartment 専用: 号棟 1=本街 / 2=拡張街 */
    apartmentBuilding?: 1 | 2;
    /** apartment 専用: 部屋番号 1-90 */
    roomNumber?: number;
    imageMode: 'sns' | 'thumbnail' | 'none';
    postUrl?: string;
    ogImageUrl?: string;
    thumbnailPath?: string;
    /** 旧 thumbnail mode の複数画像。 2026-05-27 追加 (slideshow 用)。 */
    thumbnailPaths?: string[];
    /**
     * 2026-05-27 追加: 外部画像 URL リスト (OGP / Twitter 静止画ツイート)。
     * card 一覧の ambient slideshow 用に galleryAdapter で pass-through。
     */
    sourceImageUrls?: string[];
    /** 2026-05-27 追加: YouTube 動画 ID (storyboard 3 枚 slideshow + iframe 再生用)。 */
    youtubeVideoId?: string;
    /** 2026-05-27 追加: Twitter 動画 mp4 URL (proxy 経由で <video> 再生用)。 */
    videoUrl?: string;
    /** 2026-05-27 追加: Twitter 動画 poster URL (slideshow 1 枚 + video poster 属性)。 */
    videoPosterUrl?: string;
    /** 2026-05-27 追加: 動画 aspect ratio (詳細モーダルでの aspect 確保用)。 */
    videoAspectRatio?: number;
    tags: string[];
    description?: string;
    createdAt: number;
    /**
     * 2026-05-27 (Phase 2-1) 追加: 家主が最後に「今もあります」 ボタンで現役確認した時刻 (ms epoch)。
     * mock では createdAt と同値で生成。 重複表示時の sort key、 1 ヶ月以上更新なしバッジに使用。
     */
    lastConfirmedAt: number;
}

const EPOCH_BASE = 1715000000000;

function gen(
    i: number,
    dc: string,
    region: Region,
    server: string,
    area: HousingArea,
    ward: number,
    plot: number,
    size: HousingSize,
    tags: string[],
    desc: string,
): MockListing {
    const thumbIndex = (i % 10) + 1;
    const createdAt = EPOCH_BASE - i * 86400_000;
    return {
        id: `mock-${i.toString().padStart(3, '0')}`,
        ownerUid: `mock-user-${(i % 8) + 1}`,
        dc,
        server,
        region,
        area,
        ward,
        plot,
        size,
        imageMode: 'thumbnail',
        thumbnailPath: `/housing/mock-thumbs/${thumbIndex}.svg`,
        tags,
        description: desc,
        createdAt,
        lastConfirmedAt: createdAt,
    };
}

export const MOCK_LISTINGS: MockListing[] = [
    gen(1, 'Mana', 'JP', 'Anima', 'Shirogane', 3, 12, 'M', ['wafu', 'cafe'], '和風カフェ'),
    gen(2, 'Mana', 'JP', 'Anima', 'Shirogane', 3, 15, 'S', ['wafu'], '日本庭園のあるお家'),
    gen(3, 'Mana', 'JP', 'Pandaemonium', 'LavenderBeds', 5, 7, 'L', ['modern'], 'モダン豪邸'),
    gen(4, 'Mana', 'JP', 'Pandaemonium', 'Shirogane', 8, 22, 'M', ['wafu', 'shrine'], '神社風'),
    gen(5, 'Elemental', 'JP', 'Aegis', 'Mist', 12, 4, 'L', ['mediterranean'], '地中海風ヴィラ'),
    gen(6, 'Elemental', 'JP', 'Atomos', 'Goblet', 7, 18, 'M', ['gothic'], 'ゴシック邸'),
    gen(7, 'Gaia', 'JP', 'Bahamut', 'Empyreum', 2, 9, 'S', ['scifi'], '未来都市の一角'),
    gen(8, 'Gaia', 'JP', 'Durandal', 'Empyreum', 4, 14, 'L', ['nordic'], '北欧コテージ'),
    gen(9, 'Mana', 'JP', 'Anima', 'Mist', 6, 27, 'M', ['library'], '書斎の家'),
    gen(10, 'Aether', 'NA', 'Cactuar', 'Shirogane', 3, 13, 'M', ['wafu', 'cafe'], '抹茶カフェ'),
    gen(11, 'Aether', 'NA', 'Gilgamesh', 'LavenderBeds', 9, 1, 'L', ['fantasy'], 'ファンタジー城'),
    gen(12, 'Aether', 'NA', 'Faerie', 'Goblet', 11, 23, 'S', ['steampunk'], 'スチームパンク工房'),
    gen(13, 'Primal', 'NA', 'Excalibur', 'Mist', 4, 30, 'L', ['beach', 'summer'], 'ビーチハウス'),
    gen(14, 'Primal', 'NA', 'Leviathan', 'Empyreum', 1, 17, 'M', ['library', 'dark'], '魔導書庫'),
    gen(15, 'Crystal', 'NA', 'Balmung', 'Shirogane', 5, 19, 'L', ['onsen'], '温泉旅館'),
    gen(16, 'Crystal', 'NA', 'Goblin', 'LavenderBeds', 14, 8, 'S', ['minimal'], 'ミニマルアパート'),
    gen(17, 'Crystal', 'NA', 'Mateus', 'Goblet', 2, 5, 'S', ['boho'], 'ボヘミアン'),
    gen(18, 'Dynamis', 'NA', 'Halicarnassus', 'Empyreum', 6, 26, 'M', ['restaurant'], 'レストラン'),
    gen(19, 'Chaos', 'EU', 'Moogle', 'Shirogane', 7, 11, 'L', ['wafu'], '和モダン邸'),
    gen(20, 'Chaos', 'EU', 'Ragnarok', 'Mist', 3, 2, 'S', ['witch', 'fantasy'], '魔女の小屋'),
    gen(21, 'Light', 'EU', 'Lich', 'LavenderBeds', 10, 28, 'M', ['cottagecore'], 'コテージコア'),
    gen(22, 'Light', 'EU', 'Phoenix', 'Goblet', 5, 16, 'L', ['gothic', 'dark'], 'ダークゴシック'),
    gen(23, 'Light', 'EU', 'Twintania', 'Empyreum', 8, 24, 'S', ['scifi'], 'SF研究所'),
    gen(24, 'Materia', 'OCE', 'Bismarck', 'Mist', 9, 6, 'M', ['nordic'], '北欧ロッジ'),
    gen(25, 'Materia', 'OCE', 'Ravana', 'Shirogane', 4, 25, 'L', ['wafu', 'samurai'], '武家屋敷'),
    gen(26, 'Mana', 'JP', 'Titan', 'Mist', 1, 1, 'S', ['cafe'], 'コーヒースタンド'),
    gen(27, 'Mana', 'JP', 'Hades', 'LavenderBeds', 2, 10, 'M', ['vintage'], 'ヴィンテージ'),
    gen(28, 'Elemental', 'JP', 'Carbuncle', 'Goblet', 13, 20, 'L', ['fantasy'], '魔法学校'),
    gen(29, 'Gaia', 'JP', 'Ifrit', 'Shirogane', 6, 3, 'S', ['minimal'], 'シロガネアパート'),
    gen(30, 'Aether', 'NA', 'Sargatanas', 'Empyreum', 7, 21, 'M', ['library'], '図書館'),
    gen(31, 'Primal', 'NA', 'Famfrit', 'Mist', 5, 29, 'S', ['beach'], '海辺の小屋'),
    gen(32, 'Crystal', 'NA', 'Brynhildr', 'LavenderBeds', 6, 7, 'L', ['romantic'], 'ロマンチック'),
    gen(33, 'Chaos', 'EU', 'Cerberus', 'Goblet', 1, 12, 'M', ['restaurant', 'bar'], 'バー'),
    gen(34, 'Chaos', 'EU', 'Spriggan', 'Empyreum', 9, 18, 'S', ['witch'], '占い屋'),
    gen(35, 'Light', 'EU', 'Odin', 'Shirogane', 8, 4, 'L', ['wafu', 'shrine'], '大社'),
    gen(36, 'Materia', 'OCE', 'Sephirot', 'Mist', 7, 15, 'M', ['boho'], 'ボヘミアンビーチ'),
    gen(37, 'Mana', 'JP', 'Asura', 'Goblet', 12, 8, 'L', ['gothic'], 'ゴシック修道院'),
    gen(38, 'Gaia', 'JP', 'Ridill', 'LavenderBeds', 4, 22, 'M', ['cafe'], 'アパートカフェ'),
    gen(39, 'Aether', 'NA', 'Midgardsormr', 'Mist', 8, 13, 'M', ['modern'], 'モダンハウス'),
    gen(40, 'Primal', 'NA', 'Hyperion', 'Empyreum', 3, 9, 'L', ['scifi'], '宇宙基地'),
    gen(41, 'Crystal', 'NA', 'Coeurl', 'Shirogane', 9, 17, 'S', ['onsen'], '湯治場'),
    gen(42, 'Chaos', 'EU', 'Louisoix', 'LavenderBeds', 11, 26, 'M', ['fantasy'], 'エルフの里'),
    gen(43, 'Light', 'EU', 'Raiden', 'Goblet', 6, 11, 'L', ['steampunk'], 'スチーム工房'),
    gen(44, 'Materia', 'OCE', 'Sophia', 'Empyreum', 5, 23, 'S', ['library'], '小さな本屋'),
    gen(45, 'Mana', 'JP', 'Chocobo', 'Mist', 2, 5, 'M', ['nordic'], '北欧山小屋'),
    gen(46, 'Elemental', 'JP', 'Gungnir', 'Shirogane', 11, 19, 'L', ['wafu', 'cafe'], '町家カフェ'),
    gen(47, 'Aether', 'NA', 'Adamantoise', 'Goblet', 4, 24, 'M', ['vintage'], 'ヴィンテージカフェ'),
    gen(48, 'Crystal', 'NA', 'Diabolos', 'LavenderBeds', 13, 14, 'S', ['minimal'], 'ロフト風'),
    gen(49, 'Chaos', 'EU', 'Phantom', 'Mist', 10, 6, 'L', ['ghibli'], 'ジブリ風'),
    gen(50, 'Light', 'EU', 'Alpha', 'Empyreum', 7, 27, 'M', ['cottagecore'], 'コテージ村'),
];

export const SAMPLE_THEME_TAGS: string[] = [
    'wafu', 'modern', 'cafe', 'gothic', 'fantasy', 'scifi', 'minimal', 'boho', 'nordic', 'cottagecore',
];
