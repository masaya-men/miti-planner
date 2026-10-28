import type { Mitigation } from '../../types/index.js';

/** ロールアクション */
export const MITIGATIONS_ROLE_ACTIONS: Mitigation[] = [
    // --- Role Actions ---
    // Rampart (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `rampart_${job}`, jobId: job, name: { ja: "ランパート", en: "Rampart", zh: "铁壁", ko: "철벽 방어" }, icon: "/icons/Rampart.png",
        recast: 90, duration: 20, type: "all" as const, value: 20, isShield: false, scope: "self" as const, minLevel: 8, maxLevel: 93, family: "role_action"
    })),
    // Rampart 効果アップ (Lv94特性で被回復+15%が追加)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `rampart_v2_${job}`, jobId: job, name: { ja: "ランパート", en: "Rampart", zh: "铁壁", ko: "철벽 방어" }, icon: "/icons/Rampart.png",
        recast: 90, duration: 20, type: "all" as const, value: 20, isShield: false, scope: "self" as const,
        healingIncrease: 15, note: "自身の被ダメージ20%軽減 + 受ける回復効果+15%", minLevel: 94, family: "role_action"
    })),
    // Reprisal (Tanks)
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_${job}`, jobId: job, name: { ja: "リプライザル", en: "Reprisal", zh: "雪仇", ko: "앙갚음" }, icon: "/icons/Reprisal.png",
        recast: 60, duration: 15, type: "all" as const, value: 10, isShield: false, scope: "party" as const, minLevel: 98, appliesAsDebuff: true, family: "role_action"
    })),
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `reprisal_base_${job}`, jobId: job, name: { ja: "リプライザル", en: "Reprisal", zh: "雪仇", ko: "앙갚음" }, icon: "/icons/Reprisal.png",
        recast: 60, duration: 10, type: "all" as const, value: 10, isShield: false, scope: "party" as const, minLevel: 22, maxLevel: 97, appliesAsDebuff: true, family: "role_action"
    })),
    // Provoke (Tanks) — タンクスイッチ用マーカー（軽減効果なし・対象を MT⇄ST 反転）
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `provoke_${job}`, jobId: job,
        name: { ja: "挑発", en: "Provoke", zh: "挑衅", ko: "도발" },
        icon: "/icons/Provoke.png",
        recast: 30, duration: 0, type: "all" as const, value: 0,
        isShield: false, scope: "self" as const, minLevel: 15,
        isTankSwap: true, family: "role_action"
    })),
    // Addle (Casters: blm, smn, rdm, pct)
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_${job}`, jobId: job, name: { ja: "アドル", en: "Addle", zh: "昏乱", ko: "정신 교란" }, icon: "/icons/Addle.png",
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, minLevel: 98, appliesAsDebuff: true, family: "role_action"
    })),
    ...['blm', 'smn', 'rdm', 'pct'].map(job => ({
        id: `addle_base_${job}`, jobId: job, name: { ja: "アドル", en: "Addle", zh: "昏乱", ko: "정신 교란" }, icon: "/icons/Addle.png",
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, minLevel: 8, maxLevel: 97, appliesAsDebuff: true, family: "role_action"
    })),
    // Feint (Melee: mnk, drg, nin, sam, rpr, vpr)
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_${job}`, jobId: job, name: { ja: "牽制", en: "Feint", zh: "牵制", ko: "견제" }, icon: "/icons/Feint.png",
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, minLevel: 98, appliesAsDebuff: true, family: "role_action"
    })),
    ...['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].map(job => ({
        id: `feint_base_${job}`, jobId: job, name: { ja: "牽制", en: "Feint", zh: "牵制", ko: "견제" }, icon: "/icons/Feint.png",
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, minLevel: 22, maxLevel: 97, appliesAsDebuff: true, family: "role_action"
    })),
];
