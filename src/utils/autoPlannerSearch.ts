import type { AppliedMitigation } from '../types';
import type { SADecision } from './autoPlannerTypes';
import type { PlannerContext } from './autoPlannerContext';
import type { Deployers } from './autoPlannerDeploy';

// 焼きなまし法の探索(コンパイル・スコアリング・近傍操作・マルチスタート実行)。最良の決定ベクトルを返す。
export function createSearch(ctx: PlannerContext, deployers: Deployers) {
    const {
        getMiti, memberSkills, schMember, isLethal, lethalityRatio,
        blocks, aoeBlocks, tbBlocks, place,
    } = ctx;
    const { deployAoe, deployTB } = deployers;

    // ================================================================
    // コンパイル: 決定ベクトル → 具体的な軽減配置
    // ================================================================
    const compile = (decision: SADecision): AppliedMitigation[] => {
        const state: AppliedMitigation[] = [];
        const uMap = new Map<string, number[]>();

        // 学者の開幕転化（固定配置）
        if (schMember) {
            const diss = (memberSkills.get(schMember.id) || []).find(m => m.id.includes('dissipation'));
            if (diss) place(state, uMap, schMember.id, diss.id, 0);
        }

        // AoEブロック配置（ダメージ降順）
        for (let i = 0; i < aoeBlocks.length; i++) {
            const route = i < decision.aoeRoutes.length ? decision.aoeRoutes[i] : 'A';
            deployAoe(aoeBlocks[i], route, state, uMap);
        }

        // TBブロック配置（ダメージ降順）
        for (let i = 0; i < tbBlocks.length; i++) {
            const pattern = i < decision.tbPatterns.length ? decision.tbPatterns[i] : 0;
            deployTB(tbBlocks[i], pattern, state, uMap);
        }

        return state;
    };

    // ================================================================
    // スコアリング関数
    //
    // 優先順位:
    //   1. 絶対生存（最優先）: 全ブロック生存 → 巨大ボーナス
    //   2. リキャスト遵守: 違反があれば大幅減点
    //   3. パッケージ運用: Route A/Bの完全配置 → 加点
    //   4. 戦略的無敵: バフ枯渇TBへの無敵割り当て → 加点
    //   5. リソース効率: 過剰な軽減使用 → 微小減点
    // ================================================================
    const scoreState = (state: AppliedMitigation[]): number => {
        let s = 0;

        // 1. 絶対生存（最優先）
        for (const block of blocks) {
            const ratio = lethalityRatio(block, state);
            if (ratio < 1.0) {
                s += 10000;
                // HP余裕に応じた微小ボーナス（効率的な配置を促進）
                s += Math.floor((1.0 - ratio) * 500);
            } else {
                // 致死ペナルティ（超過量に比例）
                s -= 50000 + Math.floor((ratio - 1.0) * 10000);
            }
        }

        // 2. リキャスト遵守
        const groups = new Map<string, { mitiId: string; times: number[] }>();
        for (const a of state) {
            const key = `${a.ownerId}_${a.mitigationId}`;
            let group = groups.get(key);
            if (!group) {
                group = { mitiId: a.mitigationId, times: [] };
                groups.set(key, group);
            }
            group.times.push(a.time);
        }
        for (const [, group] of groups) {
            const m = getMiti(group.mitiId);
            if (!m) continue;
            group.times.sort((a, b) => a - b);
            for (let i = 1; i < group.times.length; i++) {
                if (group.times[i] - group.times[i - 1] < m.recast) {
                    s -= 8000;
                }
            }
        }

        // 3. パッケージ運用ボーナス
        for (const block of aoeBlocks) {
            const owners = new Set(
                state.filter(a => Math.abs(a.time - block.startTime) <= 1).map(a => a.ownerId)
            );
            const routeA = ['MT', 'H1', 'D1', 'D3'].filter(m => owners.has(m)).length;
            const routeB = ['ST', 'H2', 'D2', 'D4'].filter(m => owners.has(m)).length;
            const best = Math.max(routeA, routeB);
            s += best * 150;
            if (best >= 4) s += 500;  // 完全パッケージボーナス
        }

        // 4. 戦略的無敵ボーナス
        for (const block of tbBlocks) {
            const blockMitis = state.filter(a => Math.abs(a.time - block.startTime) <= 1);
            const hasInvuln = blockMitis.some(a => getMiti(a.mitigationId)?.isInvincible);
            if (hasInvuln && !isLethal(block, state)) s += 300;
        }

        // 5. リソース効率（使用スキル数の微小ペナルティ）
        s -= state.length * 5;

        return s;
    };

    // ================================================================
    // 近傍操作（ミューテーション）
    // ================================================================
    const mutate = (d: SADecision): SADecision => {
        const nd: SADecision = {
            aoeRoutes: [...d.aoeRoutes],
            tbPatterns: [...d.tbPatterns],
        };

        const r = Math.random();

        if (r < 0.35 && nd.aoeRoutes.length > 0) {
            // 単一AoEブロックのルート反転
            const idx = Math.floor(Math.random() * nd.aoeRoutes.length);
            nd.aoeRoutes[idx] = nd.aoeRoutes[idx] === 'A' ? 'B' : 'A';

        } else if (r < 0.55 && nd.aoeRoutes.length >= 2) {
            // 隣接AoEブロックのルート交換
            const idx = Math.floor(Math.random() * (nd.aoeRoutes.length - 1));
            [nd.aoeRoutes[idx], nd.aoeRoutes[idx + 1]] = [nd.aoeRoutes[idx + 1], nd.aoeRoutes[idx]];

        } else if (r < 0.80 && nd.tbPatterns.length > 0) {
            // TBパターン変更
            const idx = Math.floor(Math.random() * nd.tbPatterns.length);
            nd.tbPatterns[idx] = Math.floor(Math.random() * 6);

        } else if (nd.aoeRoutes.length > 0) {
            // 2つのAoEブロックを同時反転
            const idx1 = Math.floor(Math.random() * nd.aoeRoutes.length);
            let idx2 = Math.floor(Math.random() * nd.aoeRoutes.length);
            if (idx2 === idx1 && nd.aoeRoutes.length > 1) {
                idx2 = (idx1 + 1) % nd.aoeRoutes.length;
            }
            nd.aoeRoutes[idx1] = nd.aoeRoutes[idx1] === 'A' ? 'B' : 'A';
            if (idx1 !== idx2) {
                nd.aoeRoutes[idx2] = nd.aoeRoutes[idx2] === 'A' ? 'B' : 'A';
            }
        }

        return nd;
    };

    // ================================================================
    // SA実行エンジン
    // ================================================================
    const runSA = (
        initial: SADecision,
        iterations: number,
        t0: number,
        cooling: number
    ): { decision: SADecision; score: number } => {
        let current = initial;
        let currentScore = scoreState(compile(current));
        let best: SADecision = {
            aoeRoutes: [...current.aoeRoutes],
            tbPatterns: [...current.tbPatterns],
        };
        let bestScore = currentScore;
        let temp = t0;

        for (let i = 0; i < iterations; i++) {
            const neighbor = mutate(current);
            const nScore = scoreState(compile(neighbor));
            const delta = nScore - currentScore;

            // メトロポリス基準: 改善なら必ず採用、悪化なら確率的に採用
            if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
                current = neighbor;
                currentScore = nScore;
                if (currentScore > bestScore) {
                    best = {
                        aoeRoutes: [...current.aoeRoutes],
                        tbPatterns: [...current.tbPatterns],
                    };
                    bestScore = currentScore;
                }
            }

            temp *= cooling;
        }

        return { decision: best, score: bestScore };
    };

    // ================================================================
    // マルチスタートSA実行
    //
    // 3つの異なる初期解からSAを並列実行し、最良解を採用。
    // 合計 9000回 のシミュレーションで全体最適を探索。
    // ================================================================
    const ITERATIONS_PER_RUN = 3000;
    const T0 = 500;
    const COOLING = 0.998;

    // 初期決定ベクトルの生成
    const makeInitial = (startRoute: 'A' | 'B', randomize: boolean): SADecision => {
        const routes: ('A' | 'B')[] = [];
        let r = startRoute;
        for (let i = 0; i < aoeBlocks.length; i++) {
            if (randomize) {
                routes.push(Math.random() < 0.5 ? 'A' : 'B');
            } else {
                routes.push(r);
                r = r === 'A' ? 'B' : 'A';
            }
        }
        const patterns: number[] = [];
        for (let i = 0; i < tbBlocks.length; i++) {
            patterns.push(randomize ? Math.floor(Math.random() * 6) : 0);
        }
        return { aoeRoutes: routes, tbPatterns: patterns };
    };

    // 3つの初期解: A始動交互, B始動交互, ランダム
    const starts: SADecision[] = [
        makeInitial('A', false),
        makeInitial('B', false),
        makeInitial('A', true),
    ];

    let globalBest: { decision: SADecision; score: number } | null = null;
    for (const start of starts) {
        const result = runSA(start, ITERATIONS_PER_RUN, T0, COOLING);
        if (!globalBest || result.score > globalBest.score) {
            globalBest = result;
        }
    }

    return { compile, globalBest };
}
