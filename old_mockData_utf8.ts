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
    { id: 'pld', name: '繝翫う繝・, nameEn: 'Paladin', role: 'tank', icon: '/icons/Paladin.png' },
    { id: 'war', name: '謌ｦ螢ｫ', nameEn: 'Warrior', role: 'tank', icon: '/icons/Warrior.png' },
    { id: 'drk', name: '證鈴ｻ帝ｨ主｣ｫ', nameEn: 'Dark Knight', role: 'tank', icon: '/icons/DarkKnight.png' },
    { id: 'gnb', name: '繧ｬ繝ｳ繝悶Ξ繧､繧ｫ繝ｼ', nameEn: 'Gunbreaker', role: 'tank', icon: '/icons/Gunbreaker.png' },
    // Healers
    { id: 'whm', name: '逋ｽ鬲秘％螢ｫ', nameEn: 'White Mage', role: 'healer', icon: '/icons/WhiteMage.png' },
    { id: 'sch', name: '蟄ｦ閠・, nameEn: 'Scholar', role: 'healer', icon: '/icons/Scholar.png' },
    { id: 'ast', name: '蜊譏溯｡灘ｸｫ', nameEn: 'Astrologian', role: 'healer', icon: '/icons/Astrologian.png' },
    { id: 'sge', name: '雉｢閠・, nameEn: 'Sage', role: 'healer', icon: '/icons/Sage.png' },
    // Melee DPS
    { id: 'mnk', name: '繝｢繝ｳ繧ｯ', nameEn: 'Monk', role: 'dps', icon: '/icons/Monk.png' },
    { id: 'drg', name: '遶憺ｨ主｣ｫ', nameEn: 'Dragoon', role: 'dps', icon: '/icons/Dragoon.png' },
    { id: 'nin', name: '蠢崎・, nameEn: 'Ninja', role: 'dps', icon: '/icons/Ninja.png' },
    { id: 'sam', name: '萓・, nameEn: 'Samurai', role: 'dps', icon: '/icons/Samurai.png' },
    { id: 'rpr', name: '繝ｪ繝ｼ繝代・', nameEn: 'Reaper', role: 'dps', icon: '/icons/Reaper.png' },
    { id: 'vpr', name: '繝ｴ繧｡繧､繝代・', nameEn: 'Viper', role: 'dps', icon: '/icons/Viper.png' },
    // Physical Ranged DPS
    { id: 'brd', name: '蜷滄♀隧ｩ莠ｺ', nameEn: 'Bard', role: 'dps', icon: '/icons/Bard.png' },
    { id: 'mch', name: '讖溷ｷ･螢ｫ', nameEn: 'Machinist', role: 'dps', icon: '/icons/Machinist.png' },
    { id: 'dnc', name: '雕翫ｊ蟄・, nameEn: 'Dancer', role: 'dps', icon: '/icons/Dancer.png' },
    // Magical Ranged DPS
    { id: 'blm', name: '鮟帝ｭ秘％螢ｫ', nameEn: 'Black Mage', role: 'dps', icon: '/icons/BlackMage.png' },
    { id: 'smn', name: '蜿ｬ蝟壼｣ｫ', nameEn: 'Summoner', role: 'dps', icon: '/icons/Summoner.png' },
    { id: 'rdm', name: '襍､鬲秘％螢ｫ', nameEn: 'Red Mage', role: 'dps', icon: '/icons/RedMage.png' },
    { id: 'pct', name: '繝斐け繝医・繝ｳ繧ｵ繝ｼ', nameEn: 'Pictomancer', role: 'dps', icon: '/icons/Pictomancer.png' },
];

export const MITIGATIONS: Mitigation[] = [
    // --- Gunbreaker ---
    {
        id: "aurora", jobId: "gnb", name: "繧ｪ繝ｼ繝ｭ繝ｩ", nameEn: "Aurora", icon: "/icons/Aurora.png",
        cooldown: 60, duration: 18, type: "all", value: 0, isShield: false, scope: "self", family: "tank_sub_targeted"
    },
    {
        id: "camouflage", jobId: "gnb", name: "繧ｫ繝｢繝輔Λ繝ｼ繧ｸ繝･", nameEn: "Camouflage", icon: "/icons/Camouflage.png",
        cooldown: 90, duration: 20, type: "all", value: 10, isShield: false, scope: "self", family: "tank_sub_self"
    },
    {
        id: "great_nebula", jobId: "gnb", name: "繧ｰ繝ｬ繝ｼ繝医ロ繝薙Η繝ｩ", nameEn: "Great Nebula", icon: "/icons/Great_Nebula.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "heart_of_corundum", jobId: "gnb", name: "繝上・繝医・繧ｪ繝悶・繧ｳ繝ｩ繝ｳ繝繝", nameEn: "Heart of Corundum", icon: "/icons/Heart_of_Corundum.png",
        cooldown: 25, duration: 8, type: "all", value: 15, isShield: false,
        note: "譛蛻・遘・5%*15%, 谿九ｊ4遘・5・・, scope: "self", family: "tank_short"
    },
    {
        id: "heart_of_light", jobId: "gnb", name: "繝上・繝医・繧ｪ繝悶・繝ｩ繧､繝・, nameEn: "Heart of Light", icon: "/icons/Heart_of_Light.png",
        cooldown: 90, duration: 15, type: "all", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", family: "tank_party_miti"
    },
    {
        id: "superbolide", jobId: "gnb", name: "繝懊・繝ｩ繧､繝・, nameEn: "Superbolide", icon: "/icons/Superbolide.png",
        cooldown: 360, duration: 10, type: "all", value: 0, isShield: false, note: "HP貂帛ｰ醍┌隕・, scope: "self", isInvincible: true, family: "tank_invuln"
    },

    // --- Paladin ---
    {
        id: "bulwark", jobId: "pld", name: "繝悶Ν繝ｯ繝ｼ繧ｯ", nameEn: "Bulwark", icon: "/icons/Bulwark.png",
        cooldown: 90, duration: 10, type: "all", value: 20, isShield: false, note: "DOT繝繝｡繝ｼ繧ｸ縺ｯ霆ｽ貂帑ｸ榊庄", scope: "self", family: "tank_sub_self"
    },
    {
        id: "divine_veil", jobId: "pld", name: "繝・ぅ繝ｴ繧｡繧､繝ｳ繝ｴ繧ｧ繝ｼ繝ｫ", nameEn: "Divine Veil", icon: "/icons/Divine_Veil.png",
        cooldown: 90, duration: 30, type: "all", value: 0, isShield: true, scope: "party", family: "tank_party_miti"
    },
    {
        id: "guardian", jobId: "pld", name: "繧ｨ繧ｯ繧ｹ繝医Μ繝ｼ繝繧ｬ繝ｼ繝・, nameEn: "Guardian", icon: "/icons/Guardian.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "hallowed_ground", jobId: "pld", name: "繧､繝ｳ繝薙Φ繧ｷ繝悶Ν", nameEn: "Hallowed Ground", icon: "/icons/Hallowed_Ground.png",
        cooldown: 420, duration: 10, type: "all", value: 0, isShield: false, scope: "self", isInvincible: true, family: "tank_invuln"
    },
    {
        id: "holy_sheltron", jobId: "pld", name: "繝帙・繝ｪ繝ｼ繧ｷ繧ｧ繝ｫ繝医Ο繝ｳ", nameEn: "Holy Sheltron", icon: "/icons/Holy_Sheltron.png",
        cooldown: 23, duration: 8, type: "all", value: 15, isShield: false,
        note: "譛蛻・遘・5%*15%, 谿九ｊ4遘・5・・, scope: "self", family: "tank_short"
    },
    {
        id: "intervention", jobId: "pld", name: "繧､繝ｳ繧ｿ繝ｼ繝吶Φ繧ｷ繝ｧ繝ｳ", nameEn: "Intervention", icon: "/icons/Intervention.png",
        cooldown: 23, duration: 8, type: "all", value: 10, isShield: false,
        note: "譛蛻・遘・0%*10%, 谿九ｊ4遘・0・・, scope: "self", family: "tank_sub_targeted"
    },
    {
        id: "passage_of_arms", jobId: "pld", name: "繝代ャ繧ｻ繝ｼ繧ｸ繝ｻ繧ｪ繝悶・繧｢繝ｼ繝繧ｺ", nameEn: "Passage of Arms", icon: "/icons/Passage_of_Arms.png",
        cooldown: 120, duration: 5, type: "all", value: 15, isShield: false, scope: "party", family: "tank_party_miti_sub"
    },

    // --- Pictomancer ---
    {
        id: "tempera_grassa", jobId: "pct", name: "繝・Φ繝壹Λ繧ｰ繝ｩ繝・し", nameEn: "Tempera Grassa", icon: "/icons/Tempera_Grassa.png",
        cooldown: 90, duration: 10, type: "all", value: 0, isShield: true, family: "caster_personal_shield"
    },

    // --- Monk ---
    {
        id: "mantra", jobId: "mnk", name: "繝槭Φ繝医Λ", nameEn: "Mantra", icon: "/icons/Mantra.png",
        cooldown: 90, duration: 15, type: "all", value: 0, isShield: false, note: "蝗槫ｾｩ蜉ｹ譫・0%荳頑・", healingIncrease: 10, family: "melee_heal_up"
    },

    // --- Dark Knight ---
    {
        id: "dark_mind", jobId: "drk", name: "繝繝ｼ繧ｯ繝槭う繝ｳ繝・, nameEn: "Dark Mind", icon: "/icons/Dark_Mind.png",
        cooldown: 60, duration: 10, type: "magical", value: 20, isShield: false,
        valueMagical: 20, valuePhysical: 10, scope: "self", family: "tank_sub_self"
    },
    {
        id: "dark_missionary", jobId: "drk", name: "繝繝ｼ繧ｯ繝溘ャ繧ｷ繝ｧ繝翫Μ繝ｼ", nameEn: "Dark Missionary", icon: "/icons/Dark_Missionary.png",
        cooldown: 90, duration: 15, type: "magical", value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party", family: "tank_party_miti"
    },
    {
        id: "living_dead", jobId: "drk", name: "繝ｪ繝薙Φ繧ｰ繝・ャ繝・, nameEn: "Living Dead", icon: "/icons/Living_Dead.png",
        cooldown: 300, duration: 10, type: "all", value: 0, isShield: false, note: "HP貂帛ｰ醍┌隕・, scope: "self", isInvincible: true, family: "tank_invuln"
    },
    {
        id: "oblation", jobId: "drk", name: "繧ｪ繝悶Ξ繝ｼ繧ｷ繝ｧ繝ｳ", nameEn: "Oblation", icon: "/icons/Oblation.png",
        cooldown: 60, duration: 10, type: "all", value: 10, isShield: false, scope: "self", maxCharges: 2, family: "tank_sub_targeted"
    },
    {
        id: "shadowed_vigil", jobId: "drk", name: "繧ｷ繝｣繝峨え繝ｴ繧｣繧ｸ繝ｫ", nameEn: "Shadowed Vigil", icon: "/icons/Shadowed_Vigil.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "the_blackest_night", jobId: "drk", name: "繝悶Λ繝・け繝翫う繝・, nameEn: "The Blackest Night", icon: "/icons/The_Blackest_Night.png",
        cooldown: 15, duration: 7, type: "all", value: 0, isShield: true, scope: "self", family: "tank_short"
    },

    // --- Scholar ---
    {
        id: "accession", jobId: "sch", name: "繧｢繧ｯ繧ｻ繝・す繝ｧ繝ｳ", nameEn: "Accession", icon: "/icons/Accession.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, requires: "seraphism", family: "healer_gcd_shield"
    },
    {
        id: "concitation", jobId: "sch", name: "諢乗ｰ苓ｻ帝ｫ倥・遲・, nameEn: "Concitation", icon: "/icons/Concitation.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, family: "healer_gcd_shield"
    },
    {
        id: "consolation", jobId: "sch", name: "繧ｳ繝ｳ繧ｽ繝ｬ繧､繧ｷ繝ｧ繝ｳ", nameEn: "Consolation", icon: "/icons/Consolation.png",
        cooldown: 1, duration: 30, type: "all", value: 0, isShield: true, requires: "summon_seraph", maxCharges: 2, family: "bh_sub_a"
    },
    {
        id: "adloquium", jobId: "sch", name: "鮠楢・豼蜉ｱ縺ｮ遲・, nameEn: "Adloquium", icon: "/icons/Adloquium.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, family: "healer_gcd_target_shield"
    },
    {
        id: "recitation_deployment_tactics", jobId: "sch", name: "遘倡ｭ厄ｼ壼ｱ暮幕謌ｦ陦・, nameEn: "Recitation Deployment Tactics", icon: "/icons/Deployment_Tactics.png",
        cooldown: 90, duration: 30, type: "all", value: 0, isShield: true, note: "遒ｺ螳壹け繝ｪ繝・ぅ繧ｫ繝ｫ", family: "bh_90_shield"
    },

    {
        id: "dissipation", jobId: "sch", name: "霆｢蛹・, nameEn: "Dissipation", icon: "/icons/Dissipation.png",
        cooldown: 180, duration: 30, type: "all", value: 0, isShield: false, healingIncrease: 20, family: "sch_dissipation"
    },
    {
        id: "expedient", jobId: "sch", name: "逍ｾ鬚ｨ諤呈ｿ､縺ｮ險・, nameEn: "Expedient", icon: "/icons/Expedient.png",
        cooldown: 120, duration: 20, type: "all", value: 10, isShield: false, family: "bh_120_b"
    },
    {
        id: "fey_illumination", jobId: "sch", name: "繝輔ぉ繧､繧､繝ｫ繝溘ロ繝ｼ繧ｷ繝ｧ繝ｳ", nameEn: "Fey Illumination", icon: "/icons/Fey_Illumination.png",
        cooldown: 120, duration: 20, type: "magical", value: 5, isShield: false,
        note: "陲ｫ鬲疲ｳ・%霆ｽ貂・ 蝗槫ｾｩ蜉ｹ譫・0%荳頑・", healingIncrease: 10, family: "bh_sub_a"
    },
    {
        id: "sacred_soil", jobId: "sch", name: "驥取姶豐ｻ逋ゅ・髯｣", nameEn: "Sacred Soil", icon: "/icons/Sacred_Soil.png",
        cooldown: 30, duration: 17, type: "all", value: 10, isShield: false, resourceCost: { type: 'aetherflow', amount: 1 }, family: "healer_bubble"
    },
    {
        id: "seraphism", jobId: "sch", name: "繧ｻ繝ｩ繝輔ぅ繧ｺ繝", nameEn: "Seraphism", icon: "/icons/Seraphism.png",
        cooldown: 180, duration: 20, type: "all", value: 0, isShield: false, family: "bh_180_big"
    },
    {
        id: "summon_seraph", jobId: "sch", name: "繧ｵ繝｢繝ｳ繝ｻ繧ｻ繝ｩ繝輔ぅ繝", nameEn: "Summon Seraph", icon: "/icons/Summon_Seraph.png",
        cooldown: 120, duration: 22, type: "all", value: 0, isShield: false, family: "bh_120_a"
    },

    // --- Machinist ---
    {
        id: "dismantle", jobId: "mch", name: "繧ｦ繧ｧ繝昴Φ繝悶Ξ繧､繧ｯ", nameEn: "Dismantle", icon: "/icons/Dismantle.png",
        cooldown: 120, duration: 10, type: "all", value: 10, isShield: false, family: "ranged_target_10"
    },
    {
        id: "tactician", jobId: "mch", name: "繧ｿ繧ｯ繝・ぅ繧ｷ繝｣繝ｳ", nameEn: "Tactician", icon: "/icons/Tactician.png",
        cooldown: 90, duration: 15, type: "all", value: 15, isShield: false, family: "ranged_party_15"
    },

    // --- Bard ---
    {
        id: "nature_s_minne", jobId: "brd", name: "蝨ｰ逾槭・繝溘Φ繝・, nameEn: "Nature's Minne", icon: "/icons/Nature's_Minne.png",
        cooldown: 120, duration: 15, type: "all", value: 0, isShield: false, note: "蝗槫ｾｩ蜉ｹ譫・5%荳頑・", healingIncrease: 15, family: "ranged_heal_up"
    },
    {
        id: "troubadour", jobId: "brd", name: "繝医Ν繝舌ラ繧･繝ｼ繝ｫ", nameEn: "Troubadour", icon: "/icons/Troubadour.png",
        cooldown: 90, duration: 15, type: "all", value: 15, isShield: false, family: "ranged_party_15"
    },

    // --- Sage ---
    {
        id: "eukrasian_prognosis_ii", jobId: "sge", name: "繧ｨ繧ｦ繧ｯ繝ｩ繧ｷ繧｢繝ｻ繝励Ο繧ｰ繝弱す繧ｹII", nameEn: "Eukrasian Prognosis II", icon: "/icons/Eukrasian_Prognosis_II.png",
        cooldown: 2.5, duration: 30, type: "all", value: 0, isShield: true, family: "healer_gcd_shield"
    },
    {
        id: "holos", jobId: "sge", name: "繝帙・繝ｪ繧ｺ繝", nameEn: "Holos", icon: "/icons/Holos.png",
        cooldown: 120, duration: 20, type: "all", value: 10, isShield: true, family: "bh_120_b"
    },
    {
        id: "kerachole", jobId: "sge", name: "繧ｱ繝ｼ繝ｩ繧ｳ繝ｬ", nameEn: "Kerachole", icon: "/icons/Kerachole.png",
        cooldown: 30, duration: 15, type: "all", value: 10, isShield: false, resourceCost: { type: 'addersgall', amount: 1 }, family: "healer_bubble"
    },
    {
        id: "panhaima", jobId: "sge", name: "繝代Φ繝上う繝・, nameEn: "Panhaima", icon: "/icons/Panhaima.png",
        cooldown: 120, duration: 15, type: "all", value: 0, isShield: true, family: "bh_120_a"
    },
    {
        id: "philosophia", jobId: "sge", name: "繝輔ぅ繝ｭ繧ｽ繝輔ぅ繧｢", nameEn: "Philosophia", icon: "/icons/Philosophia.png",
        cooldown: 180, duration: 20, type: "all", value: 0, isShield: false, family: "bh_180_big"
    },

    // --- Red Mage ---
    {
        id: "magick_barrier", jobId: "rdm", name: "繝舌・繧ｸ繧ｯ", nameEn: "Magick Barrier", icon: "/icons/Magick_Barrier.png",
        cooldown: 120, duration: 10, type: "magical", value: 10, isShield: false,
        note: "陲ｫ鬲疲ｳ・0%霆ｽ貂・ 蝗槫ｾｩ蜉ｹ譫・%荳頑・", valueMagical: 10, valuePhysical: 0, healingIncrease: 5, family: "caster_party_miti"
    },

    // --- Astrologian ---
    {
        id: "collective_unconscious", jobId: "ast", name: "驕句多縺ｮ霈ｪ", nameEn: "Collective Unconscious", icon: "/icons/Collective_Unconscious.png",
        cooldown: 60, duration: 10, type: "all", value: 10, isShield: false, family: "ph_60_aoe"
    },
    {
        id: "helios_conjunction", jobId: "ast", name: "繧ｳ繝ｳ繧ｸ繝｣繝ｳ繧ｯ繧ｷ繝ｧ繝ｳ繝ｻ繝倥Μ繧ｪ繧ｹ", nameEn: "Helios Conjunction", icon: "/icons/Helios_Conjunction.png",
        cooldown: 2.5, duration: 15, type: "all", value: 0, isShield: false, note: "繝九Η繝ｼ繝医Λ繝ｫ繧ｻ繧ｯ繝井ｸｭ縺ｮ縺ｿ繝舌Μ繧｢", requires: "neutral_sect", family: "healer_gcd_shield"
    },
    {
        id: "macrocosmos", jobId: "ast", name: "繝槭け繝ｭ繧ｳ繧ｹ繝｢繧ｹ", nameEn: "Macrocosmos", icon: "/icons/Macrocosmos.png",
        cooldown: 180, duration: 15, type: "all", value: 0, isShield: false, family: "ph_180_big"
    },
    {
        id: "neutral_sect", jobId: "ast", name: "繝九Η繝ｼ繝医Λ繝ｫ繧ｻ繧ｯ繝・, nameEn: "Neutral Sect", icon: "/icons/Neutral_Sect.png",
        cooldown: 120, duration: 20, type: "all", value: 0, isShield: false, healingIncrease: 20, family: "ph_120_aoe"
    },
    {
        id: "sun_sign", jobId: "ast", name: "繧ｵ繝ｳ繧ｵ繧､繝ｳ", nameEn: "Sun Sign", icon: "/icons/Sun_Sign.png",
        cooldown: 1, duration: 15, type: "all", value: 10, isShield: false, requires: "neutral_sect", maxCharges: 1, family: "ph_sub_120"
    },

    // --- Warrior ---
    {
        id: "bloodwhetting", jobId: "war", name: "蜴溷・縺ｮ陦豌・, nameEn: "Bloodwhetting", icon: "/icons/Bloodwhetting.png",
        cooldown: 25, duration: 8, type: "all", value: 20, isShield: true,
        note: "譛蛻・遘・0%*10%, 谿九ｊ4遘・0・・, scope: "self", family: "tank_short"
    },
    {
        id: "damnation", jobId: "war", name: "繝繝繝阪・繧ｷ繝ｧ繝ｳ", nameEn: "Damnation", icon: "/icons/Damnation.png",
        cooldown: 120, duration: 15, type: "all", value: 40, isShield: false, scope: "self", family: "tank_40"
    },
    {
        id: "holmgang", jobId: "war", name: "繝帙Ν繝繧ｮ繝｣繝ｳ繧ｰ", nameEn: "Holmgang", icon: "/icons/Holmgang.png",
        cooldown: 240, duration: 10, type: "all", value: 0, isShield: false, note: "HP貂帛ｰ醍┌隕・, scope: "self", isInvincible: true, family: "tank_invuln"
    },
    {
        id: "nascent_flash", jobId: "war", name: "蜴溷・縺ｮ迪帙ｊ", nameEn: "Nascent Flash", icon: "/icons/Nascent_Flash.png",
        cooldown: 25, duration: 8, type: "all", value: 20, isShield: true,
        note: "譛蛻・遘・0%*10%, 谿九ｊ4遘・0・・, scope: "self", family: "tank_sub_targeted"
    },
    {
        id: "shake_it_off", jobId: "war", name: "繧ｷ繧ｧ繧､繧ｯ繧ｪ繝・, nameEn: "Shake It Off", icon: "/icons/Shake_It_Off.png",
        cooldown: 90, duration: 30, type: "all", value: 0, isShield: true, scope: "party", family: "tank_party_miti"
    },
    {
        id: "thrill_of_battle", jobId: "war", name: "繧ｹ繝ｪ繝ｫ繝ｻ繧ｪ繝悶・繝舌ヨ繝ｫ", nameEn: "Thrill of Battle", icon: "/icons/Thrill_of_Battle.png",
        cooldown: 90, duration: 10, type: "all", value: 0, isShield: false, scope: "self", family: "tank_sub_self"
    },

    // --- White Mage ---
    {
        id: "divine_caress", jobId: "whm", name: "繝・ぅ繝ｴ繧｡繧､繝ｳ繧ｫ繝ｬ繧ｹ", nameEn: "Divine Caress", icon: "/icons/Divine_Caress.png",
        cooldown: 1, duration: 10, type: "all", value: 0, isShield: true, requires: "temperance", family: "ph_sub_120"
    },
    {
        id: "plenary_indulgence", jobId: "whm", name: "繧､繝ｳ繝峨ぇ繝ｫ繧ｲ繝ｳ繝・ぅ繧｢", nameEn: "Plenary Indulgence", icon: "/icons/Plenary_Indulgence.png",
        cooldown: 60, duration: 10, type: "all", value: 0, isShield: false, family: "ph_60_aoe"
    },
    {
        id: "temperance", jobId: "whm", name: "繝・Φ繝代Λ繝ｳ繧ｹ", nameEn: "Temperance", icon: "/icons/Temperance.png",
        cooldown: 120, duration: 20, type: "all", value: 10, isShield: false, family: "ph_120_aoe"
    },

    // --- Dancer ---
    {
        id: "improvisation", jobId: "dnc", name: "繧､繝ｳ繝励Ο繝薙ぞ繝ｼ繧ｷ繝ｧ繝ｳ", nameEn: "Improvisation", icon: "/icons/Improvisation.png",
        cooldown: 120, duration: 30, type: "all", value: 0, isShield: true, note: "譛螟ｧHP縺ｮ5-10%繝舌Μ繧｢", family: "ranged_party_heal"
    },
    {
        id: "shield_samba", jobId: "dnc", name: "螳医ｊ縺ｮ繧ｵ繝ｳ繝・, nameEn: "Shield Samba", icon: "/icons/Shield_Samba.png",
        cooldown: 90, duration: 15, type: "all", value: 15, isShield: false, family: "ranged_party_15"
    },

    // --- Role Actions ---
    // Rampart (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `rampart_${job}`, jobId: job, name: "繝ｩ繝ｳ繝代・繝・, nameEn: "Rampart", icon: "/icons/Rampart.png",
        cooldown: 90, duration: 20, type: "all" as const, value: 20, isShield: false, scope: "self" as const, family: "role_action"
    })),
    // Reprisal (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_${job}`, jobId: job, name: "繝ｪ繝励Λ繧､繧ｶ繝ｫ", nameEn: "Reprisal", icon: "/icons/Reprisal.png",
        cooldown: 60, duration: 15, type: "all" as const, value: 10, isShield: false, scope: "party" as const, family: "role_action"
    })),
    // Addle (Casters: blm, smn, rdm, pct)
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_${job}`, jobId: job, name: "繧｢繝峨Ν", nameEn: "Addle", icon: "/icons/Addle.png",
        cooldown: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, family: "role_action"
    })),
    // Feint (Melee: mnk, drg, nin, sam, rpr, vpr)
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_${job}`, jobId: job, name: "迚ｽ蛻ｶ", nameEn: "Feint", icon: "/icons/Feint.png",
        cooldown: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, family: "role_action"
    })),
];
