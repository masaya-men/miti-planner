import type { Job, Mitigation } from '../types';

export const MITIGATION_DISPLAY_ORDER = [
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
    'divine_benison',
    'aquaveil',
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
    'whispering_dawn',
    'fey_blessing',
    'indomitability',
    'aetherpact',
    'collective_unconscious',
    'neutral_sect',
    'sun_sign',
    'helios_conjunction_base',
    'helios_conjunction',
    'macrocosmos',
    'earthly_star',
    'horoscope',
    'celestial_intersection',
    'exaltation',
    'kerachole',
    'holos',
    'panhaima',
    'philosophia',
    'physis_base',
    'physis',
    'ixochole',
    'haima',
    'pneuma',
    'feint_base',
    'feint',
    'mantra',
    'riddle_of_earth',
    'earths_reply',
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
    'rampart',
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
    { id: 'pld', name: { ja: 'ナイト', en: 'Paladin', zh: '骑士', ko: '나이트' }, role: 'tank', icon: '/icons/Paladin.png' },
    { id: 'war', name: { ja: '戦士', en: 'Warrior', zh: '战士', ko: '전사' }, role: 'tank', icon: '/icons/Warrior.png' },
    { id: 'drk', name: { ja: '暗黒騎士', en: 'Dark Knight', zh: '暗黑骑士', ko: '암흑기사' }, role: 'tank', icon: '/icons/DarkKnight.png' },
    { id: 'gnb', name: { ja: 'ガンブレイカー', en: 'Gunbreaker', zh: '绝枪战士', ko: '건브레이커' }, role: 'tank', icon: '/icons/Gunbreaker.png' },
    // Healers
    { id: 'whm', name: { ja: '白魔道士', en: 'White Mage', zh: '白魔法师', ko: '백마도사' }, role: 'healer', icon: '/icons/WhiteMage.png' },
    { id: 'sch', name: { ja: '学者', en: 'Scholar', zh: '学者', ko: '학자' }, role: 'healer', icon: '/icons/Scholar.png' },
    { id: 'ast', name: { ja: '占星術師', en: 'Astrologian', zh: '占星术士', ko: '점성술사' }, role: 'healer', icon: '/icons/Astrologian.png' },
    { id: 'sge', name: { ja: '賢者', en: 'Sage', zh: '贤者', ko: '현자' }, role: 'healer', icon: '/icons/Sage.png' },
    // Melee DPS
    { id: 'mnk', name: { ja: 'モンク', en: 'Monk', zh: '武僧', ko: '몽크' }, role: 'dps', icon: '/icons/Monk.png' },
    { id: 'drg', name: { ja: '竜騎士', en: 'Dragoon', zh: '龙骑士', ko: '용기사' }, role: 'dps', icon: '/icons/Dragoon.png' },
    { id: 'nin', name: { ja: '忍者', en: 'Ninja', zh: '忍者', ko: '닌자' }, role: 'dps', icon: '/icons/Ninja.png' },
    { id: 'sam', name: { ja: '侍', en: 'Samurai', zh: '武士', ko: '사무라이' }, role: 'dps', icon: '/icons/Samurai.png' },
    { id: 'rpr', name: { ja: 'リーパー', en: 'Reaper', zh: '钐镰客', ko: '리퍼' }, role: 'dps', icon: '/icons/Reaper.png' },
    { id: 'vpr', name: { ja: 'ヴァイパー', en: 'Viper', zh: '蝰蛇剑士', ko: '바이퍼' }, role: 'dps', icon: '/icons/Viper.png' },
    // Physical Ranged DPS
    { id: 'brd', name: { ja: '吟遊詩人', en: 'Bard', zh: '吟游诗人', ko: '음유시인' }, role: 'dps', icon: '/icons/Bard.png' },
    { id: 'mch', name: { ja: '機工士', en: 'Machinist', zh: '机工士', ko: '기공사' }, role: 'dps', icon: '/icons/Machinist.png' },
    { id: 'dnc', name: { ja: '踊り子', en: 'Dancer', zh: '舞者', ko: '무도가' }, role: 'dps', icon: '/icons/Dancer.png' },
    // Magical Ranged DPS
    { id: 'blm', name: { ja: '黒魔道士', en: 'Black Mage', zh: '黑魔法师', ko: '흑마도사' }, role: 'dps', icon: '/icons/BlackMage.png' },
    { id: 'smn', name: { ja: '召喚士', en: 'Summoner', zh: '召唤师', ko: '소환사' }, role: 'dps', icon: '/icons/Summoner.png' },
    { id: 'rdm', name: { ja: '赤魔道士', en: 'Red Mage', zh: '赤魔法师', ko: '적마도사' }, role: 'dps', icon: '/icons/RedMage.png' },
    { id: 'pct', name: { ja: 'ピクトマンサー', en: 'Pictomancer', zh: '绘灵法师', ko: '픽토맨서' }, role: 'dps', icon: '/icons/Pictomancer.png' },
];

export const MITIGATIONS: Mitigation[] = [
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
        valueMagical: 10, valuePhysical: 5, scope: "party", minLevel: 80, family: "tank_party_miti"
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
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", scope: "party", minLevel: 56, family: "tank_party_miti"
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
        recast: 23, duration: 8, type: "all", value: 15, burstValue: 15, burstDuration: 4, isShield: false,
        note: "最初4秒15%*15%, 残り4秒15％", scope: "self", minLevel: 82, family: "tank_short"
    },
    {
        id: "sheltron", jobId: "pld", name: { ja: "シェルトロン", en: "Sheltron", zh: "盾阵", ko: "방벽" }, icon: "/icons/Holy_Sheltron.png",
        recast: 23, duration: 6, type: "all", value: 15, isShield: false,
        scope: "self", minLevel: 35, maxLevel: 81, family: "tank_short"
    },
    {
        id: "intervention", jobId: "pld", name: { ja: "インターベンション", en: "Intervention", zh: "干预", ko: "중재" }, icon: "/icons/Intervention.png",
        recast: 23, duration: 8, type: "all", value: 10, burstValue: 10, burstDuration: 4, isShield: false,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "target", minLevel: 82, family: "tank_sub_targeted", targetCannotBeSelf: true
    },
    {
        id: "intervention_base", jobId: "pld", name: { ja: "インターベンション", en: "Intervention", zh: "干预", ko: "중재" }, icon: "/icons/Intervention.png",
        recast: 23, duration: 6, type: "all", value: 10, isShield: false,
        scope: "target", minLevel: 62, maxLevel: 81, family: "tank_sub_targeted", targetCannotBeSelf: true
    },
    {
        id: "passage_of_arms", jobId: "pld", name: { ja: "パッセージ・オブ・アームズ", en: "Passage of Arms", zh: "武装戍卫", ko: "결연한 수호자" }, icon: "/icons/Passage_of_Arms.png",
        recast: 120, duration: 5, type: "all", value: 15, isShield: false, scope: "party", minLevel: 70, family: "tank_party_miti_sub"
    },

    // --- Pictomancer ---
    {
        id: "tempera_grassa", jobId: "pct", name: { ja: "テンペラグラッサ", en: "Tempera Grassa", zh: "油性坦培拉涂层", ko: "무지개 빛방울" }, icon: "/icons/Tempera_Grassa.png",
        recast: 90, duration: 10, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", minLevel: 88, family: "caster_personal_shield"
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
        id: "earths_reply", jobId: "mnk", name: { ja: "金剛周天", en: "Earth's Reply", zh: "金刚周天", ko: "금강주천" }, icon: "/icons/Earth's_Reply.png",
        recast: 1, duration: 1, type: "all", value: 0, isShield: false, scope: "party", minLevel: 64, requires: "riddle_of_earth", requiresWindow: 30
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
        valueMagical: 10, valuePhysical: 5, scope: "party", minLevel: 76, family: "tank_party_miti"
    },
    {
        id: "oblation", jobId: "drk", name: { ja: "オブレーション", en: "Oblation", zh: "献奉", ko: "헌신" }, icon: "/icons/Oblation.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, scope: "target", maxCharges: 2, minLevel: 82, family: "tank_sub_targeted"
    },
    {
        id: "the_blackest_night", jobId: "drk", name: { ja: "ブラックナイト", en: "The Blackest Night", zh: "至黑之夜", ko: "흑야" }, icon: "/icons/The_Blackest_Night.png",
        recast: 15, duration: 7, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "25% HP", scope: "target", minLevel: 70, family: "tank_short"
    },
    {
        id: "living_dead", jobId: "drk", name: { ja: "リビングデッド", en: "Living Dead", zh: "行尸走肉", ko: "산송장" }, icon: "/icons/Living_Dead.png",
        recast: 300, duration: 10, type: "all", value: 0, isShield: false, scope: "self", isInvincible: true, minLevel: 50, family: "tank_invuln"
    },

    // --- Scholar ---
    {
        id: "accession", jobId: "sch", name: { ja: "アクセッション", en: "Accession", zh: "降临之章", ko: "강림" }, icon: "/icons/Accession.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 100, requires: "seraphism", minLevel: 100, family: "healer_gcd_shield"
    },
    {
        id: "concitation", jobId: "sch", name: { ja: "意気軒高の策", en: "Concitation", zh: "意气轩昂之策", ko: "의기왕성책" }, icon: "/icons/Concitation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 360, minLevel: 92, family: "succor"
    },
    {
        id: "succor", jobId: "sch", name: { ja: "士気高揚の策", en: "Succor", zh: "士气高扬之策", ko: "사기고양책" }, icon: "/icons/Concitation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 320, maxLevel: 91, family: "succor"
    },
    {
        id: "consolation", jobId: "sch", name: { ja: "コンソレイション", en: "Consolation", zh: "慰藉", ko: "위안" }, icon: "/icons/Consolation.png",
        recast: 1, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 250, requires: "summon_seraph", maxCharges: 2, minLevel: 80, family: "bh_sub_a", requiresFairy: true
    },
    {
        id: "adloquium", jobId: "sch", name: { ja: "鼓舞激励の策", en: "Adloquium", zh: "鼓舞激励之策", ko: "고무격려책" }, icon: "/icons/Adloquium.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, scope: "target", hidden: true, minLevel: 30, family: "healer_gcd_target_shield"
    },
    {
        id: "recitation_deployment_tactics", jobId: "sch", name: { ja: "秘策：展開戦術", en: "Recitation Deployment Tactics", zh: "秘策·展开战术", ko: "비책: 전개전술" }, icon: "/icons/Deployment_Tactics.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, note: "確定クリティカル", family: "bh_90_shield"
    },

    {
        id: "dissipation", jobId: "sch", name: { ja: "転化", en: "Dissipation", zh: "转化", ko: "에테르 전환" }, icon: "/icons/Dissipation.png",
        recast: 180, duration: 30, type: "all", value: 0, isShield: false, healingIncrease: 20, healingIncreaseSelfOnly: true, minLevel: 60, family: "sch_dissipation"
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
        recast: 30, duration: 17, type: "all", value: 10, isShield: false, resourceCost: { type: 'aetherflow', amount: 1 }, minLevel: 45, family: "healer_bubble"
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

    // --- Machinist ---
    {
        id: "dismantle", jobId: "mch", name: { ja: "ウェポンブレイク", en: "Dismantle", zh: "武装解除", ko: "무기 파괴" }, icon: "/icons/Dismantle.png",
        recast: 120, duration: 10, type: "all", value: 10, isShield: false, minLevel: 62, family: "ranged_target_10"
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
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 360, minLevel: 96, family: "healer_gcd_shield"
    },
    {
        id: "eukrasian_prognosis", jobId: "sge", name: { ja: "エウクラシア・プログノシス", en: "Eukrasian Prognosis", zh: "均衡预后", ko: "정상건강: 예후" }, icon: "/icons/Eukrasian_Prognosis_II.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 320, maxLevel: 95, family: "healer_gcd_shield"
    },
    {
        id: "holos", jobId: "sge", name: { ja: "ホーリズム", en: "Holos", zh: "整体论", ko: "전체론" }, icon: "/icons/Holos.png",
        recast: 120, duration: 20, type: "all", value: 10, isShield: true, valueType: 'potency', shieldPotency: 300, minLevel: 86, family: "bh_120_b"
    },
    {
        id: "kerachole", jobId: "sge", name: { ja: "ケーラコレ", en: "Kerachole", zh: "坚角清汁", ko: "케이라콜레" }, icon: "/icons/Kerachole.png",
        recast: 30, duration: 15, type: "all", value: 10, isShield: false, resourceCost: { type: 'addersgall', amount: 1 }, minLevel: 50, family: "healer_bubble"
    },
    {
        id: "panhaima", jobId: "sge", name: { ja: "パンハイマ", en: "Panhaima", zh: "泛输血", ko: "온혈액" }, icon: "/icons/Panhaima.png",
        recast: 120, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 200,
        stacks: 5, reapplyOnAbsorption: true, onExpiryHealingPotency: 100, minLevel: 80, family: "bh_120_a"
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
        stacks: 5, reapplyOnAbsorption: true, onExpiryHealingPotency: 150, note: "300x(1+5)回分", scope: "target", minLevel: 70, family: "bh_sub_c"
    },
    {
        id: "pneuma", jobId: "sge", name: { ja: "プネウマ", en: "Pneuma", zh: "魂灵风息", ko: "프네우마" }, icon: "/icons/Pneuma.png",
        recast: 120, duration: 1, type: "all", value: 0, isShield: false, note: "リキャスト管理のみ", minLevel: 90, family: "bh_target_shield"
    },
    {
        id: "eukrasian_diagnosis", jobId: "sge", name: { ja: "エウクラシア・ディアグノシス", en: "Eukrasian Diagnosis", zh: "均衡诊断", ko: "정상건강: 진단치료" }, icon: "/icons/Eukrasian_Diagnosis.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, scope: "target", hidden: true, minLevel: 30, family: "healer_gcd_target_shield"
    },

    // --- Red Mage ---
    {
        id: "magick_barrier", jobId: "rdm", name: { ja: "バマジク", en: "Magick Barrier", zh: "抗死", ko: "바매직" }, icon: "/icons/Magick_Barrier.png",
        recast: 120, duration: 10, type: "all", value: 10, isShield: false,
        note: "被魔法10%軽減, 回復効果5%上昇", valueMagical: 10, valuePhysical: 0, healingIncrease: 5, minLevel: 86, family: "caster_party_miti"
    },

    // --- Astrologian ---
    {
        id: "collective_unconscious", jobId: "ast", name: { ja: "運命の輪", en: "Collective Unconscious", zh: "命运之轮", ko: "운명의 수레바퀴" }, icon: "/icons/Collective_Unconscious.png",
        recast: 60, duration: 10, type: "all", value: 10, isShield: false, minLevel: 58, family: "ph_60_aoe"
    },
    {
        id: "helios_conjunction", jobId: "ast", name: { ja: "コンジャンクション・ヘリオス", en: "Helios Conjunction", zh: "阳星合相", ko: "회합: 헬리오스" }, icon: "/icons/Helios_Conjunction.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 312.5, note: "ニュートラルセクト中のみバリア", requires: "neutral_sect", minLevel: 96, family: "healer_gcd_shield"
    },
    {
        id: "aspected_helios", jobId: "ast", name: { ja: "アスペクト・ヘリオス", en: "Aspected Helios", zh: "阳星相位", ko: "별읽기: 헬리오스" }, icon: "/icons/Helios_Conjunction.png",
        recast: 2.5, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 312.5, note: "ニュートラルセクト中のみバリア", requires: "neutral_sect", maxLevel: 95, family: "healer_gcd_shield"
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
        recast: 1, duration: 15, type: "all", value: 10, isShield: false, requires: "neutral_sect", maxCharges: 1, minLevel: 100, family: "ph_sub_120"
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
        id: "celestial_intersection", jobId: "ast", name: { ja: "星天交差", en: "Celestial Intersection", zh: "天星交错", ko: "천궁의 교차" }, icon: "/icons/Celestial_Intersection.png",
        recast: 30, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 400, scope: "target", maxCharges: 2, minLevel: 74, family: "ph_target_shield"
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
        note: "最初4秒10%*10%, 残り4秒10％", scope: "self", minLevel: 82, family: "tank_short"
    },
    {
        id: "raw_intuition", jobId: "war", name: { ja: "原初の直感", en: "Raw Intuition", zh: "原初的直觉", ko: "원초의 직감" }, icon: "/icons/Bloodwhetting.png",
        recast: 25, duration: 6, type: "all", value: 10, isShield: false,
        scope: "self", minLevel: 56, maxLevel: 81, family: "tank_short"
    },
    {
        id: "nascent_flash", jobId: "war", name: { ja: "原初の猛り", en: "Nascent Flash", zh: "原初的勇猛", ko: "원초의 분노" }, icon: "/icons/Nascent_Flash.png",
        recast: 25, duration: 8, type: "all", value: 10, burstValue: 10, burstDuration: 4, isShield: true, valueType: 'potency', shieldPotency: 400,
        note: "最初4秒10%*10%, 残り4秒10％", scope: "target", minLevel: 82, family: "tank_sub_targeted", targetCannotBeSelf: true
    },
    {
        id: "nascent_flash_base", jobId: "war", name: { ja: "原初の猛り", en: "Nascent Flash", zh: "原初的勇猛", ko: "원초의 분노" }, icon: "/icons/Nascent_Flash.png",
        recast: 25, duration: 6, type: "all", value: 10, isShield: false,
        scope: "target", minLevel: 76, maxLevel: 81, family: "tank_sub_targeted", targetCannotBeSelf: true
    },
    {
        id: "shake_it_off", jobId: "war", name: { ja: "シェイクオフ", en: "Shake It Off", zh: "摆脱", ko: "뿌리치기" }, icon: "/icons/Shake_It_Off.png",
        recast: 90, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "15% HP", scope: "party", minLevel: 68, family: "tank_party_miti"
    },
    {
        id: "holmgang", jobId: "war", name: { ja: "ホルムギャング", en: "Holmgang", zh: "死斗", ko: "일대일 결투" }, icon: "/icons/Holmgang.png",
        recast: 240, duration: 10, type: "all", value: 0, isShield: false, note: "HP1以下にならない", scope: "self", isInvincible: true, minLevel: 42, family: "tank_invuln"
    },
    {
        id: "thrill_of_battle", jobId: "war", name: { ja: "スリル・オブ・バトル", en: "Thrill of Battle", zh: "战栗", ko: "광폭화" }, icon: "/icons/Thrill_of_Battle.png",
        recast: 90, duration: 10, type: "all", value: 0, isShield: false, scope: "self", minLevel: 30, family: "tank_sub_self"
    },

    // --- White Mage ---
    {
        id: "divine_caress", jobId: "whm", name: { ja: "ディヴァインカレス", en: "Divine Caress", zh: "神爱抚", ko: "만상투기" }, icon: "/icons/Divine_Caress.png",
        recast: 1, duration: 10, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 400, requires: "temperance", minLevel: 100, family: "ph_sub_120"
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
        id: "aquaveil", jobId: "whm", name: { ja: "アクアヴェール", en: "Aquaveil", zh: "水流幕", ko: "물의 장막" }, icon: "/icons/Aquaveil.png",
        recast: 90, duration: 8, type: "all", value: 15, isShield: false, scope: "target", minLevel: 82, family: "ph_target_miti"
    },
    {
        id: "divine_benison", jobId: "whm", name: { ja: "ディヴァインベニゾン", en: "Divine Benison", zh: "神祝祷", ko: "신성한 축복" }, icon: "/icons/Divine_Benison.png",
        recast: 30, duration: 15, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 500, scope: "target", maxCharges: 2, minLevel: 66, family: "ph_target_shield"
    },

    // --- Dancer ---
    {
        id: "improvisation", jobId: "dnc", name: { ja: "インプロビゼーション", en: "Improvisation", zh: "即兴表演", ko: "즉흥 연기" }, icon: "/icons/Improvisation.png",
        recast: 120, duration: 30, type: "all", value: 0, isShield: true, valueType: 'hp', shieldScale: "10% HP", minLevel: 80, family: "ranged_party_heal"
    },
    {
        id: "shield_samba", jobId: "dnc", name: { ja: "守りのサンバ", en: "Shield Samba", zh: "防守之桑巴", ko: "수세의 삼바" }, icon: "/icons/Shield_Samba.png",
        recast: 90, duration: 15, type: "all", value: 15, isShield: false, minLevel: 98, family: "ranged_party_15"
    },
    {
        id: "shield_samba_base", jobId: "dnc", name: { ja: "守りのサンバ", en: "Shield Samba", zh: "防守之桑巴", ko: "수세의 삼바" }, icon: "/icons/Shield_Samba.png",
        recast: 90, duration: 15, type: "all", value: 10, isShield: false, minLevel: 58, maxLevel: 97, family: "ranged_party_15"
    },

    // --- Role Actions ---
    // Rampart (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `rampart_${job}`, jobId: job, name: { ja: "ランパート", en: "Rampart", zh: "铁壁", ko: "철벽 방어" }, icon: "/icons/Rampart.png",
        recast: 90, duration: 20, type: "all" as const, value: 20, isShield: false, scope: "self" as const, minLevel: 8, family: "role_action"
    })),
    // Reprisal (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_${job}`, jobId: job, name: { ja: "リプライザル", en: "Reprisal", zh: "雪仇", ko: "앙갚음" }, icon: "/icons/Reprisal.png",
        recast: 60, duration: 15, type: "all" as const, value: 10, isShield: false, scope: "party" as const, minLevel: 98, family: "role_action"
    })),
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_base_${job}`, jobId: job, name: { ja: "リプライザル", en: "Reprisal", zh: "雪仇", ko: "앙갚음" }, icon: "/icons/Reprisal.png",
        recast: 60, duration: 10, type: "all" as const, value: 10, isShield: false, scope: "party" as const, minLevel: 22, maxLevel: 97, family: "role_action"
    })),
    // Addle (Casters: blm, smn, rdm, pct)
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_${job}`, jobId: job, name: { ja: "アドル", en: "Addle", zh: "昏乱", ko: "정신 교란" }, icon: "/icons/Addle.png",
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, minLevel: 98, family: "role_action"
    })),
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_base_${job}`, jobId: job, name: { ja: "アドル", en: "Addle", zh: "昏乱", ko: "정신 교란" }, icon: "/icons/Addle.png",
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, minLevel: 8, maxLevel: 97, family: "role_action"
    })),
    // Feint (Melee: mnk, drg, nin, sam, rpr, vpr)
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_${job}`, jobId: job, name: { ja: "牽制", en: "Feint", zh: "牵制", ko: "견제" }, icon: "/icons/Feint.png",
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, minLevel: 98, family: "role_action"
    })),
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_base_${job}`, jobId: job, name: { ja: "牽制", en: "Feint", zh: "牵制", ko: "견제" }, icon: "/icons/Feint.png",
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, minLevel: 22, maxLevel: 97, family: "role_action"
    })),
];
