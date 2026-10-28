import type { TimelineEvent, PartyMember, AppliedMitigation } from '../types';
import { createPlannerContext } from './autoPlannerContext';
import { createDeployers } from './autoPlannerDeploy';
import { createSearch } from './autoPlannerSearch';

export interface AutoPlannerResult {
    mitigations: AppliedMitigation[];
    warnings: string[];
}

// ====================================================================
// SA法（焼きなまし法）による全体最適化オートプランナー
//
// 従来の「降順貪欲法」に代わり、タイムライン全体の「生存率」と
// 「パッケージ運用の整合性」を最大化する焼きなまし法エンジン。
//
// 設計:
//   決定ベクトル = AoEブロックのルート(A/B)割り当て + TBパターン選択
//   コンパイル   = 決定ベクトル → 具体的な軽減配置（AppliedMitigation[]）
//   スコアリング = 生存・リキャスト・パッケージ・戦略的無敵を評価
//   探索         = マルチスタートSAで最良解を発見
// ====================================================================

export function generateAutoPlan(
    timeline: TimelineEvent[],
    party: PartyMember[],
    level: number,
    settings?: { tankHp: number; dpsHp: number }
): AutoPlannerResult {
    const ctx = createPlannerContext(timeline, party, level, settings);
    const deployers = createDeployers(ctx);
    const { blocks, isLethal } = ctx;
    const { compile, globalBest } = createSearch(ctx, deployers);

    // ================================================================
    // 最終結果の生成
    // ================================================================
    const finalState = globalBest ? compile(globalBest.decision) : [];

    // 最終結果にユニークIDを付与
    for (const a of finalState) {
        a.id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'ap_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    }

    // 致死警告の生成
    const warnings = new Set<string>();
    for (const block of blocks) {
        if (isLethal(block, finalState)) {
            block.events.forEach(e => warnings.add(e.id));
        }
    }

    return {
        mitigations: finalState.sort((a, b) => a.time - b.time),
        warnings: Array.from(warnings),
    };
}
