// ファイル名: masterData.ts

// 対応言語コード (i18n キーと整合)
export const MASTER_LANGS = ['ja', 'en', 'ko', 'zh'] as const;
export type MasterLang = typeof MASTER_LANGS[number];
export type LocalizedString = Record<MasterLang, string>;

// サーバーマスターデータの型
interface ServerData {
  aliases: string[];
  servers: Record<string, string[]>;
}

// ハウジングエリアの型 (多言語対応: 2026-05-27)
// name / apartment_name は全言語必須。 新言語追加時は MASTER_LANGS に追加 + 各エリアに値を埋める。
export interface HousingAreaData {
  name: LocalizedString;
  apartment_name: LocalizedString;
  aliases: string[];
}

// ハウジングサイズの型
interface HousingSizeData {
  id: string;
  label: string;
  aliases: string[];
}

/**
 * 1. データセンターとサーバーのマスターデータ
 *
 * ⚠ **DC / サーバーの alias に「4 文字未満の ASCII 略称」を足してはいけない**
 * (`src/__tests__/housing/masterDataAliases.test.ts` が機械的に禁止している)。
 *
 * 経緯 (2026-07-10): かつて「英略称を徹底網羅」 として `Man`(Mana) / `Had`(Hades) /
 * `Ex`(Excalibur) / `Gil`(Gilgamesh) 等 63 件を登録していた。 しかしこれらは実際の投稿から
 * 採取した表記ゆれではなく**こちらで作った造語**で、 うち 31 件が英語の一般語と衝突していた。
 * 結果、 ツイート本文の "i've finally **had** the energy…" がサーバー Hades と一致し、
 * まったく別人の家の住所が登録される実バグを起こした。 `Mat` に至っては
 * Mateus(サーバー) と Materia(DC) の**両方**に登録され自己矛盾していた。
 *
 * 日本語話者は「ハデス」「マナ」 と書き、 英語話者は `Hades` とフル名か
 * `Exca` / `Gilg` のような 4 文字以上を使う。 3 文字略称の実使用例が確認できないため全削除した。
 * エリアの `Gob`→Goblet 等は実在のツイート `⚐Gob 2-23 S` に由来するので **残してある**
 * (エリアは 5 択しかなく誤爆の影響も小さい)。
 */
export const serverMasterData: Record<string, ServerData> = {
  // --- 日本 (JP) ---
  "Elemental": {
    "aliases": ["エレ", "エレメンタル", "Elemental", "Elem"],
    "servers": {
      "Aegis": ["イージス", "Aegis"],
      "Atomos": ["アトモス", "Atomos"],
      "Carbuncle": ["鞄", "カーバンクル", "カバン", "Carbuncle", "Carb", "Carbu"],
      "Garuda": ["ガル", "ガルーダ", "Garuda", "Garu"],
      "Gungnir": ["グングニル", "槍", "Gungnir", "Gung"],
      "Kujata": ["クジャタ", "Kujata", "Kuja"],
      "Tonberry": ["トンベリ", "トンベ", "Tonberry", "Tonbe"],
      "Typhon": ["テュポーン", "テュポン", "Typhon", "Typh"]
    }
  },
  "Gaia": {
    "aliases": ["ガイア", "Gaia"],
    "servers": {
      "Alexander": ["アレキ", "アレキサンダー", "Alexander", "Alex"],
      "Bahamut": ["バハ", "バハムート", "Bahamut", "Baha"],
      "Durandal": ["デュランダル", "デュラ", "Durandal", "Dura"],
      "Fenrir": ["フェンリル", "狼", "Fenrir"],
      "Ifrit": ["イフ", "イフリート", "Ifrit", "Ifri"],
      "Ridill": ["リディル", "Ridill", "Ridi"],
      "Tiamat": ["ティア", "ティアマト", "Tiamat"],
      "Ultima": ["アルテマ", "Ultima", "Ulti"]
    }
  },
  "Mana": {
    "aliases": ["マナ", "Mana"],
    "servers": {
      "Anima": ["アニマ", "Anima"],
      "Asura": ["アスラ", "Asura"],
      "Chocobo": ["チョコボ", "Chocobo", "Choco"],
      "Hades": ["ハデス", "Hades"],
      "Ixion": ["イクシオン", "イクシ", "Ixion"],
      "Masamune": ["マサムネ", "Masamune", "Masa"],
      "Pandaemonium": ["パンデモ", "パンデモニウム", "Pandaemonium", "Panda"],
      "Titan": ["タイタン", "蛸", "Titan"]
    }
  },
  "Meteor": {
    "aliases": ["メテオ", "Meteor", "Meteo"],
    "servers": {
      "Belias": ["ベリアス", "ベリ", "Belias", "Beli"],
      "Mandragora": ["マンドラ", "マンドラゴラ", "Mandragora", "Mandra", "Mando"],
      "Ramuh": ["ラムウ", "爺", "Ramuh"],
      "Shinryu": ["神竜", "シンリュウ", "Shinryu", "Shin"],
      "Unicorn": ["ユニコーン", "ユニ", "Unicorn"],
      "Valefor": ["ヴァルファーレ", "ヴァル", "Valefor", "Vale"],
      "Yojimbo": ["ヨウジンボウ", "用心棒", "Yojimbo", "Yoji"],
      "Zeromus": ["ゼロムス", "Zeromus", "Zero"]
    }
  },

  // --- 北米 (NA) ---
  "Aether": {
    "aliases": ["エーテル", "Aether"],
    "servers": {
      "Adamantoise": ["アダマンタイマイ", "Adamantoise", "Adam"],
      "Cactuar": ["サボテンダー", "Cactuar", "Cact"],
      "Faerie": ["フェアリー", "Faerie"],
      "Gilgamesh": ["ギルガメッシュ", "Gilgamesh", "Gilg"],
      "Jenova": ["ジェノバ", "Jenova"],
      "Midgardsormr": ["ミドガルズオルム", "Midgardsormr", "Middy"],
      "Sargatanas": ["サルガタナス", "Sargatanas", "Sarg"],
      "Siren": ["セイレーン", "Siren"]
    }
  },
  "Primal": {
    "aliases": ["プライマル", "Primal"],
    "servers": {
      "Behemoth": ["ベヒーモス", "Behemoth", "Behe"],
      "Excalibur": ["エクスカリバー", "Excalibur", "Exca"],
      "Exodus": ["エクソダス", "Exodus"],
      "Famfrit": ["ファムフリート", "Famfrit"],
      "Hyperion": ["ハイデリン", "Hyperion"],
      "Lamia": ["ラミア", "Lamia"],
      "Leviathan": ["リヴァイアサン", "Leviathan", "Levi"],
      "Ultros": ["オルトロス", "Ultros"]
    }
  },
  "Crystal": {
    "aliases": ["クリスタル", "Crystal", "Crys"],
    "servers": {
      "Balmung": ["バルムンク", "Balmung"],
      "Brynhildr": ["ブリュンヒルデ", "Brynhildr", "Bryn"],
      "Coeurl": ["クァール", "Coeurl"],
      "Diabolos": ["ディアボロス", "Diabolos"],
      "Goblin": ["ゴブリン", "Goblin"],
      "Malboro": ["モルボル", "Malboro"],
      "Mateus": ["マティウス", "Mateus"],
      "Zalera": ["ザルエラ", "Zalera"]
    }
  },
  "Dynamis": {
    "aliases": ["デュナミス", "Dynamis", "Dyna"],
    "servers": {
      "Halicarnassus": ["ハリカルナッソス", "Halicarnassus", "Hali"],
      "Maduin": ["マディーン", "Maduin"],
      "Marilith": ["マリリス", "Marilith", "Mari"],
      "Seraph": ["セラフ", "Seraph"],
      "Cuchulainn": ["クーフーリン", "Cuchulainn", "Cuch"],
      "Golem": ["ゴーレム", "Golem"],
      "Kraken": ["クラーケン", "Kraken"],
      "Rafflesia": ["ラフレシア", "Rafflesia"]
    }
  },

  // --- 欧州 (EU) ---
  "Chaos": {
    "aliases": ["カオス", "Chaos"],
    "servers": {
      "Cerberus": ["ケルベロス", "Cerberus", "Cerb"],
      "Louisoix": ["ルイゾワ", "Louisoix", "Loui"],
      "Moogle": ["モーグリ", "Moogle"],
      "Omega": ["オメガ", "Omega"],
      "Phantom": ["ファントム", "Phantom"],
      "Ragnarok": ["ラグナロク", "Ragnarok"],
      "Sagittarius": ["サジタリウス", "Sagittarius"],
      "Spriggan": ["スプリガン", "Spriggan", "Sprig"]
    }
  },
  "Light": {
    "aliases": ["ライト", "Light"],
    "servers": {
      "Alpha": ["アルファ", "Alpha"],
      "Lich": ["リッチ", "Lich"],
      "Odin": ["オーディン", "Odin"],
      "Phoenix": ["フェニックス", "Phoenix", "Phoe"],
      "Raiden": ["ライデン", "Raiden"],
      "Shiva": ["シヴァ", "Shiva"],
      "Twintania": ["ツインタニア", "Twintania", "Twin"],
      "Zodiark": ["ゾディアーク", "Zodiark", "Zodi"]
    }
  },
  "Shadow": {
    "aliases": ["シャドウ", "Shadow"],
    "servers": {
      "Innocence": ["イノセンス", "Innocence", "Inno"],
      "Pixie": ["ピクシー", "Pixie"],
      "Titania": ["ティターニア", "Titania", "Tita"],
      "Tycoon": ["タイクーン", "Tycoon"]
    }
  },

  // --- オセアニア (OCE) ---
  "Materia": {
    "aliases": ["マテリア", "Materia"],
    "servers": {
      "Bismarck": ["ビスマルク", "Bismarck"],
      "Ravana": ["ラーヴァナ", "Ravana"],
      "Sephirot": ["セフィロト", "Sephirot", "Seph"],
      "Sophia": ["ソフィア", "Sophia", "Soph"],
      "Zurvan": ["ズルワーン", "Zurvan", "Zurv"]
    }
  },

  // --- 韓国 (KR / 物理分離) --- alias はハングルのみ (英名はグローバル同名ワールドと衝突するため入れない)
  "Korea": {
    "aliases": ["한국", "韓国"],
    "servers": {
      "Carbuncle": ["카벙클"],
      "Chocobo": ["초코보"],
      "Moogle": ["모그리"],
      "Tonberry": ["톤베리"],
      "Fenrir": ["펜리르"]
    }
  },
  // --- 中国 (CN / 物理分離) --- alias は中文のみ。白银乡はエリア名と衝突するため alias なし
  "ChocoboCN": {
    "aliases": ["陆行鸟"],
    "servers": {
      "RubySea": ["红玉海"], "Yanxia": ["延夏"], "Haimaochaya": ["海猫茶屋"], "CosmicHarmony": ["宇宙和音"],
      "PhantomIslands": ["幻影群岛"], "TheHolyGround": ["神意之地"], "SproutPond": ["萌芽池"], "AmberPlains": ["琥珀原"]
    }
  },
  "MoogleCN": {
    "aliases": ["莫古力"],
    "servers": {
      "Shirogane": [], "RhalgrsReach": ["神拳痕"], "PlatinumMirage": ["白金幻象"], "TravelersDock": ["旅人栈桥"],
      "TheDawnChamber": ["拂晓之间"], "TheAery": ["龙巢神殿"], "DreamfeatherRealm": ["梦羽宝境"], "HaukkeManor": ["静语庄园"]
    }
  },
  "FatCatCN": {
    "aliases": ["猫小胖"],
    "servers": {
      "AmethystShallows": ["紫水栈桥"], "MorDhona": ["摩杜纳"], "TheGreatWall": ["墙壁江山"], "BreezyBeach": ["柔风海滩"],
      "TheAurumVale": ["黄金谷"], "CrescentCove": ["月牙湾"], "TheLostCity": ["异界遗迹"]
    }
  },
  "MameshibaCN": {
    "aliases": ["豆豆柴"],
    "servers": {
      "TheCrystalTower": ["水晶塔"], "SilvertearLake": ["银泪湖"], "CostaDelSol": ["太阳海岸"], "Ishgard": ["伊修加德"], "BlackTeaRiver": ["红茶川"]
    }
  }
};

// 2. ハウジングエリアのマスターデータ
//   - name / apartment_name は全言語値 (ja/en/ko/zh) を持つ
//   - en は FFXIV Wiki (Apartments) 由来の公式表記 (2026-05-27 確認)
//   - ko/zh は正典 CSV (src/data/housing/terms-src/housing-terms.csv) 由来の公式表記 (2026-07-18 実値化)
//   - aliases はテキスト解析 (parseHousingFromText) 用、 言語横断の表記揺れを集約
export const housingAreaMasterData: Record<string, HousingAreaData> = {
  "Mist": {
    "name": { ja: "ミスト・ヴィレッジ", en: "Mist", ko: "안갯빛 마을", zh: "海雾村" },
    "apartment_name": { ja: "トップマスト", en: "The Topmast", ko: "중층 돛대", zh: "中桅塔" },
    "aliases": ["ミスト", "ミスビレ", "Mist", "Mis", "Topmast", "トップマスト", "안갯빛 마을", "海雾村", "중층 돛대", "中桅塔"]
  },
  "LavenderBeds": {
    "name": { ja: "ラベンダーベッド", en: "The Lavender Beds", ko: "라벤더 안식처", zh: "薰衣草苗圃" },
    "apartment_name": { ja: "リリーヒルズ", en: "Lily Hills", ko: "백합 언덕", zh: "百合岭" },
    "aliases": ["ラベ", "ラベンダー", "森", "葉脈", "Lavender", "Lavender Beds", "Lav", "LB", "Lily Hills", "リリーヒルズ", "라벤더 안식처", "薰衣草苗圃", "백합 언덕", "百合岭"]
  },
  "Goblet": {
    "name": { ja: "ゴブレットビュート", en: "The Goblet", ko: "하늘잔 마루", zh: "高脚孤丘" },
    "apartment_name": { ja: "ナナモ大風車", en: "The Sultana's Breath", ko: "나나모 대풍차", zh: "娜娜莫大风车" },
    "aliases": ["ゴブ", "ゴブレット", "Goblet", "Gob", "Sultana's Breath", "ナナモ大風車", "하늘잔 마루", "高脚孤丘", "나나모 대풍차", "娜娜莫大风车"]
  },
  "Shirogane": {
    "name": { ja: "シロガネ", en: "Shirogane", ko: "시로가네", zh: "白银乡" },
    "apartment_name": { ja: "紅梅御殿", en: "Kobai Goten", ko: "홍매전", zh: "红梅御殿" },
    "aliases": ["シロガネ", "しろがね", "Shirogane", "Shiro", "Kobai Goten", "紅梅御殿", "시로가네", "白银乡", "홍매전", "红梅御殿"]
  },
  "Empyreum": {
    "name": { ja: "エンピレアム", en: "Empyreum", ko: "지고천 거리", zh: "穹顶皓天" },
    "apartment_name": { ja: "イングルサイド", en: "Ingleside", ko: "단란한 난롯가", zh: "皓天炉舍" },
    "aliases": ["エンピ", "エンピレアム", "Empyreum", "Emp", "Empy", "Ingleside", "イングルサイド", "지고천 거리", "穹顶皓天", "단란한 난롯가", "皓天炉舍"]
  }
};

// 3. ハウジングサイズ・種別のマスターデータ（「アパ」「Apt」等を追加）
export const housingSizeMasterData: HousingSizeData[] = [
  {"id": "S", "label": "Sハウス", "aliases": ["S", "Sサイズ", "Small"]},
  {"id": "M", "label": "Mハウス", "aliases": ["M", "Mサイズ", "Medium"]},
  {"id": "L", "label": "Lハウス", "aliases": ["L", "Lサイズ", "Large"]},
  {"id": "Apartment", "label": "アパルトメント", "aliases": ["アパルトメント", "アパルト", "アパート", "アパ", "Apartment", "Apart", "Apt"]},
  {"id": "PrivateRoom", "label": "FC個室", "aliases": ["個室", "FC個室", "FC部屋", "Private Room", "FC Chamber"]}
];

// 4. コンテンツルーレット＆検索用タグ
export const tagMasterData: Record<string, string[]> = {
  "テイスト": [
    "モダン", "和風", "アジアン", "サイバーパンク", "廃墟", 
    "ファンタジー", "スチームパンク", "ナチュラル", "アンティーク", "ホラー",
    "カフェ", "バー・居酒屋", "レストラン", "植物園・温室", "図書館・書斎", "教会・神殿"
  ],
  "季節・イベント": [
    "春・桜", "夏・海", "秋・紅葉", "冬・雪", "ハロウィン", "クリスマス"
  ]
};
