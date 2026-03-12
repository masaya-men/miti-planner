import type { Job, Mitigation } from '../types';

export const MITIGATION_DISPLAY_ORDER = [
    'rampart',
    'reprisal_base',
    'reprisal',
    'divine_veil',
    'shake_it_off',
    'dark_missionary',
    'heart_of_light',
    'passage_of_arms',
    'plenary_indulgence',
    'temperance',
    'divine_caress',
    'liturgy_of_the_bell',
    'sacred_soil',
    'succor',
    'concitation',
    'fey_illumination',
    'summon_seraph',
    'consolation',
    'expedient',
    'seraphism',
    'accession',
    'dissipation',
    'collective_unconscious',
    'neutral_sect',
    'sun_sign',
    'helios_conjunction_base',
    'helios_conjunction',
    'macrocosmos',
    'kerachole',
    'holos',
    'panhaima',
    'philosophia',
    'feint_base',
    'feint',
    'mantra',
    'troubadour_base',
    'troubadour',
    'nature_s_minne',
    'tactician_base',
    'tactician',
    'dismantle',
    'shield_samba_base',
    'shield_samba',
    'improvisation',
    'addle_base',
    'addle',
    'magick_barrier',
    'tempera_grassa',
    'sheltron',
    'holy_sheltron',
    'intervention_base',
    'intervention',
    'raw_intuition',
    'bloodwhetting',
    'nascent_flash_base',
    'nascent_flash',
    'the_blackest_night',
    'oblation',
    'heart_of_stone',
    'heart_of_corundum',
    'aurora',
    'bulwark',
    'thrill_of_battle',
    'dark_mind',
    'camouflage',
    'sentinel',
    'guardian',
    'vengeance',
    'damnation',
    'shadow_wall',
    'shadowed_vigil',
    'nebula',
    'great_nebula',
    'hallowed_ground',
    'holmgang',
    'living_dead',
    'superbolide'
];

export function getMitigationPriority(mitigationId: string): number {
    const baseId = mitigationId.replace(/_(pld|war|drk|gnb|whm|sch|ast|sge|mnk|drg|nin|sam|rpr|vpr|brd|mch|dnc|blm|smn|rdm|pct)$/, '');
    const index = MITIGATION_DISPLAY_ORDER.indexOf(baseId);
    return index !== -1 ? index : 999;
}

export const JOBS: Job[] = [
    // Tanks
    { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '/icons/Paladin.png' },
    { id: 'war', name: { ja: '戦士', en: 'Warrior' }, role: 'tank', icon: '/icons/Warrior.png' },
    { id: 'drk', name: { ja: '暗黒騎士', en: 'Dark Knight' }, role: 'tank', icon: '/icons/DarkKnight.png' },
    { id: 'gnb', name: { ja: 'ガンブレイカー', en: 'Gunbreaker' }, role: 'tank', icon: '/icons/Gunbreaker.png' },
    // Healers
    { id: 'whm', name: { ja: '白魔道士', en: 'White Mage' }, role: 'healer', icon: '/icons/WhiteMage.png' },
    { id: 'sch', name: { ja: '学者', en: 'Scholar' }, role: 'healer', icon: '/icons/Scholar.png' },
    { id: 'ast', name: { ja: '占星術師', en: 'Astrologian' }, role: 'healer', icon: '/icons/Astrologian.png' },
    { id: 'sge', name: { ja: '賢者', en: 'Sage' }, role: 'healer', icon: '/icons/Sage.png' },
    // Melee DPS
    { id: 'mnk', name: { ja: 'モンク', en: 'Monk' }, role: 'dps', icon: '/icons/Monk.png' },
    { id: 'drg', name: { ja: '竜騎士', en: 'Dragoon' }, role: 'dps', icon: '/icons/Dragoon.png' },
    { id: 'nin', name: { ja: '忍者', en: 'Ninja' }, role: 'dps', icon: '/icons/Ninja.png' },
    { id: 'sam', name: { ja: '侍', en: 'Samurai' }, role: 'dps', icon: '/icons/Samurai.png' },
    { id: 'rpr', name: { ja: 'リーパー', en: 'Reaper' }, role: 'dps', icon: '/icons/Reaper.png' },
    { id: 'vpr', name: { ja: 'ヴァイパー', en: 'Viper' }, role: 'dps', icon: '/icons/Viper.png' },
    // Physical Ranged DPS
    { id: 'brd', name: { ja: '吟遊詩人', en: 'Bard' }, role: 'dps', icon: '/icons/Bard.png' },
    { id: 'mch', name: { ja: '機工士', en: 'Machinist' }, role: 'dps', icon: '/icons/Machinist.png' },
    { id: 'dnc', name: { ja: '踊り子', en: 'Dancer' }, role: 'dps', icon: '/icons/Dancer.png' },
    // Magical Ranged DPS
    { id: 'blm', name: { ja: '黒魔道士', en: 'Black Mage' }, role: 'dps', icon: '/icons/BlackMage.png' },
    { id: 'smn', name: { ja: '召喚士', en: 'Summoner' }, role: 'dps', icon: '/icons/Summoner.png' },
    { id: 'rdm', name: { ja: '赤魔道士', en: 'Red Mage' }, role: 'dps', icon: '/icons/RedMage.png' },
    { id: 'pct', name: { ja: 'ピクトマンサー', en: 'Pictomancer' }, role: 'dps', icon: '/icons/Pictomancer.png' },
];

export const MITIGATIONS: Mitigation[] = [
    // --- Gunbreaker ---
    {
        id: "aurora", jobId: "gnb", name: { ja: "オーロラ", en: "Aurora" }, icon: "/icons/Aurora.png",
        recast: 60, duration: 18, type: "all", value: 0, isShield: false, scope: "self", family: "tank_sub_targeted"
    },
    {
        id: "camouflage", jobId: "gnb", name: { ja: "カモフラージュ", en: "Camouflage" }, icon: "/icons/Camouflage.png",
        recast: 90, duration: 20, type: "all", value: 10, isShield: false, scope: "self", family: "tank_sub_self"
    },
    {
        id: "great_nebula", jobId: "gnb", name: { ja: "グレートネビュラ", en: "Great Nebula" }, icon: "/icons/Great_Nebula.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "nebula", jobId: "gnb", name: { ja: "ネビュラ", en: "Nebula" }, icon: "/icons/Nebula.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", maxLevel: 91, family: "tank_40"
    },
    {
        id: "heart_of_corundum", jobId: "gnb", name: { ja: "ハート・オブ・コランダム", en: "Heart of Corundum" }, icon: "/icons/Heart_of_Corundum.png",
        recast: 25, duration: 8, type: "all", value: 15, isShield: false,
        note: "最初4秒15%*15%, 残り4秒15％", scope: "self", minLevel: 82, family: "tank_short"
    },
    {
        id: "heart_of_stone", jobId: "gnb", name: { ja: "ハート・オブ・ストーン", en: "Heart of Stone" }, icon: "/icons/Heart_of_Corundum.png",
        recast: 25, duration: 7, type: "all", value: 15, isShield: false,
        scope: "self", maxLevel: 81, family: "tank_short"
    },
    {
        id: "heart_of_light", jobId: "gnb", name: { ja: "ハート・オブ・ライト", en: "Heart of Light" }, icon: "/icons/Heart_of_Light.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", minLevel: 80, family: "tank_party_miti"
    },
    {
        id: "superbolide", jobId: "gnb", name: { ja: "ボーライド", en: "Superbolide" }, icon: "/icons/Superbolide.png",
        recast: 360, duration: 10, type: "all", value: 0, isShield: false, note: "HP減少無視", scope: "self", isInvincible: true, family: "tank_invuln"
    },

    // --- Paladin ---
    {
        id: "bulwark", jobId: "pld", name: { ja: "ブルワーク", en: "Bulwark" }, icon: "/icons/Bulwark.png",
        recast: 90, duration: 10, type: "all", value: 20, isShield: false, note: "DOTダメージは軽減不可", scope: "self", family: "tank_sub_self"
    },
    {
        id: "divine_veil", jobId: "pld", name: { ja: "ディヴァインヴェール", en: "Divine Veil" }, icon: "/icons/Divine_Veil.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", scope: "party", family: "tank_party_miti"
    },
    {
        id: "guardian", jobId: "pld", name: { ja: "エクストリームガード", en: "Guardian" }, icon: "/icons/Guardian.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "sentinel", jobId: "pld", name: { ja: "センチネル", en: "Sentinel" }, icon: "/icons/Sentinel.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", maxLevel: 91, family: "tank_40"
    },
    {
        id: "hallowed_ground", jobId: "pld", name: { ja: "インビンシブル", en: "Hallowed Ground" }, icon: "/icons/Hallowed_Ground.png",
        recast: 420, duration: 10, type: "all", value: 0, isShield: false, scope: "self", isInvincible: true, family: "tank_invuln"
    },
    {
        id: "holy_sheltron", jobId: "pld", name: { ja: "ホーリーシェルトロン", en: "Holy Sheltron" }, icon: "/icons/Holy_Sheltron.png",
        recast: 23, duration: 8, type: "all", value: 15, isShield: false,
        note: "最初4秒15%*15%, 残り4秒15％", scope: "self", minLevel: 82, family: "tank_short"
    },
    {
        id: "sheltron", jobId: "pld", name: { ja: "シェルトロン", en: "Sheltron" }, icon: "/icons/Holy_Sheltron.png",
        recast: 23, duration: 6, type: "all", value: 15, isShield: false,
        scope: "self", maxLevel: 81, family: "tank_short"
    },
    {
        id: "intervention", jobId: "pld", name: { ja: "インターベンション", en: "Intervention" }, icon: "/icons/Intervention.png",
        recast: 23, duration: 8, type: "all", value: 10, isShield: false,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", minLevel: 82, family: "tank_sub_targeted"
    },
    {
        id: "intervention_base", jobId: "pld", name: { ja: "インターベンション", en: "Intervention" }, icon: "/icons/Intervention.png",
        recast: 23, duration: 6, type: "all", value: 10, isShield: false,
        scope: "self", maxLevel: 81, family: "tank_sub_targeted"
    },
    {
        id: "passage_of_arms", jobId: "pld", name: { ja: "パッセージ・オブ・アームズ", en: "Passage of Arms" }, icon: "/icons/Passage_of_Arms.png",
        recast: 120, duration: 5, type: "all", value: 15, isShield: false, scope: "party", family: "tank_party_miti_sub"
    },

    // --- Pictomancer ---
    {
        id: "tempera_grassa", jobId: "pct", name: { ja: "テンペラグラッサ", en: "Tempera Grassa" }, icon: "/icons/Tempera_Grassa.png",
        recast: 90, duration: 10, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", minLevel: 88, family: "caster_personal_shield"
    },

    // --- Monk ---
    {
        id: "mantra", jobId: "mnk", name: { ja: "マントラ", en: "Mantra" }, icon: "/icons/Mantra.png",
        recast: 90, duration: 15, type: "all", value: 0, isShield: false, note: "回復効果10%上昇", healingIncrease: 10, family: "melee_heal_up"
    },
    {
        id: "weapon_break", jobId: "mnk", name: { ja: "ウェポンブレイク", en: "Weapon Break" }, icon: "/icons/Dismantle.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, minLevel: 88, family: "melee_target_10"
    },

    // --- Dark Knight ---
    {
        id: "dark_mind", jobId: "drk", name: { ja: "ダークマインド", en: "Dark Mind" }, icon: "/icons/Dark_Mind.png",
        recast: 60, duration: 10, type: "magical", value: 20, isShield: false,
        valueMagical: 20, valuePhysical: 10, scope: "self", family: "tank_sub_self"
    },
    {
        id: "shadowed_vigil", jobId: "drk", name: { ja: "シャドウヴィジル", en: "Shadowed Vigil" }, icon: "/icons/Shadowed_Vigil.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "shadow_wall", jobId: "drk", name: { ja: "シャドウウォール", en: "Shadow Wall" }, icon: "/icons/Shadow_Wall.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", maxLevel: 91, family: "tank_40"
    },
    {
        id: "dark_missionary", jobId: "drk", name: { ja: "ダークミッショナリー", en: "Dark Missionary" }, icon: "/icons/Dark_Missionary.png",
        recast: 90, duration: 15, type: "magical", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", minLevel: 76, family: "tank_party_miti"
    },
    {
        id: "oblation", jobId: "drk", name: { ja: "オブレーション", en: "Oblation" }, icon: "/icons/Oblation.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, scope: "self", maxCharges: 2, minLevel: 82, family: "tank_sub_targeted"
    },
    {
        id: "the_blackest_night", jobId: "drk", name: { ja: "ブラックナイト", en: "The Blackest Night" }, icon: "/icons/The_Blackest_Night.png",
        recast: 15, duration: 7, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "25% HP", scope: "self", family: "tank_short"
    },

    // --- Scholar ---
    {
        id: "accession", jobId: "sch", name: { ja: "アクセッション", en: "Accession" }, icon: "/icons/Accession.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 100, requires: "seraphism", minLevel: 100, family: "healer_gcd_shield"
    },
    {
        id: "concitation", jobId: "sch", name: { ja: "意気軒高の策", en: "Concitation" }, icon: "/icons/Concitation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 360, minLevel: 92, family: "succor"
    },
    {
        id: "succor", jobId: "sch", name: { ja: "士気高揚の策", en: "Succor" }, icon: "/icons/Concitation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 320, maxLevel: 91, family: "succor"
    },
    {
        id: "consolation", jobId: "sch", name: { ja: "コンソレイション", en: "Consolation" }, icon: "/icons/Consolation.png",
        recast: 1, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 250, requires: "summon_seraph", maxCharges: 2, minLevel: 80, family: "bh_sub_a"
    },
    {
        id: "adloquium", jobId: "sch", name: { ja: "鼓舞激励の策", en: "Adloquium" }, icon: "/icons/Adloquium.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, family: "healer_gcd_target_shield"
    },
    {
        id: "recitation_deployment_tactics", jobId: "sch", name: { ja: "秘策：展開戦術", en: "Recitation Deployment Tactics" }, icon: "/icons/Deployment_Tactics.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, note: "確定クリティカル", family: "bh_90_shield"
    },

    {
        id: "dissipation", jobId: "sch", name: { ja: "転化", en: "Dissipation" }, icon: "/icons/Dissipation.png",
        recast: 180, duration: 30, type: "all", value: 0, isShield: false, healingIncrease: 20, healingIncreaseSelfOnly: true, family: "sch_dissipation"
    },
    {
        id: "expedient", jobId: "sch", name: { ja: "疾風怒濤の計", en: "Expedient" }, icon: "/icons/Expedient.png",
        recast: 120, duration: 20, type: "all", value: 10, isShield: false, minLevel: 90, family: "bh_120_b"
    },
    {
        id: "fey_illumination", jobId: "sch", name: { ja: "フェイイルミネーション", en: "Fey Illumination" }, icon: "/icons/Fey_Illumination.png",
        recast: 120, duration: 20, type: "magical", value: 5, isShield: false,
        note: "被魔法5%軽減, 回復効果10%上昇", healingIncrease: 10, family: "bh_sub_a"
    },
    {
        id: "sacred_soil", jobId: "sch", name: { ja: "野戦治療の陣", en: "Sacred Soil" }, icon: "/icons/Sacred_Soil.png",
        recast: 30, duration: 17, type: "all", value: 10, isShield: false, resourceCost: { type: 'aetherflow', amount: 1 }, family: "healer_bubble"
    },
    {
        id: "seraphism", jobId: "sch", name: { ja: "セラフィズム", en: "Seraphism" }, icon: "/icons/Seraphism.png",
        recast: 180, duration: 20, type: "all", value: 0, isShield: false, family: "bh_180_big"
    },
    {
        id: "summon_seraph", jobId: "sch", name: { ja: "サモン・セラフィム", en: "Summon Seraph" }, icon: "/icons/Summon_Seraph.png",
        recast: 120, duration: 22, type: "all", value: 0, isShield: false, minLevel: 80, family: "bh_120_a"
    },

    // --- Machinist ---
    {
        id: "dismantle", jobId: "mch", name: { ja: "ウェポンブレイク", en: "Dismantle" }, icon: "/icons/Dismantle.png",
        recast: 120, duration: 10, type: "all", value: 10, isShield: false, family: "ranged_target_10"
    },
    {
        id: "tactician", jobId: "mch", name: { ja: "タクティシャン", en: "Tactician" }, icon: "/icons/Tactician.png",
        recast: 90, duration: 15, type: "all", value: 15, isShield: false, minLevel: 98, family: "ranged_party_15"
    },
    {
        id: "tactician_base", jobId: "mch", name: { ja: "タクティシャン", en: "Tactician" }, icon: "/icons/Tactician.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, maxLevel: 97, family: "ranged_party_15"
    },

    // --- Bard ---
    {
        id: "nature_s_minne", jobId: "brd", name: { ja: "地神のミンネ", en: "Nature's Minne" }, icon: "/icons/Nature's_Minne.png",
        recast: 120, duration: 15, type: "all", value: 0, isShield: false, note: "回復効果15%上昇", healingIncrease: 15, family: "ranged_heal_up"
    },
    {
        id: "troubadour", jobId: "brd", name: { ja: "トルバドゥール", en: "Troubadour" }, icon: "/icons/Troubadour.png",
        recast: 90, duration: 15, type: "all", value: 15, isShield: false, minLevel: 98, family: "ranged_party_15"
    },
    {
        id: "troubadour_base", jobId: "brd", name: { ja: "トルバドゥール", en: "Troubadour" }, icon: "/icons/Troubadour.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, maxLevel: 97, family: "ranged_party_15"
    },

    // --- Sage ---
    {
        id: "eukrasian_prognosis_ii", jobId: "sge", name: { ja: "エウクラシア・プログノシスII", en: "Eukrasian Prognosis II" }, icon: "/icons/Eukrasian_Prognosis_II.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 360, minLevel: 96, family: "healer_gcd_shield"
    },
    {
        id: "eukrasian_prognosis", jobId: "sge", name: { ja: "エウクラシア・プログノシス", en: "Eukrasian Prognosis" }, icon: "/icons/Eukrasian_Prognosis_II.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 320, maxLevel: 95, family: "healer_gcd_shield"
    },
    {
        id: "holos", jobId: "sge", name: { ja: "ホーリズム", en: "Holos" }, icon: "/icons/Holos.png",
        recast: 120, duration: 20, type: "all", value: 10, isShield: true, valueType: 'potency', shieldPotency: 300, minLevel: 86, family: "bh_120_b"
    },
    {
        id: "kerachole", jobId: "sge", name: { ja: "ケーラコレ", en: "Kerachole" }, icon: "/icons/Kerachole.png",
        recast: 30, duration: 15, type: "all", value: 10, isShield: false, resourceCost: { type: 'addersgall', amount: 1 }, family: "healer_bubble"
    },
    {
        id: "panhaima", jobId: "sge", name: { ja: "パンハイマ", en: "Panhaima" }, icon: "/icons/Panhaima.png",
        recast: 120, duration: 15, type: "all", value: 0, isShield: true, family: "bh_120_a"
    },
    {
        id: "philosophia", jobId: "sge", name: { ja: "フィロソフィア", en: "Philosophia" }, icon: "/icons/Philosophia.png",
        recast: 180, duration: 20, type: "all", value: 0, isShield: false, family: "bh_180_big"
    },

    // --- Red Mage ---
    {
        id: "magick_barrier", jobId: "rdm", name: { ja: "バマジク", en: "Magick Barrier" }, icon: "/icons/Magick_Barrier.png",
        recast: 120, duration: 10, type: "magical", value: 10, isShield: false,
        note: "被魔法10%軽減, 回復効果5%上昇", valueMagical: 10, valuePhysical: 0, healingIncrease: 5, minLevel: 86, family: "caster_party_miti"
    },

    // --- Astrologian ---
    {
        id: "collective_unconscious", jobId: "ast", name: { ja: "運命の輪", en: "Collective Unconscious" }, icon: "/icons/Collective_Unconscious.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, family: "ph_60_aoe"
    },
    {
        id: "helios_conjunction", jobId: "ast", name: { ja: "コンジャンクション・ヘリオス", en: "Helios Conjunction" }, icon: "/icons/Helios_Conjunction.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 312.5, note: "ニュートラルセクト中のみバリア", requires: "neutral_sect", minLevel: 96, family: "healer_gcd_shield"
    },
    {
        id: "aspected_helios", jobId: "ast", name: { ja: "アスペクト・ヘリオス", en: "Aspected Helios" }, icon: "/icons/Helios_Conjunction.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 312.5, note: "ニュートラルセクト中のみバリア", requires: "neutral_sect", maxLevel: 95, family: "healer_gcd_shield"
    },
    {
        id: "macrocosmos", jobId: "ast", name: { ja: "マクロコスモス", en: "Macrocosmos" }, icon: "/icons/Macrocosmos.png",
        recast: 180, duration: 15, type: "all", value: 0, isShield: false, minLevel: 90, family: "ph_180_big"
    },
    {
        id: "neutral_sect", jobId: "ast", name: { ja: "ニュートラルセクト", en: "Neutral Sect" }, icon: "/icons/Neutral_Sect.png",
        recast: 120, duration: 20, type: "all", value: 0, isShield: false, healingIncrease: 20, healingIncreaseSelfOnly: true, minLevel: 80, family: "ph_120_aoe"
    },
    {
        id: "sun_sign", jobId: "ast", name: { ja: "サンサイン", en: "Sun Sign" }, icon: "/icons/Sun_Sign.png",
        recast: 1, duration: 15, type: "all", value: 10, isShield: false, requires: "neutral_sect", maxCharges: 1, minLevel: 100, family: "ph_sub_120"
    },

    // --- Warrior ---
    {
        id: "damnation", jobId: "war", name: { ja: "ダムネーション", en: "Damnation" }, icon: "/icons/Damnation.png",
        recast: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", minLevel: 92, family: "tank_40"
    },
    {
        id: "vengeance", jobId: "war", name: { ja: "ヴェンジェンス", en: "Vengeance" }, icon: "/icons/Vengeance.png",
        recast: 120, duration: 15, type: "all", value: 30, isShield: false, scope: "self", maxLevel: 91, family: "tank_40"
    },
    {
        id: "bloodwhetting", jobId: "war", name: { ja: "原初の血気", en: "Bloodwhetting" }, icon: "/icons/Bloodwhetting.png",
        recast: 25, duration: 8, type: "all", value: 20, isShield: true, valueType: 'potency', shieldPotency: 400,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", minLevel: 82, family: "tank_short"
    },
    {
        id: "raw_intuition", jobId: "war", name: { ja: "原初の直感", en: "Raw Intuition" }, icon: "/icons/Bloodwhetting.png",
        recast: 25, duration: 6, type: "all", value: 10, isShield: false,
        scope: "self", maxLevel: 81, family: "tank_short"
    },
    {
        id: "nascent_flash", jobId: "war", name: { ja: "原初の猛り", en: "Nascent Flash" }, icon: "/icons/Nascent_Flash.png",
        recast: 25, duration: 8, type: "all", value: 20, isShield: true, valueType: 'potency', shieldPotency: 400,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", minLevel: 82, family: "tank_sub_targeted"
    },
    {
        id: "nascent_flash_base", jobId: "war", name: { ja: "原初の猛り", en: "Nascent Flash" }, icon: "/icons/Nascent_Flash.png",
        recast: 25, duration: 6, type: "all", value: 10, isShield: false,
        scope: "self", maxLevel: 81, family: "tank_sub_targeted"
    },
    {
        id: "shake_it_off", jobId: "war", name: { ja: "シェイクオフ", en: "Shake It Off" }, icon: "/icons/Shake_It_Off.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "15% HP", scope: "party", family: "tank_party_miti"
    },
    {
        id: "thrill_of_battle", jobId: "war", name: { ja: "スリル・オブ・バトル", en: "Thrill of Battle" }, icon: "/icons/Thrill_of_Battle.png",
        recast: 90, duration: 10, type: "all", value: 0, isShield: false, scope: "self", family: "tank_sub_self"
    },

    // --- White Mage ---
    {
        id: "divine_caress", jobId: "whm", name: { ja: "ディヴァインカレス", en: "Divine Caress" }, icon: "/icons/Divine_Caress.png",
        recast: 1, duration: 10, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 400, requires: "temperance", minLevel: 100, family: "ph_sub_120"
    },
    {
        id: "plenary_indulgence", jobId: "whm", name: { ja: "インドゥルゲンティア", en: "Plenary Indulgence" }, icon: "/icons/Plenary_Indulgence.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, family: "ph_60_aoe"
    },
    {
        id: "temperance", jobId: "whm", name: { ja: "テンパランス", en: "Temperance" }, icon: "/icons/Temperance.png",
        recast: 120, duration: 20, type: "all", value: 10, isShield: false, minLevel: 80, family: "ph_120_aoe"
    },

    // --- Dancer ---
    {
        id: "improvisation", jobId: "dnc", name: { ja: "インプロビゼーション", en: "Improvisation" }, icon: "/icons/Improvisation.png",
        recast: 120, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", minLevel: 80, family: "ranged_party_heal"
    },
    {
        id: "shield_samba", jobId: "dnc", name: { ja: "守りのサンバ", en: "Shield Samba" }, icon: "/icons/Shield_Samba.png",
        recast: 90, duration: 15, type: "all", value: 15, isShield: false, minLevel: 98, family: "ranged_party_15"
    },
    {
        id: "shield_samba_base", jobId: "dnc", name: { ja: "守りのサンバ", en: "Shield Samba" }, icon: "/icons/Shield_Samba.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, maxLevel: 97, family: "ranged_party_15"
    },

    // --- Role Actions ---
    // Rampart (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `rampart_${job}`, jobId: job, name: { ja: "ランパート", en: "Rampart" }, icon: "/icons/Rampart.png",
        recast: 90, duration: 20, type: "all" as const, value: 20, isShield: false, scope: "self" as const, family: "role_action"
    })),
    // Reprisal (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_${job}`, jobId: job, name: { ja: "リプライザル", en: "Reprisal" }, icon: "/icons/Reprisal.png",
        recast: 60, duration: 15, type: "all" as const, value: 10, isShield: false, scope: "party" as const, minLevel: 98, family: "role_action"
    })),
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_base_${job}`, jobId: job, name: { ja: "リプライザル", en: "Reprisal" }, icon: "/icons/Reprisal.png",
        recast: 60, duration: 10, type: "all" as const, value: 10, isShield: false, scope: "party" as const, maxLevel: 97, family: "role_action"
    })),
    // Addle (Casters: blm, smn, rdm, pct)
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_${job}`, jobId: job, name: { ja: "アドル", en: "Addle" }, icon: "/icons/Addle.png",
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, minLevel: 98, family: "role_action"
    })),
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_base_${job}`, jobId: job, name: { ja: "アドル", en: "Addle" }, icon: "/icons/Addle.png",
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, maxLevel: 97, family: "role_action"
    })),
    // Feint (Melee: mnk, drg, nin, sam, rpr, vpr)
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_${job}`, jobId: job, name: { ja: "牽制", en: "Feint" }, icon: "/icons/Feint.png",
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, minLevel: 98, family: "role_action"
    })),
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_base_${job}`, jobId: job, name: { ja: "牽制", en: "Feint" }, icon: "/icons/Feint.png",
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, maxLevel: 97, family: "role_action"
    })),
];
