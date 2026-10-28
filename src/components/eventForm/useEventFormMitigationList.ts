import { useMemo } from 'react';
import type { useMitigations, useJobs } from '../../hooks/useSkillsData';

// 軽減選択グリッドに出す軽減の絞り込み(レベル・重複・回復のみ除外)と並び順、鼓舞展開バリアント用アイコン。
export function useEventFormMitigationList(
    MITIGATIONS: ReturnType<typeof useMitigations>,
    JOBS: ReturnType<typeof useJobs>,
    currentLevel: number,
) {
    // 並び順ソートキー
    // グループ 0: 全体軽減 (scope: 'party' or undefined) → T/H/D → ジョブ順 → リキャスト短→長
    // グループ 1: タンクLB (id 'tank_lb' 始まり) → LB1→LB2→LB3 → ジョブ順
    // グループ 2: 個別軽減 (scope: 'self' or 'target') → T/H/D → ジョブ順 → self→target → リキャスト短→長
    const EXCLUDED_IDS = [
        'aurora', 'thrill_of_battle', 'holmgang', 'living_dead', 'superbolide', 'hallowed_ground',
        'helios_conjunction', 'summon_seraph', 'seraphism', 'philosophia', 'macrocosmos',
        'aspected_helios', 'riddle_of_earth'
    ];

    const getSortKey = (mit: typeof MITIGATIONS[0]) => {
        // requires がある場合、 親の recast を借りて「親の直後」 に並ぶよう調整する。
        // ただし scope/jobId/group は mit 自身を維持する (例: 占星カードは scope='target' を
        // 保持しつつ、 親 Astral Draw の recast 55 に隣接配置)。
        let parentRecast: number | null = null;
        if (mit.requires && !EXCLUDED_IDS.includes(mit.requires)) {
            const parent = MITIGATIONS.find(m => m.id === mit.requires);
            if (parent) {
                parentRecast = parent.recast ?? null;
            }
        }

        const job = JOBS.find(j => j.id === mit.jobId);
        const role = job?.role || 'dps';
        const roleOrder = role === 'tank' ? 0 : role === 'healer' ? 1 : 2;
        const jobOrder = JOBS.findIndex(j => j.id === mit.jobId);
        const safeJobOrder = jobOrder === -1 ? 999 : jobOrder;

        // グループ判定
        let groupOrder: number;
        if (mit.id.startsWith('tank_lb')) {
            groupOrder = 1;
        } else if (mit.scope === 'self' || mit.scope === 'target') {
            groupOrder = 2;
        } else {
            // scope === 'party' または scope === undefined
            groupOrder = 0;
        }

        // LB レベル (1/2/3)
        let lbLevel = 0;
        if (groupOrder === 1) {
            const m = mit.id.match(/tank_lb(\d)/);
            lbLevel = m ? parseInt(m[1], 10) : 0;
        }

        // scope 内順序: グループ 2 でのみ意味あり（self=0, target=1）
        const scopeInnerOrder = mit.scope === 'self' ? 0 : mit.scope === 'target' ? 1 : 0;

        const recast = parentRecast !== null
            ? parentRecast + 0.5
            : (mit.recast ?? 999);

        return { groupOrder, roleOrder, safeJobOrder, scopeInnerOrder, lbLevel, recast };
    };

    const isPureHealOnly = (mit: typeof MITIGATIONS[0]): boolean => {
        return (
            mit.value === 0 &&
            !mit.isShield &&
            !mit.healingIncrease &&
            mit.valueMagical === undefined &&
            mit.valuePhysical === undefined
        );
    };

    // 鼓舞展開バリアント描画用のアイコンパス
    const recitationIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'recitation')?.icon ?? '',
        [MITIGATIONS]
    );
    const protractionIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'protraction')?.icon ?? '',
        [MITIGATIONS]
    );
    const deploymentIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'deployment_tactics')?.icon ?? '',
        [MITIGATIONS]
    );

    // Deduplicate mitigations by English name so role actions (Addle, Feint, Reprisal) only appear once
    const uniqueMitigations = useMemo(() => {
        const seenNames = new Set<string>();
        return MITIGATIONS.filter(mit => {
            // Level sync filtering
            if (mit.minLevel !== undefined && currentLevel < mit.minLevel) return false;
            if (mit.maxLevel !== undefined && currentLevel > mit.maxLevel) return false;

            // Filter out excluded IDs first
            if (EXCLUDED_IDS.includes(mit.id)) return false;

            // Filter out pure-heal-only skills (no mitigation value, no shield, no heal-up buff)
            if (isPureHealOnly(mit)) return false;

            const nameEN = mit.name.en;
            if (seenNames.has(nameEN)) return false;
            seenNames.add(nameEN);
            return true;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- EXCLUDED_IDS と isPureHealOnly はコンポーネント内で毎回作り直される定義(中身は固定)。レベルと軽減一覧が変わった時だけ再計算する
    }, [currentLevel, MITIGATIONS]);

    const sortedMitigations = useMemo(() => {
        return [...uniqueMitigations].sort((a, b) => {
            const ka = getSortKey(a);
            const kb = getSortKey(b);

            // グループ
            if (ka.groupOrder !== kb.groupOrder) return ka.groupOrder - kb.groupOrder;

            // グループ 1 (LB): lbLevel → jobOrder
            if (ka.groupOrder === 1) {
                if (ka.lbLevel !== kb.lbLevel) return ka.lbLevel - kb.lbLevel;
                if (ka.safeJobOrder !== kb.safeJobOrder) return ka.safeJobOrder - kb.safeJobOrder;
                return (a.name.ja || "").localeCompare(b.name.ja || "");
            }

            // グループ 0 / 2: ロール → ジョブ順 → scope内順 → リキャスト順
            if (ka.roleOrder !== kb.roleOrder) return ka.roleOrder - kb.roleOrder;
            if (ka.safeJobOrder !== kb.safeJobOrder) return ka.safeJobOrder - kb.safeJobOrder;
            if (ka.scopeInnerOrder !== kb.scopeInnerOrder) return ka.scopeInnerOrder - kb.scopeInnerOrder;
            if (ka.recast !== kb.recast) return ka.recast - kb.recast;
            return (a.name.ja || "").localeCompare(b.name.ja || "");
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getSortKey は毎回作り直される関数(JOBS 参照)。軽減一覧が変わった時と JOBS が変わった時だけ並べ直す
    }, [uniqueMitigations, JOBS]);

    return { sortedMitigations, recitationIcon, protractionIcon, deploymentIcon };
}
