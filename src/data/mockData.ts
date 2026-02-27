import type { Job, Mitigation } from '../types';

export const MITIGATION_DISPLAY_ORDER = [
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
    'recitation_deployment_tactics',
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
    'helios_conjunction',
    'macrocosmos',
    'kerachole',
    'holos',
    'panhaima',
    'philosophia',
    'feint',
    'mantra',
    'troubadour',
    'nature_s_minne',
    'tactician',
    'dismantle',
    'shield_samba',
    'improvisation',
    'addle',
    'magick_barrier',
    'tempera_grassa',
    'holy_sheltron',
    'intervention',
    'bloodwhetting',
    'nascent_flash',
    'the_blackest_night',
    'oblation',
    'heart_of_corundum',
    'aurora',
    'rampart',
    'bulwark',
    'thrill_of_battle',
    'dark_mind',
    'camouflage',
    'guardian',
    'damnation',
    'shadowed_vigil',
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
    { id: 'pld', name: 'ナイト', nameEn: 'Paladin', role: 'tank', icon: '/icons/Paladin.png' },
    { id: 'war', name: '戦士', nameEn: 'Warrior', role: 'tank', icon: '/icons/Warrior.png' },
    { id: 'drk', name: '暗黒騎士', nameEn: 'Dark Knight', role: 'tank', icon: '/icons/DarkKnight.png' },
    { id: 'gnb', name: 'ガンブレイカー', nameEn: 'Gunbreaker', role: 'tank', icon: '/icons/Gunbreaker.png' },
    // Healers
    { id: 'whm', name: '白魔道士', nameEn: 'White Mage', role: 'healer', icon: '/icons/WhiteMage.png' },
    { id: 'sch', name: '学者', nameEn: 'Scholar', role: 'healer', icon: '/icons/Scholar.png' },
    { id: 'ast', name: '占星術師', nameEn: 'Astrologian', role: 'healer', icon: '/icons/Astrologian.png' },
    { id: 'sge', name: '賢者', nameEn: 'Sage', role: 'healer', icon: '/icons/Sage.png' },
    // Melee DPS
    { id: 'mnk', name: 'モンク', nameEn: 'Monk', role: 'dps', icon: '/icons/Monk.png' },
    { id: 'drg', name: '竜騎士', nameEn: 'Dragoon', role: 'dps', icon: '/icons/Dragoon.png' },
    { id: 'nin', name: '忍者', nameEn: 'Ninja', role: 'dps', icon: '/icons/Ninja.png' },
    { id: 'sam', name: '侍', nameEn: 'Samurai', role: 'dps', icon: '/icons/Samurai.png' },
    { id: 'rpr', name: 'リーパー', nameEn: 'Reaper', role: 'dps', icon: '/icons/Reaper.png' },
    { id: 'vpr', name: 'ヴァイパー', nameEn: 'Viper', role: 'dps', icon: '/icons/Viper.png' },
    // Physical Ranged DPS
    { id: 'brd', name: '吟遊詩人', nameEn: 'Bard', role: 'dps', icon: '/icons/Bard.png' },
    { id: 'mch', name: '機工士', nameEn: 'Machinist', role: 'dps', icon: '/icons/Machinist.png' },
    { id: 'dnc', name: '踊り子', nameEn: 'Dancer', role: 'dps', icon: '/icons/Dancer.png' },
    // Magical Ranged DPS
    { id: 'blm', name: '黒魔道士', nameEn: 'Black Mage', role: 'dps', icon: '/icons/BlackMage.png' },
    { id: 'smn', name: '召喚士', nameEn: 'Summoner', role: 'dps', icon: '/icons/Summoner.png' },
    { id: 'rdm', name: '赤魔道士', nameEn: 'Red Mage', role: 'dps', icon: '/icons/RedMage.png' },
    { id: 'pct', name: 'ピクトマンサー', nameEn: 'Pictomancer', role: 'dps', icon: '/icons/Pictomancer.png' },
];

export const MITIGATIONS: Mitigation[] = [
    // --- Gunbreaker ---
    {
        id: "aurora", jobId: "gnb", name: "オーロラ", nameEn: "Aurora", icon: "/icons/Aurora.png",
        cooldown: 60, duration: 18, type: "all", value: 0, isShield: false, scope: "self", family: "tank_sub_targeted"
    },
    {
        id: "camouflage", jobId: "gnb", name: "カモフラージュ", nameEn: "Camouflage", icon: "/icons/Camouflage.png",
        cooldown: 90, duration: 20, type: "all", value: 10, isShield: false, scope: "self", family: "tank_sub_self"
    },
    {
        id: "great_nebula", jobId: "gnb", name: "グレートネビュラ", nameEn: "Great Nebula", icon: "/icons/Great_Nebula.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "heart_of_corundum", jobId: "gnb", name: "ハート・オブ・コランダム", nameEn: "Heart of Corundum", icon: "/icons/Heart_of_Corundum.png",
        cooldown: 25, duration: 8, type: "all", value: 15, isShield: false,
        note: "最初4秒15%*15%, 残り4秒15％", scope: "self", family: "tank_short"
    },
    {
        id: "heart_of_light", jobId: "gnb", name: "ハート・オブ・ライト", nameEn: "Heart of Light", icon: "/icons/Heart_of_Light.png",
        cooldown: 90, duration: 15, type: "all", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", family: "tank_party_miti"
    },
    {
        id: "superbolide", jobId: "gnb", name: "ボーライド", nameEn: "Superbolide", icon: "/icons/Superbolide.png",
        cooldown: 360, duration: 10, type: "all", value: 0, isShield: false, note: "HP減少無視", scope: "self", isInvincible: true, family: "tank_invuln"
    },

    // --- Paladin ---
    {
        id: "bulwark", jobId: "pld", name: "ブルワーク", nameEn: "Bulwark", icon: "/icons/Bulwark.png",
        cooldown: 90, duration: 10, type: "all", value: 20, isShield: false, note: "DOTダメージは軽減不可", scope: "self", family: "tank_sub_self"
    },
    {
        id: "divine_veil", jobId: "pld", name: "ディヴァインヴェール", nameEn: "Divine Veil", icon: "/icons/Divine_Veil.png",
        cooldown: 90, duration: 30, type: "all", value: 0, isShield: true, scope: "party", family: "tank_party_miti"
    },
    {
        id: "guardian", jobId: "pld", name: "エクストリームガード", nameEn: "Guardian", icon: "/icons/Guardian.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "hallowed_ground", jobId: "pld", name: "インビンシブル", nameEn: "Hallowed Ground", icon: "/icons/Hallowed_Ground.png",
        cooldown: 420, duration: 10, type: "all", value: 0, isShield: false, scope: "self", isInvincible: true, family: "tank_invuln"
    },
    {
        id: "holy_sheltron", jobId: "pld", name: "ホーリーシェルトロン", nameEn: "Holy Sheltron", icon: "/icons/Holy_Sheltron.png",
        cooldown: 23, duration: 8, type: "all", value: 15, isShield: false,
        note: "最初4秒15%*15%, 残り4秒15％", scope: "self", family: "tank_short"
    },
    {
        id: "intervention", jobId: "pld", name: "インターベンション", nameEn: "Intervention", icon: "/icons/Intervention.png",
        cooldown: 23, duration: 8, type: "all", value: 10, isShield: false,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", family: "tank_sub_targeted"
    },
    {
        id: "passage_of_arms", jobId: "pld", name: "パッセージ・オブ・アームズ", nameEn: "Passage of Arms", icon: "/icons/Passage_of_Arms.png",
        cooldown: 120, duration: 5, type: "all", value: 15, isShield: false, scope: "party", family: "tank_party_miti_sub"
    },

    // --- Pictomancer ---
    {
        id: "tempera_grassa", jobId: "pct", name: "テンペラグラッサ", nameEn: "Tempera Grassa", icon: "/icons/Tempera_Grassa.png",
        cooldown: 90, duration: 10, type: "all", value: 0, isShield: true, family: "caster_personal_shield"
    },

    // --- Monk ---
    {
        id: "mantra", jobId: "mnk", name: "マントラ", nameEn: "Mantra", icon: "/icons/Mantra.png",
        cooldown: 90, duration: 15, type: "all", value: 0, isShield: false, note: "回復効果10%上昇", healingIncrease: 10, family: "melee_heal_up"
    },

    // --- Dark Knight ---
    {
        id: "dark_mind", jobId: "drk", name: "ダークマインド", nameEn: "Dark Mind", icon: "/icons/Dark_Mind.png",
        cooldown: 60, duration: 10, type: "magical", value: 20, isShield: false,
        valueMagical: 20, valuePhysical: 10, scope: "self", family: "tank_sub_self"
    },
    {
        id: "dark_missionary", jobId: "drk", name: "ダークミッショナリー", nameEn: "Dark Missionary", icon: "/icons/Dark_Missionary.png",
        cooldown: 90, duration: 15, type: "magical", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", family: "tank_party_miti"
    },
    {
        id: "living_dead", jobId: "drk", name: "リビングデッド", nameEn: "Living Dead", icon: "/icons/Living_Dead.png",
        cooldown: 300, duration: 10, type: "all", value: 0, isShield: false, note: "HP減少無視", scope: "self", isInvincible: true, family: "tank_invuln"
    },
    {
        id: "oblation", jobId: "drk", name: "オブレーション", nameEn: "Oblation", icon: "/icons/Oblation.png",
        cooldown: 60, duration: 10, type: "all", value: 10, isShield: false, scope: "self", maxCharges: 2, family: "tank_sub_targeted"
    },
    {
        id: "shadowed_vigil", jobId: "drk", name: "シャドウヴィジル", nameEn: "Shadowed Vigil", icon: "/icons/Shadowed_Vigil.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "the_blackest_night", jobId: "drk", name: "ブラックナイト", nameEn: "The Blackest Night", icon: "/icons/The_Blackest_Night.png",
        cooldown: 15, duration: 7, type: "all", value: 0, isShield: true, scope: "self", family: "tank_short"
    },

    // --- Scholar ---
    {
        id: "accession", jobId: "sch", name: "アクセッション", nameEn: "Accession", icon: "/icons/Accession.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, requires: "seraphism", family: "healer_gcd_shield"
    },
    {
        id: "concitation", jobId: "sch", name: "意気軒高の策", nameEn: "Concitation", icon: "/icons/Concitation.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, family: "healer_gcd_shield"
    },
    {
        id: "consolation", jobId: "sch", name: "コンソレイション", nameEn: "Consolation", icon: "/icons/Consolation.png",
        cooldown: 1, duration: 30, type: "all", value: 0, isShield: true, requires: "summon_seraph", maxCharges: 2, family: "bh_sub_a"
    },
    {
        id: "adloquium", jobId: "sch", name: "鼓舞激励の策", nameEn: "Adloquium", icon: "/icons/Adloquium.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, family: "healer_gcd_target_shield"
    },
    {
        id: "recitation_deployment_tactics", jobId: "sch", name: "秘策：展開戦術", nameEn: "Recitation Deployment Tactics", icon: "/icons/Deployment_Tactics.png",
        cooldown: 90, duration: 30, type: "all", value: 0, isShield: true, note: "確定クリティカル", family: "bh_90_shield"
    },

    {
        id: "dissipation", jobId: "sch", name: "転化", nameEn: "Dissipation", icon: "/icons/Dissipation.png",
        cooldown: 180, duration: 30, type: "all", value: 0, isShield: false, healingIncrease: 20, family: "sch_dissipation"
    },
    {
        id: "expedient", jobId: "sch", name: "疾風怒濤の計", nameEn: "Expedient", icon: "/icons/Expedient.png",
        cooldown: 120, duration: 20, type: "all", value: 10, isShield: false, family: "bh_120_b"
    },
    {
        id: "fey_illumination", jobId: "sch", name: "フェイイルミネーション", nameEn: "Fey Illumination", icon: "/icons/Fey_Illumination.png",
        cooldown: 120, duration: 20, type: "magical", value: 5, isShield: false,
        note: "被魔法5%軽減, 回復効果10%上昇", healingIncrease: 10, family: "bh_sub_a"
    },
    {
        id: "sacred_soil", jobId: "sch", name: "野戦治療の陣", nameEn: "Sacred Soil", icon: "/icons/Sacred_Soil.png",
        cooldown: 30, duration: 17, type: "all", value: 10, isShield: false, resourceCost: { type: 'aetherflow', amount: 1 }, family: "healer_bubble"
    },
    {
        id: "seraphism", jobId: "sch", name: "セラフィズム", nameEn: "Seraphism", icon: "/icons/Seraphism.png",
        cooldown: 180, duration: 20, type: "all", value: 0, isShield: false, family: "bh_180_big"
    },
    {
        id: "summon_seraph", jobId: "sch", name: "サモン・セラフィム", nameEn: "Summon Seraph", icon: "/icons/Summon_Seraph.png",
        cooldown: 120, duration: 22, type: "all", value: 0, isShield: false, family: "bh_120_a"
    },

    // --- Machinist ---
    {
        id: "dismantle", jobId: "mch", name: "ウェポンブレイク", nameEn: "Dismantle", icon: "/icons/Dismantle.png",
        cooldown: 120, duration: 10, type: "all", value: 10, isShield: false, family: "ranged_target_10"
    },
    {
        id: "tactician", jobId: "mch", name: "タクティシャン", nameEn: "Tactician", icon: "/icons/Tactician.png",
        cooldown: 90, duration: 15, type: "all", value: 15, isShield: false, family: "ranged_party_15"
    },

    // --- Bard ---
    {
        id: "nature_s_minne", jobId: "brd", name: "地神のミンネ", nameEn: "Nature's Minne", icon: "/icons/Nature's_Minne.png",
        cooldown: 120, duration: 15, type: "all", value: 0, isShield: false, note: "回復効果15%上昇", healingIncrease: 15, family: "ranged_heal_up"
    },
    {
        id: "troubadour", jobId: "brd", name: "トルバドゥール", nameEn: "Troubadour", icon: "/icons/Troubadour.png",
        cooldown: 90, duration: 15, type: "all", value: 15, isShield: false, family: "ranged_party_15"
    },

    // --- Sage ---
    {
        id: "eukrasian_prognosis_ii", jobId: "sge", name: "エウクラシア・プログノシスII", nameEn: "Eukrasian Prognosis II", icon: "/icons/Eukrasian_Prognosis_II.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, family: "healer_gcd_shield"
    },
    {
        id: "holos", jobId: "sge", name: "ホーリズム", nameEn: "Holos", icon: "/icons/Holos.png",
        cooldown: 120, duration: 20, type: "all", value: 10, isShield: true, family: "bh_120_b"
    },
    {
        id: "kerachole", jobId: "sge", name: "ケーラコレ", nameEn: "Kerachole", icon: "/icons/Kerachole.png",
        cooldown: 30, duration: 15, type: "all", value: 10, isShield: false, resourceCost: { type: 'addersgall', amount: 1 }, family: "healer_bubble"
    },
    {
        id: "panhaima", jobId: "sge", name: "パンハイマ", nameEn: "Panhaima", icon: "/icons/Panhaima.png",
        cooldown: 120, duration: 15, type: "all", value: 0, isShield: true, family: "bh_120_a"
    },
    {
        id: "philosophia", jobId: "sge", name: "フィロソフィア", nameEn: "Philosophia", icon: "/icons/Philosophia.png",
        cooldown: 180, duration: 20, type: "all", value: 0, isShield: false, family: "bh_180_big"
    },

    // --- Red Mage ---
    {
        id: "magick_barrier", jobId: "rdm", name: "バマジク", nameEn: "Magick Barrier", icon: "/icons/Magick_Barrier.png",
        cooldown: 120, duration: 10, type: "magical", value: 10, isShield: false,
        note: "被魔法10%軽減, 回復効果5%上昇", valueMagical: 10, valuePhysical: 0, healingIncrease: 5, family: "caster_party_miti"
    },

    // --- Astrologian ---
    {
        id: "collective_unconscious", jobId: "ast", name: "運命の輪", nameEn: "Collective Unconscious", icon: "/icons/Collective_Unconscious.png",
        cooldown: 60, duration: 10, type: "all", value: 10, isShield: false, family: "ph_60_aoe"
    },
    {
        id: "helios_conjunction", jobId: "ast", name: "コンジャンクション・ヘリオス", nameEn: "Helios Conjunction", icon: "/icons/Helios_Conjunction.png",
        cooldown: 2.5, duration: 15, type: "all", value: 0, isShield: false, note: "ニュートラルセクト中のみバリア", requires: "neutral_sect", family: "healer_gcd_shield"
    },
    {
        id: "macrocosmos", jobId: "ast", name: "マクロコスモス", nameEn: "Macrocosmos", icon: "/icons/Macrocosmos.png",
        cooldown: 180, duration: 15, type: "all", value: 0, isShield: false, family: "ph_180_big"
    },
    {
        id: "neutral_sect", jobId: "ast", name: "ニュートラルセクト", nameEn: "Neutral Sect", icon: "/icons/Neutral_Sect.png",
        cooldown: 120, duration: 20, type: "all", value: 0, isShield: false, healingIncrease: 20, family: "ph_120_aoe"
    },
    {
        id: "sun_sign", jobId: "ast", name: "サンサイン", nameEn: "Sun Sign", icon: "/icons/Sun_Sign.png",
        cooldown: 1, duration: 15, type: "all", value: 10, isShield: false, requires: "neutral_sect", maxCharges: 1, family: "ph_sub_120"
    },

    // --- Warrior ---
    {
        id: "bloodwhetting", jobId: "war", name: "原初の血気", nameEn: "Bloodwhetting", icon: "/icons/Bloodwhetting.png",
        cooldown: 25, duration: 8, type: "all", value: 20, isShield: true,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", family: "tank_short"
    },
    {
        id: "damnation", jobId: "war", name: "ダムネーション", nameEn: "Damnation", icon: "/icons/Damnation.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "holmgang", jobId: "war", name: "ホルムギャング", nameEn: "Holmgang", icon: "/icons/Holmgang.png",
        cooldown: 240, duration: 10, type: "all", value: 0, isShield: false, note: "HP減少無視", scope: "self", isInvincible: true, family: "tank_invuln"
    },
    {
        id: "nascent_flash", jobId: "war", name: "原初の猛り", nameEn: "Nascent Flash", icon: "/icons/Nascent_Flash.png",
        cooldown: 25, duration: 8, type: "all", value: 20, isShield: true,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", family: "tank_sub_targeted"
    },
    {
        id: "shake_it_off", jobId: "war", name: "シェイクオフ", nameEn: "Shake It Off", icon: "/icons/Shake_It_Off.png",
        cooldown: 90, duration: 30, type: "all", value: 0, isShield: true, scope: "party", family: "tank_party_miti"
    },
    {
        id: "thrill_of_battle", jobId: "war", name: "スリル・オブ・バトル", nameEn: "Thrill of Battle", icon: "/icons/Thrill_of_Battle.png",
        cooldown: 90, duration: 10, type: "all", value: 0, isShield: false, scope: "self", family: "tank_sub_self"
    },

    // --- White Mage ---
    {
        id: "divine_caress", jobId: "whm", name: "ディヴァインカレス", nameEn: "Divine Caress", icon: "/icons/Divine_Caress.png",
        cooldown: 1, duration: 10, type: "all", value: 0, isShield: true, requires: "temperance", family: "ph_sub_120"
    },
    {
        id: "plenary_indulgence", jobId: "whm", name: "インドゥルゲンティア", nameEn: "Plenary Indulgence", icon: "/icons/Plenary_Indulgence.png",
        cooldown: 60, duration: 10, type: "all", value: 0, isShield: false, family: "ph_60_aoe"
    },
    {
        id: "temperance", jobId: "whm", name: "テンパランス", nameEn: "Temperance", icon: "/icons/Temperance.png",
        cooldown: 120, duration: 20, type: "all", value: 10, isShield: false, family: "ph_120_aoe"
    },

    // --- Dancer ---
    {
        id: "improvisation", jobId: "dnc", name: "インプロビゼーション", nameEn: "Improvisation", icon: "/icons/Improvisation.png",
        cooldown: 120, duration: 30, type: "all", value: 0, isShield: true, note: "最大HPの5-10%バリア", family: "ranged_party_heal"
    },
    {
        id: "shield_samba", jobId: "dnc", name: "守りのサンバ", nameEn: "Shield Samba", icon: "/icons/Shield_Samba.png",
        cooldown: 90, duration: 15, type: "all", value: 15, isShield: false, family: "ranged_party_15"
    },

    // --- Role Actions ---
    // Rampart (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `rampart_${job}`, jobId: job, name: "ランパート", nameEn: "Rampart", icon: "/icons/Rampart.png",
        cooldown: 90, duration: 20, type: "all" as const, value: 20, isShield: false, scope: "self" as const, family: "role_action"
    })),
    // Reprisal (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_${job}`, jobId: job, name: "リプライザル", nameEn: "Reprisal", icon: "/icons/Reprisal.png",
        cooldown: 60, duration: 15, type: "all" as const, value: 10, isShield: false, scope: "party" as const, family: "role_action"
    })),
    // Addle (Casters: blm, smn, rdm, pct)
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_${job}`, jobId: job, name: "アドル", nameEn: "Addle", icon: "/icons/Addle.png",
        cooldown: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, family: "role_action"
    })),
    // Feint (Melee: mnk, drg, nin, sam, rpr, vpr)
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_${job}`, jobId: job, name: "牽制", nameEn: "Feint", icon: "/icons/Feint.png",
        cooldown: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, family: "role_action"
    })),
];
