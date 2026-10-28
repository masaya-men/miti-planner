import type { Mitigation } from '../../types/index.js';

/** 白魔道士・踊り子 */
export const MITIGATIONS_WHM_DNC: Mitigation[] = [
    // --- White Mage ---
    {
        id: "divine_caress", jobId: "whm", name: { ja: "ディヴァインカレス", en: "Divine Caress", zh: "神爱抚", ko: "만상투기" }, icon: "/icons/Divine_Caress.png",
        recast: 1, duration: 10, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 400, requires: "temperance", requiresWindow: 30, maxCharges: 1, minLevel: 100, family: "ph_sub_120", barrierConsumptionPriority: 10
    },
    {
        id: "plenary_indulgence", jobId: "whm", name: { ja: "インドゥルゲンティア", en: "Plenary Indulgence", zh: "全大赦", ko: "대사면" }, icon: "/icons/Plenary_Indulgence.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, minLevel: 70, family: "ph_60_aoe"
    },
    {
        id: "temperance", jobId: "whm", name: { ja: "テンパランス", en: "Temperance", zh: "节制", ko: "절제" }, icon: "/icons/Temperance.png",
        recast: 120, duration: 20, type: "all", value: 10, isShield: false, healingIncrease: 20, healingIncreaseSelfOnly: true, minLevel: 80, family: "ph_120_aoe"
    },
    {
        id: "liturgy_of_the_bell", jobId: "whm", name: { ja: "リタージー・オブ・ベル", en: "Liturgy of the Bell", zh: "礼仪之铃", ko: "예배종" }, icon: "/icons/Liturgy_of_the_Bell.png",
        recast: 180, duration: 20, type: "all", value: 0, isShield: false, note: "被ダメ時HP回復(5回, 回復力400) + 残スタック×回復力200", minLevel: 90, family: "whm_bell"
    },
    {
        id: "aquaveil", jobId: "whm", name: { ja: "アクアヴェール", en: "Aquaveil", zh: "水流幕", ko: "물의 장막" }, icon: "/icons/Aquaveil.png",
        recast: 60, duration: 8, type: "all", value: 15, isShield: false, scope: "target", minLevel: 82, family: "ph_target_miti"
    },
    {
        id: "divine_benison", jobId: "whm", name: { ja: "ディヴァインベニゾン", en: "Divine Benison", zh: "神祝祷", ko: "신성한 축복" }, icon: "/icons/Divine_Benison.png",
        recast: 30, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 500, scope: "target", maxCharges: 2, chargeMinLevel: 88, minLevel: 66, family: "ph_target_shield", barrierConsumptionPriority: 12
    },
    {
        id: "medica_ii", jobId: "whm", name: { ja: "メディカラ", en: "Medica II", zh: "医济", ko: "메디카라" }, icon: "/icons/Medica_II.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: false, minLevel: 50, maxLevel: 95, family: "healer_gcd_aoe_heal"
    },
    {
        id: "medica_iii", jobId: "whm", name: { ja: "メディガ", en: "Medica III", zh: "医养", ko: "메디카가" }, icon: "/icons/Medica_III.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: false, minLevel: 96, family: "healer_gcd_aoe_heal"
    },
    {
        id: "assize", jobId: "whm", name: { ja: "アサイズ", en: "Assize", zh: "法令", ko: "심판" }, icon: "/icons/Assize.png",
        recast: 40, duration: 1, type: "all", value: 0, isShield: false, minLevel: 56, family: "healer_ogcd_aoe_heal"
    },
    {
        id: "asylum", jobId: "whm", name: { ja: "アサイラム", en: "Asylum", zh: "庇护所", ko: "성소" }, icon: "/icons/Asylum.png",
        recast: 90, duration: 24, type: "all", value: 0, isShield: false, healingIncrease: 10, minLevel: 78, family: "healer_ogcd_aoe_heal"
    },
    {
        id: "asylum_base", jobId: "whm", name: { ja: "アサイラム", en: "Asylum", zh: "庇护所", ko: "성소" }, icon: "/icons/Asylum.png",
        recast: 90, duration: 24, type: "all", value: 0, isShield: false, minLevel: 52, maxLevel: 77, family: "healer_ogcd_aoe_heal"
    },
    {
        id: "afflatus_solace", jobId: "whm", name: { ja: "ハート・オブ・ソラス", en: "Afflatus Solace", zh: "安慰之心", ko: "위로의 마음" }, icon: "/icons/Afflatus_Solace.png",
        recast: 2.5, duration: 1, type: "all", value: 0, isShield: false, scope: "target", resourceCost: { type: 'lily', amount: 1 }, minLevel: 52, family: "healer_gcd_target_heal"
    },
    {
        id: "tetragrammaton", jobId: "whm", name: { ja: "テトラグラマトン", en: "Tetragrammaton", zh: "神名", ko: "신의 이름" }, icon: "/icons/Tetragrammaton.png",
        recast: 60, duration: 1, type: "all", value: 0, isShield: false, scope: "target", maxCharges: 2, minLevel: 98, family: "healer_ogcd_target_heal"
    },
    {
        id: "tetragrammaton_base", jobId: "whm", name: { ja: "テトラグラマトン", en: "Tetragrammaton", zh: "神名", ko: "신의 이름" }, icon: "/icons/Tetragrammaton.png",
        recast: 60, duration: 1, type: "all", value: 0, isShield: false, scope: "target", minLevel: 60, maxLevel: 97, family: "healer_ogcd_target_heal"
    },

    // --- Dancer ---
    {
        id: "improvisation", jobId: "dnc", name: { ja: "インプロビゼーション", en: "Improvisation", zh: "即兴表演", ko: "즉흥 연기" }, icon: "/icons/Improvisation.png",
        recast: 120, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", minLevel: 80, family: "ranged_party_heal", barrierConsumptionPriority: 22
    },
    {
        id: "shield_samba", jobId: "dnc", name: { ja: "守りのサンバ", en: "Shield Samba", zh: "防守之桑巴", ko: "수세의 삼바" }, icon: "/icons/Shield_Samba.png",
        recast: 90, duration: 15, type: "all", value: 15, isShield: false, minLevel: 98, family: "ranged_party_15"
    },
    {
        id: "shield_samba_base", jobId: "dnc", name: { ja: "守りのサンバ", en: "Shield Samba", zh: "防守之桑巴", ko: "수세의 삼바" }, icon: "/icons/Shield_Samba.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, minLevel: 58, maxLevel: 97, family: "ranged_party_15"
    },
];
