import type { Mitigation } from '../../types/index.js';

/** 赤魔道士〜戦士(リーパー・占星術師含む) */
export const MITIGATIONS_RDM_TO_WAR: Mitigation[] = [
    // --- Red Mage ---
    {
        id: "magick_barrier", jobId: "rdm", name: { ja: "バマジク", en: "Magick Barrier", zh: "抗死", ko: "바매직" }, icon: "/icons/Magick_Barrier.png",
        recast: 120, duration: 10, type: "all", value: 10, isShield: false,
        note: "被魔法10%軽減, 回復効果5%上昇", valueMagical: 10, valuePhysical: 0, healingIncrease: 5, minLevel: 86, family: "caster_party_miti"
    },

    // --- Reaper ---
    {
        id: "arcane_crest", jobId: "rpr", name: { ja: "アルケインクレスト", en: "Arcane Crest", zh: "神秘纹", ko: "신비의 문장", "zh-Hant": "神秘紋" }, icon: "/icons/Arcane_Crest.png",
        recast: 30, duration: 5, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", scope: "self",
        note: "バリア完全吸収で自身と周囲15m以内に回復力50のHP継続回復(15秒)", minLevel: 40, hidden: true,
        // 暫定: 命脈を借り受け(Lv84+)は本来 priority 1 だが軽減表はレベル分岐を持たないため 11 固定
        barrierConsumptionPriority: 11
    },

    // --- Astrologian ---
    {
        id: "collective_unconscious", jobId: "ast", name: { ja: "運命の輪", en: "Collective Unconscious", zh: "命运之轮", ko: "운명의 수레바퀴" }, icon: "/icons/Collective_Unconscious.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, minLevel: 58, family: "ph_60_aoe"
    },
    {
        id: "helios_conjunction", jobId: "ast", name: { ja: "コンジャンクション・ヘリオス", en: "Helios Conjunction", zh: "阳星合相", ko: "회합: 헬리오스" }, icon: "/icons/Helios_Conjunction.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 312.5, note: "ニュートラルセクト中のみバリア", minLevel: 96, family: "healer_gcd_shield", barrierConsumptionPriority: 21
    },
    {
        id: "aspected_helios", jobId: "ast", name: { ja: "アスペクト・ヘリオス", en: "Aspected Helios", zh: "阳星相位", ko: "별읽기: 헬리오스" }, icon: "/icons/Helios_Conjunction.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 312.5, note: "ニュートラルセクト中のみバリア", maxLevel: 95, family: "healer_gcd_shield", barrierConsumptionPriority: 21
    },
    {
        id: "macrocosmos", jobId: "ast", name: { ja: "マクロコスモス", en: "Macrocosmos", zh: "大宇宙", ko: "대우주" }, icon: "/icons/Macrocosmos.png",
        recast: 180, duration: 15, type: "all", value: 0, isShield: false, minLevel: 90, family: "ph_180_big"
    },
    {
        id: "neutral_sect", jobId: "ast", name: { ja: "ニュートラルセクト", en: "Neutral Sect", zh: "中间学派", ko: "하루별읽기" }, icon: "/icons/Neutral_Sect.png",
        recast: 120, duration: 20, type: "all", value: 0, isShield: false, healingIncrease: 20, healingIncreaseSelfOnly: true, minLevel: 80, family: "ph_120_aoe"
    },
    {
        id: "sun_sign", jobId: "ast", name: { ja: "サンサイン", en: "Sun Sign", zh: "太阳星座", ko: "태양궁" }, icon: "/icons/Sun_Sign.png",
        recast: 1, duration: 15, type: "all", value: 10, isShield: false, requires: "neutral_sect", requiresWindow: 30, maxCharges: 1, minLevel: 100, family: "ph_sub_120"
    },
    {
        id: "earthly_star", jobId: "ast", name: { ja: "アーサリースター", en: "Earthly Star", zh: "地星", ko: "지상의 별" }, icon: "/icons/Earthly_Star.png",
        recast: 60, duration: 20, type: "all", value: 0, isShield: false, minLevel: 62, family: "ph_60_aoe"
    },
    {
        id: "horoscope", jobId: "ast", name: { ja: "ホロスコープ", en: "Horoscope", zh: "天宫图", ko: "별점운" }, icon: "/icons/Horoscope_1.png",
        recast: 60, duration: 10, type: "all", value: 0, isShield: false, minLevel: 70, family: "ph_60_aoe"
    },
    {
        id: "exaltation", jobId: "ast", name: { ja: "エクザルテーション", en: "Exaltation", zh: "擢升", ko: "성위 격상" }, icon: "/icons/Exaltation.png",
        recast: 60, duration: 8, type: "all", value: 10, isShield: false, scope: "target", minLevel: 82, family: "ph_target_miti"
    },
    {
        id: "celestial_opposition", jobId: "ast", name: { ja: "星天対抗", en: "Celestial Opposition", zh: "天星冲日", ko: "천궁의 반목" }, icon: "/icons/Celestial_Opposition.png",
        recast: 60, duration: 15, type: "all", value: 0, isShield: false, minLevel: 60, family: "healer_ogcd_aoe_heal"
    },
    {
        id: "celestial_intersection", jobId: "ast", name: { ja: "星天交差", en: "Celestial Intersection", zh: "天星交错", ko: "천궁의 교차" }, icon: "/icons/Celestial_Intersection.png",
        recast: 30, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 400, scope: "target", maxCharges: 2, chargeMinLevel: 88, minLevel: 74, family: "ph_target_shield", barrierConsumptionPriority: 13
    },
    {
        id: "astral_draw", jobId: "ast",
        name: { ja: "アストラルドロー", en: "Astral Draw", zh: "星极抽卡", ko: "별빛 점지" },
        icon: "/icons/Astral_Draw.png",
        recast: 55, duration: 1, type: "all", value: 0, isShield: false,
        minLevel: 30, family: "ast_draw_astral",
        note: "アストラル4枚を獲得 (Balance/Arrow/Spire/Lord)。次のドローまで保持。"
    },
    {
        id: "umbral_draw", jobId: "ast",
        name: { ja: "アンブラルドロー", en: "Umbral Draw", zh: "灵极抽卡", ko: "그림자 점지" },
        icon: "/icons/Umbral_Draw.png",
        recast: 55, duration: 1, type: "all", value: 0, isShield: false,
        minLevel: 30, family: "ast_draw_umbral",
        note: "アンブラル4枚を獲得 (Spear/Bole/Ewer/Lady)。次のドローまで保持。"
    },
    {
        id: "the_arrow", jobId: "ast",
        name: { ja: "オシュオンの矢", en: "The Arrow", zh: "放浪神之箭", ko: "오쉬온의 화살" },
        icon: "/icons/The_Arrow.png",
        recast: 1, duration: 15, type: "all", value: 0, isShield: false,
        scope: "target", healingIncrease: 10,
        requires: "astral_draw",
        note: "対象の被回復+10%",
        minLevel: 30, family: "healer_ogcd_target_buff"
    },
    {
        id: "the_spire", jobId: "ast",
        name: { ja: "ビエルゴの塔", en: "The Spire", zh: "建筑神之塔", ko: "비레고의 탑" },
        icon: "/icons/The_Spire.png",
        recast: 1, duration: 30, type: "all", value: 0, isShield: true,
        valueType: 'potency', shieldPotency: 400, scope: "target",
        requires: "astral_draw",
        note: "バリア (回復力400相当) / 30秒",
        minLevel: 30, family: "ph_target_shield", barrierConsumptionPriority: 14
    },
    {
        id: "the_bole", jobId: "ast",
        name: { ja: "世界樹の幹", en: "The Bole", zh: "世界树之干", ko: "세계수의 줄기" },
        icon: "/icons/The_Bole.png",
        recast: 1, duration: 15, type: "all", value: 10, isShield: false,
        scope: "target",
        requires: "umbral_draw",
        note: "対象の被ダメージ-10%",
        minLevel: 30, family: "ph_target_miti"
    },
    {
        id: "the_ewer", jobId: "ast",
        name: { ja: "サリャクの水瓶", en: "The Ewer", zh: "河流神之瓶", ko: "살리아크의 물병" },
        icon: "/icons/The_Ewer.png",
        recast: 1, duration: 15, type: "all", value: 0, isShield: false,
        scope: "target",
        requires: "umbral_draw",
        note: "対象に HoT (威力200/tick × 5)",
        minLevel: 30, family: "healer_ogcd_target_buff"
    },
    {
        id: "lady_of_crowns", jobId: "ast",
        name: { ja: "クラウンレディ", en: "Lady of Crowns", zh: "王冠之贵妇", ko: "여왕의 날개" },
        icon: "/icons/Lady_of_Crowns.png",
        recast: 1, duration: 1, type: "all", value: 0, isShield: false,
        requires: "umbral_draw",
        note: "範囲回復 (回復力400 / 即時)",
        minLevel: 30, family: "healer_ogcd_aoe_heal"
    },

    // --- Warrior ---
    {
        id: "damnation", jobId: "war", name: { ja: "ダムネーション", en: "Damnation", zh: "戮罪", ko: "지옥행" }, icon: "/icons/Damnation.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "vengeance", jobId: "war", name: { ja: "ヴェンジェンス", en: "Vengeance", zh: "复仇", ko: "보복" }, icon: "/icons/Vengeance.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", minLevel: 38, maxLevel: 91, family: "tank_40"
    },
    {
        id: "bloodwhetting", jobId: "war", name: { ja: "原初の血気", en: "Bloodwhetting", zh: "原初的血气", ko: "원초의 혈기" }, icon: "/icons/Bloodwhetting.png",
        recast: 25, duration: 8, type: "all", value: 10, burstValue: 10, burstDuration: 4, isShield: true, valueType: 'potency', shieldPotency: 400,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", minLevel: 82, family: "tank_short", barrierConsumptionPriority: 8
    },
    {
        id: "raw_intuition", jobId: "war", name: { ja: "原初の直感", en: "Raw Intuition", zh: "原初的直觉", ko: "원초의 직감" }, icon: "/icons/Bloodwhetting.png",
        recast: 25, duration: 6, type: "all", value: 10, isShield: false,
        scope: "self", minLevel: 56, maxLevel: 81, family: "tank_short"
    },
    {
        id: "nascent_flash", jobId: "war", name: { ja: "原初の猛り", en: "Nascent Flash", zh: "原初的勇猛", ko: "원초의 분노" }, icon: "/icons/Nascent_Flash.png",
        recast: 25, duration: 8, type: "all", value: 10, burstValue: 10, burstDuration: 4, isShield: true, valueType: 'potency', shieldPotency: 400,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "target", minLevel: 82, family: "tank_sub_targeted", targetCannotBeSelf: true, barrierConsumptionPriority: 8
    },
    {
        id: "nascent_flash_base", jobId: "war", name: { ja: "原初の猛り", en: "Nascent Flash", zh: "原初的勇猛", ko: "원초의 분노" }, icon: "/icons/Nascent_Flash.png",
        recast: 25, duration: 6, type: "all", value: 10, isShield: false,
        scope: "target", minLevel: 76, maxLevel: 81, family: "tank_sub_targeted", targetCannotBeSelf: true
    },
    {
        id: "shake_it_off", jobId: "war", name: { ja: "シェイクオフ", en: "Shake It Off", zh: "摆脱", ko: "뿌리치기" }, icon: "/icons/Shake_It_Off.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "15% HP", scope: "party", minLevel: 68, family: "tank_party_miti", barrierConsumptionPriority: 19
    },
    {
        id: "holmgang", jobId: "war", name: { ja: "ホルムギャング", en: "Holmgang", zh: "死斗", ko: "일대일 결투" }, icon: "/icons/Holmgang.png",
        recast: 240, duration: 10, type: "all", value: 0, isShield: false, note: "HP1以下にならない", scope: "self", isInvincible: true, minLevel: 42, family: "tank_invuln"
    },
    {
        id: "thrill_of_battle", jobId: "war", name: { ja: "スリル・オブ・バトル", en: "Thrill of Battle", zh: "战栗", ko: "광폭화" }, icon: "/icons/Thrill_of_Battle.png",
        recast: 90, duration: 10, type: "all", value: 0, isShield: false, scope: "self", minLevel: 30, family: "tank_sub_self"
    },
];
