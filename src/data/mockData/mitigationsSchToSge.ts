import type { Mitigation } from '../../types/index.js';

/** 学者〜賢者(機工士・吟遊詩人含む) */
export const MITIGATIONS_SCH_TO_SGE: Mitigation[] = [
    // --- Scholar ---
    {
        id: "accession", jobId: "sch", name: { ja: "アクセッション", en: "Accession", zh: "降临之章", ko: "강림" }, icon: "/icons/Accession.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 432, requires: "seraphism", minLevel: 100, family: "healer_gcd_shield", hidden: true, barrierStackGroup: 'galvanize', barrierConsumptionPriority: 25
    },
    {
        id: "manifestation", jobId: "sch", name: { ja: "マニフェステーション", en: "Manifestation", zh: "显灵之章", ko: "현시" }, icon: "/icons/Manifestation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 648, scope: "target", requires: "seraphism", minLevel: 100, family: "healer_gcd_target_shield", hidden: true, barrierStackGroup: 'galvanize', barrierConsumptionPriority: 25
    },
    {
        id: "concitation", jobId: "sch", name: { ja: "意気軒高の策", en: "Concitation", zh: "意气轩昂之策", ko: "의기왕성책" }, icon: "/icons/Concitation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 360, minLevel: 92, family: "succor", barrierStackGroup: 'galvanize', barrierConsumptionPriority: 25
    },
    {
        id: "succor", jobId: "sch", name: { ja: "士気高揚の策", en: "Succor", zh: "士气高扬之策", ko: "사기고양책" }, icon: "/icons/Concitation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 320, maxLevel: 91, family: "succor", barrierStackGroup: 'galvanize', barrierConsumptionPriority: 25
    },
    {
        id: "consolation", jobId: "sch", name: { ja: "コンソレイション", en: "Consolation", zh: "慰藉", ko: "위안" }, icon: "/icons/Consolation.png",
        recast: 1, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 250, requires: "summon_seraph", maxCharges: 2, minLevel: 80, family: "bh_sub_a", requiresFairy: true, barrierConsumptionPriority: 16
    },
    {
        id: "adloquium", jobId: "sch", name: { ja: "鼓舞激励の策", en: "Adloquium", zh: "鼓舞激励之策", ko: "고무격려책" }, icon: "/icons/Adloquium.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, scope: "target", minLevel: 30, family: "healer_gcd_target_shield", barrierStackGroup: 'galvanize', barrierConsumptionPriority: 25
    },
    {
        id: "recitation", jobId: "sch", name: { ja: "秘策", en: "Recitation", zh: "秘策", ko: "비책" }, icon: "/icons/Recitation.png",
        recast: 60, duration: 15, type: "all", value: 0, isShield: false, note: "次のヒールを確定クリ+コスト免除", minLevel: 98, family: "healer_ogcd_self_buff"
    },
    {
        id: "recitation_base", jobId: "sch", name: { ja: "秘策", en: "Recitation", zh: "秘策", ko: "비책" }, icon: "/icons/Recitation.png",
        recast: 90, duration: 15, type: "all", value: 0, isShield: false, note: "次のヒールを確定クリ+コスト免除", minLevel: 74, maxLevel: 97, family: "healer_ogcd_self_buff"
    },
    {
        id: "deployment_tactics", jobId: "sch", name: { ja: "展開戦術", en: "Deployment Tactics", zh: "展开战术", ko: "전개전술" }, icon: "/icons/Deployment_Tactics.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, copiesShield: 'adloquium', note: "対象の鼓舞バリアをパーティにコピー", minLevel: 88, family: "bh_90_shield", barrierStackGroup: 'galvanize', barrierConsumptionPriority: 25
    },
    {
        id: "deployment_tactics_base", jobId: "sch", name: { ja: "展開戦術", en: "Deployment Tactics", zh: "展开战术", ko: "전개전술" }, icon: "/icons/Deployment_Tactics.png",
        recast: 120, duration: 30, type: "all", value: 0, isShield: true, copiesShield: 'adloquium', note: "対象の鼓舞バリアをパーティにコピー", minLevel: 56, maxLevel: 87, family: "bh_90_shield", barrierStackGroup: 'galvanize', barrierConsumptionPriority: 25
    },

    {
        id: "dissipation", jobId: "sch", name: { ja: "転化", en: "Dissipation", zh: "转化", ko: "에테르 전환" }, icon: "/icons/Dissipation.png",
        recast: 180, duration: 30, type: "all", value: 0, isShield: false, healingIncrease: 20, healingIncreaseSelfOnly: true, minLevel: 60, family: "sch_dissipation"
    },
    {
        id: "aetherflow", jobId: "sch", name: { ja: "エーテルフロー", en: "Aetherflow", zh: "以太超流", ko: "에테르 순환" }, icon: "/icons/Aetherflow.png",
        recast: 60, duration: 1, type: "all", value: 0, isShield: false, minLevel: 45, family: "sch_aetherflow"
    },
    {
        id: "expedient", jobId: "sch", name: { ja: "疾風怒濤の計", en: "Expedient", zh: "疾风怒涛之计", ko: "질풍노도계" }, icon: "/icons/Expedient.png",
        recast: 120, duration: 20, type: "all", value: 10, isShield: false, minLevel: 90, family: "bh_120_b"
    },
    {
        id: "fey_illumination", jobId: "sch", name: { ja: "フェイイルミネーション", en: "Fey Illumination", zh: "异想的幻光", ko: "요정의 광휘" }, icon: "/icons/Fey_Illumination.png",
        recast: 120, duration: 20, type: "magical", value: 5, isShield: false,
        note: "被魔法5%軽減, 回復効果10%上昇", healingIncrease: 10, family: "bh_sub_a", requiresFairy: true
    },
    {
        id: "sacred_soil", jobId: "sch", name: { ja: "野戦治療の陣", en: "Sacred Soil", zh: "野战治疗阵", ko: "야전치유진" }, icon: "/icons/Sacred_Soil.png",
        recast: 30, duration: 18, type: "all", value: 10, isShield: false, resourceCost: { type: 'aetherflow', amount: 1 }, minLevel: 45, family: "healer_bubble"
    },
    {
        id: "whispering_dawn", jobId: "sch", name: { ja: "光の囁き", en: "Whispering Dawn", zh: "仙光的低语", ko: "빛의 속삭임" }, icon: "/icons/Whispering_Dawn.png",
        recast: 60, duration: 21, type: "all", value: 0, isShield: false, family: "bh_sub_a", requiresFairy: true
    },
    {
        id: "indomitability", jobId: "sch", name: { ja: "不撓不屈の策", en: "Indomitability", zh: "不屈不挠之策", ko: "불요불굴책" }, icon: "/icons/Indomitability.png",
        recast: 30, duration: 1, type: "all", value: 0, isShield: false, resourceCost: { type: 'aetherflow', amount: 1 }, minLevel: 52, family: "bh_sub_b"
    },
    {
        id: "fey_blessing", jobId: "sch", name: { ja: "フェイブレッシング", en: "Fey Blessing", zh: "异想的祥光", ko: "요정의 축복" }, icon: "/icons/Fey_Blessing.png",
        recast: 60, duration: 1, type: "all", value: 0, isShield: false, minLevel: 76, family: "bh_sub_b", requiresFairy: true
    },
    {
        id: "aetherpact", jobId: "sch", name: { ja: "エーテルパクト", en: "Aetherpact", zh: "以太契约", ko: "에테르 서약" }, icon: "/icons/Aetherpact.png",
        recast: 1, duration: 15, type: "all", value: 0, isShield: false, note: "15秒固定", scope: "target", minLevel: 70, family: "bh_sub_c", requiresFairy: true
    },
    {
        id: "seraphism", jobId: "sch", name: { ja: "セラフィズム", en: "Seraphism", zh: "炽天附体", ko: "세라피즘" }, icon: "/icons/Seraphism.png",
        recast: 180, duration: 20, type: "all", value: 0, isShield: false, family: "bh_180_big", minLevel: 100, requiresFairy: true
    },
    {
        id: "summon_seraph", jobId: "sch", name: { ja: "サモン・セラフィム", en: "Summon Seraph", zh: "炽天召唤", ko: "세라핌 소환" }, icon: "/icons/Summon_Seraph.png",
        recast: 120, duration: 22, type: "all", value: 0, isShield: false, minLevel: 80, family: "bh_120_a", requiresFairy: true
    },
    {
        id: "lustrate", jobId: "sch", name: { ja: "生命活性法", en: "Lustrate", zh: "生命活性法", ko: "생명활성술" }, icon: "/icons/Lustrate.png",
        recast: 1, duration: 1, type: "all", value: 0, isShield: false, scope: "target", resourceCost: { type: 'aetherflow', amount: 1 }, minLevel: 45, family: "healer_ogcd_target_heal"
    },
    {
        id: "protraction", jobId: "sch", name: { ja: "生命回生法", en: "Protraction", zh: "生命回生法", ko: "생명회생법" }, icon: "/icons/Protraction.png",
        recast: 60, duration: 10, type: "all", value: 0, isShield: false, scope: "target", healingIncrease: 10, note: "最大HP+10% + 被回復+10%", minLevel: 86, family: "healer_ogcd_target_buff"
    },
    {
        id: "excogitation", jobId: "sch", name: { ja: "深謀遠慮", en: "Excogitation", zh: "深谋远虑", ko: "심모원려" }, icon: "/icons/Excogitation.png",
        recast: 45, duration: 45, type: "all", value: 0, isShield: false, scope: "target", resourceCost: { type: 'aetherflow', amount: 1 }, note: "HP50%以下or効果終了で回復(回復力800)", minLevel: 62
    },

    // --- Machinist ---
    {
        id: "dismantle", jobId: "mch", name: { ja: "ウェポンブレイク", en: "Dismantle", zh: "武装解除", ko: "무기 파괴" }, icon: "/icons/Dismantle.png",
        recast: 120, duration: 10, type: "all", value: 10, isShield: false, minLevel: 62, appliesAsDebuff: true, family: "ranged_target_10"
    },
    {
        id: "tactician", jobId: "mch", name: { ja: "タクティシャン", en: "Tactician", zh: "策动", ko: "책략가" }, icon: "/icons/Tactician.png",
        recast: 90, duration: 15, type: "all", value: 15, isShield: false, minLevel: 98, family: "ranged_party_15"
    },
    {
        id: "tactician_base", jobId: "mch", name: { ja: "タクティシャン", en: "Tactician", zh: "策动", ko: "책략가" }, icon: "/icons/Tactician.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, minLevel: 58, maxLevel: 97, family: "ranged_party_15"
    },

    // --- Bard ---
    {
        id: "nature_s_minne", jobId: "brd", name: { ja: "地神のミンネ", en: "Nature's Minne", zh: "大地神的抒情恋歌", ko: "대지신의 연가" }, icon: "/icons/Nature's_Minne.png",
        recast: 120, duration: 15, type: "all", value: 0, isShield: false, note: "回復効果15%上昇", healingIncrease: 15, minLevel: 66, family: "ranged_heal_up"
    },
    {
        id: "troubadour", jobId: "brd", name: { ja: "トルバドゥール", en: "Troubadour", zh: "行吟", ko: "방랑하는 음악가" }, icon: "/icons/Troubadour.png",
        recast: 90, duration: 15, type: "all", value: 15, isShield: false, minLevel: 98, family: "ranged_party_15"
    },
    {
        id: "troubadour_base", jobId: "brd", name: { ja: "トルバドゥール", en: "Troubadour", zh: "行吟", ko: "방랑하는 음악가" }, icon: "/icons/Troubadour.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, minLevel: 62, maxLevel: 97, family: "ranged_party_15"
    },

    // --- Sage ---
    {
        id: "eukrasian_prognosis_ii", jobId: "sge", name: { ja: "エウクラシア・プログノシスII", en: "Eukrasian Prognosis II", zh: "均衡预后II", ko: "정상건강: 예후II" }, icon: "/icons/Eukrasian_Prognosis_II.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 360, minLevel: 96, family: "healer_gcd_shield", barrierStackGroup: 'eukrasian_prognosis', barrierConsumptionPriority: 15
    },
    {
        id: "eukrasian_prognosis", jobId: "sge", name: { ja: "エウクラシア・プログノシス", en: "Eukrasian Prognosis", zh: "均衡预后", ko: "정상건강: 예후" }, icon: "/icons/Eukrasian_Prognosis_II.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 320, maxLevel: 95, family: "healer_gcd_shield", barrierStackGroup: 'eukrasian_prognosis', barrierConsumptionPriority: 15
    },
    {
        id: "holos", jobId: "sge", name: { ja: "ホーリズム", en: "Holos", zh: "整体论", ko: "전체론" }, icon: "/icons/Holos.png",
        recast: 120, duration: 20, type: "all", value: 10, isShield: true, valueType: 'potency', shieldPotency: 300, minLevel: 76, family: "bh_120_b", barrierConsumptionPriority: 17
    },
    {
        id: "kerachole", jobId: "sge", name: { ja: "ケーラコレ", en: "Kerachole", zh: "坚角清汁", ko: "케이라콜레" }, icon: "/icons/Kerachole.png",
        recast: 30, duration: 15, type: "all", value: 10, isShield: false, resourceCost: { type: 'addersgall', amount: 1 }, exclusiveWith: "sge_10pct_miti", minLevel: 50, family: "healer_bubble"
    },
    {
        id: "panhaima", jobId: "sge", name: { ja: "パンハイマ", en: "Panhaima", zh: "泛输血", ko: "온혈액" }, icon: "/icons/Panhaima.png",
        recast: 120, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 200,
        stacks: 5, reapplyOnAbsorption: true, onExpiryHealingPotency: 100, minLevel: 80, family: "bh_120_a", barrierConsumptionPriority: 6
    },
    {
        id: "philosophia", jobId: "sge", name: { ja: "フィロソフィア", en: "Philosophia", zh: "智慧之爱", ko: "필로소피아" }, icon: "/icons/Philosophia.png",
        recast: 180, duration: 20, type: "all", value: 0, isShield: false, minLevel: 100, family: "bh_180_big"
    },
    {
        id: "physis_base", jobId: "sge", name: { ja: "ピュシスII", en: "Physis II", zh: "自生II", ko: "퓌시스 2" }, icon: "/icons/Physis_II.png",
        recast: 60, duration: 15, type: "all", value: 0, isShield: false, healingIncrease: 10, healingIncreaseDuration: 10, note: "PH2持続15s, 回復効果10%上昇10s", minLevel: 60, maxLevel: 97, family: "bh_sub_a"
    },
    {
        id: "physis", jobId: "sge", name: { ja: "ピュシスII", en: "Physis II", zh: "自生II", ko: "퓌시스 2" }, icon: "/icons/Physis_II.png",
        recast: 60, duration: 15, type: "all", value: 0, isShield: false, healingIncrease: 10, note: "PH2持続15s, 回復効果10%上昇15s", minLevel: 98, family: "bh_sub_a"
    },
    {
        id: "ixochole", jobId: "sge", name: { ja: "イックソコレ", en: "Ixochole", zh: "寄生清汁", ko: "익소콜레" }, icon: "/icons/Ixochole.png",
        recast: 30, duration: 1, type: "all", value: 0, isShield: false, resourceCost: { type: 'addersgall', amount: 1 }, minLevel: 52, family: "bh_sub_b"
    },
    {
        id: "haima", jobId: "sge", name: { ja: "ハイマ", en: "Haima", zh: "输血", ko: "혈액" }, icon: "/icons/Haima.png",
        recast: 120, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 300,
        stacks: 5, reapplyOnAbsorption: true, onExpiryHealingPotency: 150, note: "300x(1+5)回分", scope: "target", minLevel: 70, family: "bh_sub_c", barrierConsumptionPriority: 5
    },
    {
        id: "pneuma", jobId: "sge", name: { ja: "プネウマ", en: "Pneuma", zh: "魂灵风息", ko: "프네우마" }, icon: "/icons/Pneuma.png",
        recast: 120, duration: 1, type: "all", value: 0, isShield: false, note: "リキャスト管理のみ", minLevel: 90, family: "bh_target_shield"
    },
    {
        id: "eukrasian_diagnosis", jobId: "sge", name: { ja: "エウクラシア・ディアグノシス", en: "Eukrasian Diagnosis", zh: "均衡诊断", ko: "정상건강: 진단치료" }, icon: "/icons/Eukrasian_Diagnosis.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, scope: "target", minLevel: 30, family: "healer_gcd_target_shield", barrierStackGroup: 'eukrasian_diagnosis', barrierConsumptionPriority: 4
    },
    {
        id: "zoe", jobId: "sge", name: { ja: "ゾーエ", en: "Zoe", zh: "活化", ko: "생명력" }, icon: "/icons/Zoe.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: false, note: "次の回復魔法の回復量1.5倍", minLevel: 88, family: "healer_ogcd_self_buff"
    },
    {
        id: "zoe_base", jobId: "sge", name: { ja: "ゾーエ", en: "Zoe", zh: "活化", ko: "생명력" }, icon: "/icons/Zoe.png",
        recast: 120, duration: 30, type: "all", value: 0, isShield: false, note: "次の回復魔法の回復量1.5倍", minLevel: 56, maxLevel: 87, family: "healer_ogcd_self_buff"
    },
    {
        id: "druochole", jobId: "sge", name: { ja: "ドルオコレ", en: "Druochole", zh: "灵橡清汁", ko: "드루오콜레" }, icon: "/icons/Druochole.png",
        recast: 1, duration: 1, type: "all", value: 0, isShield: false, scope: "target", resourceCost: { type: 'addersgall', amount: 1 }, minLevel: 45, family: "healer_ogcd_target_heal"
    },
    {
        id: "taurochole", jobId: "sge", name: { ja: "タウロコレ", en: "Taurochole", zh: "白牛清汁", ko: "타우로콜레" }, icon: "/icons/Taurochole.png",
        recast: 45, duration: 15, type: "all", value: 10, isShield: false, scope: "target", resourceCost: { type: 'addersgall', amount: 1 }, exclusiveWith: "sge_10pct_miti", note: "回復700+軽減10%。ケーラコレと軽減重複不可（後付け上書き）", minLevel: 62, family: "sge_target_miti_heal"
    },
    {
        id: "krasis", jobId: "sge", name: { ja: "クラーシス", en: "Krasis", zh: "混合", ko: "체액 혼화" }, icon: "/icons/Krasis.png",
        recast: 60, duration: 10, type: "all", value: 0, isShield: false, scope: "target", healingIncrease: 20, note: "対象の被回復+20%", minLevel: 86, family: "healer_ogcd_target_buff"
    },
    {
        id: "rhizomata", jobId: "sge", name: { ja: "リゾーマタ", en: "Rhizomata", zh: "根素", ko: "만물의 근원", "zh-Hant": "根素" }, icon: "/icons/Rhizomata.png",
        recast: 90, duration: 0, type: "all", value: 0, isShield: false, scope: "self", resourceGain: { type: 'addersgall', amount: 1 }, note: "アダーガルを1スタック獲得(最大3)", minLevel: 74
    },
];
