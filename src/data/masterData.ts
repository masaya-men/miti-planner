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
  }
};

// 2. ハウジングエリアのマスターデータ
//   - name / apartment_name は全言語値 (ja/en/ko/zh) を持つ
//   - en は FFXIV Wiki (Apartments) 由来の公式表記 (2026-05-27 確認)
//   - ko/zh はリリース時点では ja コピー (日英先行公開、 翻訳実値はリリース後対応)
//   - aliases はテキスト解析 (parseHousingFromText) 用、 言語横断の表記揺れを集約
export const housingAreaMasterData: Record<string, HousingAreaData> = {
  "Mist": {
    "name": { ja: "ミスト・ヴィレッジ", en: "Mist", ko: "ミスト・ヴィレッジ", zh: "ミスト・ヴィレッジ" },
    "apartment_name": { ja: "トップマスト", en: "The Topmast", ko: "トップマスト", zh: "トップマスト" },
    "aliases": ["ミスト", "ミスビレ", "Mist", "Mis", "Topmast", "トップマスト"]
  },
  "LavenderBeds": {
    "name": { ja: "ラベンダーベッド", en: "The Lavender Beds", ko: "ラベンダーベッド", zh: "ラベンダーベッド" },
    "apartment_name": { ja: "リリーヒルズ", en: "Lily Hills", ko: "リリーヒルズ", zh: "リリーヒルズ" },
    "aliases": ["ラベ", "ラベンダー", "森", "葉脈", "Lavender", "Lavender Beds", "Lav", "LB", "Lily Hills", "リリーヒルズ"]
  },
  "Goblet": {
    "name": { ja: "ゴブレットビュート", en: "The Goblet", ko: "ゴブレットビュート", zh: "ゴブレットビュート" },
    "apartment_name": { ja: "ナナモ大風車", en: "The Sultana's Breath", ko: "ナナモ大風車", zh: "ナナモ大風車" },
    "aliases": ["ゴブ", "ゴブレット", "Goblet", "Gob", "Sultana's Breath", "ナナモ大風車"]
  },
  "Shirogane": {
    "name": { ja: "シロガネ", en: "Shirogane", ko: "シロガネ", zh: "シロガネ" },
    "apartment_name": { ja: "紅梅御殿", en: "Kobai Goten", ko: "紅梅御殿", zh: "紅梅御殿" },
    "aliases": ["シロガネ", "しろがね", "Shirogane", "Shiro", "Kobai Goten", "紅梅御殿"]
  },
  "Empyreum": {
    "name": { ja: "エンピレアム", en: "Empyreum", ko: "エンピレアム", zh: "エンピレアム" },
    "apartment_name": { ja: "イングルサイド", en: "Ingleside", ko: "イングルサイド", zh: "イングルサイド" },
    "aliases": ["エンピ", "エンピレアム", "Empyreum", "Emp", "Empy", "Ingleside", "イングルサイド"]
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
