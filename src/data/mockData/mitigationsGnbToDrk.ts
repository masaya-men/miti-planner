import type { Mitigation } from '../../types/index.js';

/** ガンブレイカー〜暗黒騎士(ペイントレ・モンク・タンク LB 含む) */
export const MITIGATIONS_GNB_TO_DRK: Mitigation[] = [
    // --- Gunbreaker ---
    {
        id: "aurora", jobId: "gnb", name: { ja: "オーロラ", en: "Aurora", zh: "极光", ko: "오로라" }, icon: "/icons/Aurora.png",
        recast: 60, duration: 18, type: "all", value: 0, isShield: false, scope: "target", minLevel: 45, maxLevel: 83, family: "tank_sub_targeted"
    },
    {
        id: "aurora_v2", jobId: "gnb", name: { ja: "オーロラ", en: "Aurora", zh: "极光", ko: "오로라" }, icon: "/icons/Aurora.png",
        recast: 60, duration: 18, type: "all", value: 0, isShield: false, scope: "target", maxCharges: 2, minLevel: 84, family: "tank_sub_targeted"
    },
    {
        id: "camouflage", jobId: "gnb", name: { ja: "カモフラージュ", en: "Camouflage", zh: "伪装", ko: "위장술" }, icon: "/icons/Camouflage.png",
        recast: 90, duration: 20, type: "all", value: 10, isShield: false, scope: "self", minLevel: 6, family: "tank_sub_self"
    },
    {
        id: "great_nebula", jobId: "gnb", name: { ja: "グレートネビュラ", en: "Great Nebula", zh: "大星云", ko: "대성운" }, icon: "/icons/Great_Nebula.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "nebula", jobId: "gnb", name: { ja: "ネビュラ", en: "Nebula", zh: "星云", ko: "성운" }, icon: "/icons/Nebula.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", minLevel: 38, maxLevel: 91, family: "tank_40"
    },
    {
        id: "heart_of_corundum", jobId: "gnb", name: { ja: "ハート・オブ・コランダム", en: "Heart of Corundum", zh: "刚玉之心", ko: "강옥의 심장" }, icon: "/icons/Heart_of_Corundum.png",
        recast: 25, duration: 8, type: "all", value: 15, burstValue: 15, burstDuration: 4, isShield: false,
        note: "最初4秒15%*15%, 残り4秒15％", scope: "target", minLevel: 82, family: "tank_short"
    },
    {
        id: "heart_of_stone", jobId: "gnb", name: { ja: "ハート・オブ・ストーン", en: "Heart of Stone", zh: "石之心", ko: "돌의 심장" }, icon: "/icons/Heart_of_Corundum.png",
        recast: 25, duration: 7, type: "all", value: 15, isShield: false,
        scope: "target", minLevel: 68, maxLevel: 81, family: "tank_short"
    },
    {
        id: "heart_of_light", jobId: "gnb", name: { ja: "ハート・オブ・ライト", en: "Heart of Light", zh: "光之心", ko: "빛의 심장" }, icon: "/icons/Heart_of_Light.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", minLevel: 64, family: "tank_party_miti"
    },
    {
        id: "superbolide", jobId: "gnb", name: { ja: "ボーライド", en: "Superbolide", zh: "超火流星", ko: "폭발 유성" }, icon: "/icons/Superbolide.png",
        recast: 360, duration: 10, type: "all", value: 0, isShield: false, note: "HP減少無視", scope: "self", isInvincible: true, minLevel: 50, family: "tank_invuln"
    },

    // --- Paladin ---
    {
        id: "bulwark", jobId: "pld", name: { ja: "ブルワーク", en: "Bulwark", zh: "壁垒", ko: "방패 각성" }, icon: "/icons/Bulwark.png",
        recast: 90, duration: 10, type: "all", value: 20, isShield: false, note: "DOTダメージは軽減不可", scope: "self", minLevel: 44, family: "tank_sub_self"
    },
    {
        id: "divine_veil", jobId: "pld", name: { ja: "ディヴァインヴェール", en: "Divine Veil", zh: "圣光幕帘", ko: "신성한 보호막" }, icon: "/icons/Divine_Veil.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", scope: "party", minLevel: 56, family: "tank_party_miti", barrierConsumptionPriority: 20
    },
    {
        id: "guardian", jobId: "pld", name: { ja: "エクストリームガード", en: "Guardian", zh: "极致防御", ko: "극한 방어" }, icon: "/icons/Guardian.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "sentinel", jobId: "pld", name: { ja: "センチネル", en: "Sentinel", zh: "预警", ko: "경계" }, icon: "/icons/Sentinel.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", minLevel: 38, maxLevel: 91, family: "tank_40"
    },
    {
        id: "hallowed_ground", jobId: "pld", name: { ja: "インビンシブル", en: "Hallowed Ground", zh: "神圣领域", ko: "천하무적" }, icon: "/icons/Hallowed_Ground.png",
        recast: 420, duration: 10, type: "all", value: 0, isShield: false, scope: "self", isInvincible: true, minLevel: 50, family: "tank_invuln"
    },
    {
        id: "holy_sheltron", jobId: "pld", name: { ja: "ホーリーシェルトロン", en: "Holy Sheltron", zh: "圣盾阵", ko: "신성한 방벽" }, icon: "/icons/Holy_Sheltron.png",
        recast: 5, duration: 8, type: "all", value: 15, burstValue: 15, burstDuration: 4, isShield: false,
        note: "最初4秒15%*15%, 残り4秒15％", scope: "self", minLevel: 82, family: "tank_short"
    },
    {
        id: "sheltron", jobId: "pld", name: { ja: "シェルトロン", en: "Sheltron", zh: "盾阵", ko: "방벽" }, icon: "/icons/sheltron.png",
        recast: 5, duration: 6, type: "all", value: 15, isShield: false,
        scope: "self", minLevel: 35, maxLevel: 81, family: "tank_short"
    },
    {
        id: "intervention", jobId: "pld", name: { ja: "インターベンション", en: "Intervention", zh: "干预", ko: "중재" }, icon: "/icons/Intervention.png",
        recast: 10, duration: 8, type: "all", value: 10, burstValue: 10, burstDuration: 4, isShield: false,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "target", minLevel: 82, family: "tank_sub_targeted", targetCannotBeSelf: true
    },
    {
        id: "intervention_base", jobId: "pld", name: { ja: "インターベンション", en: "Intervention", zh: "干预", ko: "중재" }, icon: "/icons/Intervention.png",
        recast: 10, duration: 6, type: "all", value: 10, isShield: false,
        scope: "target", minLevel: 62, maxLevel: 81, family: "tank_sub_targeted", targetCannotBeSelf: true
    },
    {
        id: "passage_of_arms", jobId: "pld", name: { ja: "パッセージ・オブ・アームズ", en: "Passage of Arms", zh: "武装戍卫", ko: "결연한 수호자" }, icon: "/icons/Passage_of_Arms.png",
        recast: 120, duration: 5, type: "all", value: 15, isShield: false, scope: "party", minLevel: 70, family: "tank_party_miti_sub"
    },

    // --- Tank Limit Break ---
    { id: "tank_lb1_pld", jobId: "pld", name: { ja: "リミットブレイク Ⅰ", en: "Limit Break Ⅰ", zh: "极限技 Ⅰ", ko: "리미트 브레이크 Ⅰ" }, icon: "/icons/Limit_Break_1.png", recast: 1, duration: 10, type: "all", value: 20, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb2_pld", jobId: "pld", name: { ja: "リミットブレイク Ⅱ", en: "Limit Break Ⅱ", zh: "极限技 Ⅱ", ko: "리미트 브레이크 Ⅱ" }, icon: "/icons/Limit_Break_2.png", recast: 1, duration: 15, type: "all", value: 40, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb3_pld", jobId: "pld", name: { ja: "リミットブレイク Ⅲ", en: "Limit Break Ⅲ", zh: "极限技 Ⅲ", ko: "리미트 브레이크 Ⅲ" }, icon: "/icons/Limit_Break_3.png", recast: 1, duration: 8, type: "all", value: 80, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb1_war", jobId: "war", name: { ja: "リミットブレイク Ⅰ", en: "Limit Break Ⅰ", zh: "极限技 Ⅰ", ko: "리미트 브레이크 Ⅰ" }, icon: "/icons/Limit_Break_1.png", recast: 1, duration: 10, type: "all", value: 20, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb2_war", jobId: "war", name: { ja: "リミットブレイク Ⅱ", en: "Limit Break Ⅱ", zh: "极限技 Ⅱ", ko: "리미트 브레이크 Ⅱ" }, icon: "/icons/Limit_Break_2.png", recast: 1, duration: 15, type: "all", value: 40, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb3_war", jobId: "war", name: { ja: "リミットブレイク Ⅲ", en: "Limit Break Ⅲ", zh: "极限技 Ⅲ", ko: "리미트 브레이크 Ⅲ" }, icon: "/icons/Limit_Break_3.png", recast: 1, duration: 8, type: "all", value: 80, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb1_drk", jobId: "drk", name: { ja: "リミットブレイク Ⅰ", en: "Limit Break Ⅰ", zh: "极限技 Ⅰ", ko: "리미트 브레이크 Ⅰ" }, icon: "/icons/Limit_Break_1.png", recast: 1, duration: 10, type: "all", value: 20, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb2_drk", jobId: "drk", name: { ja: "リミットブレイク Ⅱ", en: "Limit Break Ⅱ", zh: "极限技 Ⅱ", ko: "리미트 브레이크 Ⅱ" }, icon: "/icons/Limit_Break_2.png", recast: 1, duration: 15, type: "all", value: 40, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb3_drk", jobId: "drk", name: { ja: "リミットブレイク Ⅲ", en: "Limit Break Ⅲ", zh: "极限技 Ⅲ", ko: "리미트 브레이크 Ⅲ" }, icon: "/icons/Limit_Break_3.png", recast: 1, duration: 8, type: "all", value: 80, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb1_gnb", jobId: "gnb", name: { ja: "リミットブレイク Ⅰ", en: "Limit Break Ⅰ", zh: "极限技 Ⅰ", ko: "리미트 브레이크 Ⅰ" }, icon: "/icons/Limit_Break_1.png", recast: 1, duration: 10, type: "all", value: 20, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb2_gnb", jobId: "gnb", name: { ja: "リミットブレイク Ⅱ", en: "Limit Break Ⅱ", zh: "极限技 Ⅱ", ko: "리미트 브레이크 Ⅱ" }, icon: "/icons/Limit_Break_2.png", recast: 1, duration: 15, type: "all", value: 40, isShield: false, scope: "party", family: "tank_lb" },
    { id: "tank_lb3_gnb", jobId: "gnb", name: { ja: "リミットブレイク Ⅲ", en: "Limit Break Ⅲ", zh: "极限技 Ⅲ", ko: "리미트 브레이크 Ⅲ" }, icon: "/icons/Limit_Break_3.png", recast: 1, duration: 8, type: "all", value: 80, isShield: false, scope: "party", family: "tank_lb" },

    // --- Pictomancer ---
    {
        id: "tempera_grassa", jobId: "pct", name: { ja: "テンペラグラッサ", en: "Tempera Grassa", zh: "油性坦培拉涂层", ko: "무지개 빛방울" }, icon: "/icons/Tempera_Grassa.png",
        recast: 90, duration: 10, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", minLevel: 88, family: "caster_personal_shield", barrierConsumptionPriority: 2
    },

    // --- Monk ---
    {
        id: "mantra", jobId: "mnk", name: { ja: "マントラ", en: "Mantra", zh: "真言", ko: "만트라" }, icon: "/icons/Mantra.png",
        recast: 90, duration: 15, type: "all", value: 0, isShield: false, note: "回復効果10%上昇", healingIncrease: 10, minLevel: 42, family: "melee_heal_up"
    },
    {
        id: "riddle_of_earth", jobId: "mnk", name: { ja: "金剛の極意", en: "Riddle of Earth", zh: "金刚极意", ko: "금강의 극의" }, icon: "/icons/Riddle_of_Earth.png",
        recast: 120, duration: 10, type: "all", value: 20, isShield: false, scope: "self", minLevel: 64, family: "melee_self_miti"
    },
    {
        id: "earths_reply", jobId: "mnk", name: { ja: "金剛周天", en: "Earth's Reply", zh: "金刚周天", ko: "금강주천" }, icon: "/icons/Earths_Reply.png",
        recast: 1, duration: 1, type: "all", value: 0, isShield: false, scope: "party", minLevel: 64, requires: "riddle_of_earth", requiresWindow: 30, maxCharges: 1
    },

    // --- Dark Knight ---
    {
        id: "dark_mind", jobId: "drk", name: { ja: "ダークマインド", en: "Dark Mind", zh: "弃明投暗", ko: "어두운 감정" }, icon: "/icons/Dark_Mind.png",
        recast: 60, duration: 10, type: "all", value: 20, isShield: false,
        valueMagical: 20, valuePhysical: 10, scope: "self", minLevel: 45, family: "tank_sub_self"
    },
    {
        id: "shadowed_vigil", jobId: "drk", name: { ja: "シャドウヴィジル", en: "Shadowed Vigil", zh: "暗影卫", ko: "그림자 요새" }, icon: "/icons/Shadowed_Vigil.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "shadow_wall", jobId: "drk", name: { ja: "シャドウウォール", en: "Shadow Wall", zh: "暗影墙", ko: "그림자 장벽" }, icon: "/icons/Shadow_Wall.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", minLevel: 38, maxLevel: 91, family: "tank_40"
    },
    {
        id: "dark_missionary", jobId: "drk", name: { ja: "ダークミッショナリー", en: "Dark Missionary", zh: "暗黑布道", ko: "어둠의 포교자" }, icon: "/icons/Dark_Missionary.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", minLevel: 66, family: "tank_party_miti"
    },
    {
        id: "oblation", jobId: "drk", name: { ja: "オブレーション", en: "Oblation", zh: "献奉", ko: "헌신" }, icon: "/icons/Oblation.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, scope: "target", maxCharges: 2, minLevel: 82, family: "tank_sub_targeted"
    },
    {
        id: "the_blackest_night", jobId: "drk", name: { ja: "ブラックナイト", en: "The Blackest Night", zh: "至黑之夜", ko: "흑야" }, icon: "/icons/The_Blackest_Night.png",
        recast: 15, duration: 7, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "25% HP", scope: "target", minLevel: 70, family: "tank_short", barrierConsumptionPriority: 3
    },
    {
        id: "living_dead", jobId: "drk", name: { ja: "リビングデッド", en: "Living Dead", zh: "行尸走肉", ko: "산송장" }, icon: "/icons/Living_Dead.png",
        recast: 300, duration: 10, type: "all", value: 0, isShield: false, scope: "self", isInvincible: true, walkingDeadDuration: 10, minLevel: 50, family: "tank_invuln"
    },
];
