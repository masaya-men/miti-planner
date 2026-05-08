import type { SavedPlan } from '../types';
import { generateUniqueTitle } from './planTitle';

export interface ImportResult {
    imported: number;
    skipped: number;
    contentBreakdown: Record<string, { imported: number; skipped: number }>;
}

export interface ImportPlanItem {
    original: SavedPlan;
    newId: string;
    finalTitle: string;
}

export interface ImportPlan {
    toImport: ImportPlanItem[];
    toSkip: SavedPlan[];
    result: ImportResult;
}

interface ComputeImportPlanArgs {
    localPlans: SavedPlan[];
    /** 既存リモートプランの合計件数 (今回取り込む前) */
    totalCount: number;
    /** 既存リモートプランのコンテンツ別件数 (今回取り込む前) */
    byContentCounts: Record<string, number>;
    /** 既存タイトル一覧 (contentId 単位、同名衝突判定用) */
    existingTitlesByContent: Map<string, string[]>;
    totalLimit: number;
    perContentLimit: number;
}

/**
 * ローカルプランの取り込み計画を立てる純粋関数。
 *
 * - 合計枠 (`totalLimit`) と コンテンツ別枠 (`perContentLimit`) を順守
 * - 各取り込み対象に新 ID (`plan_<timestamp>_<random>`) を発行 → 既存 Firestore plan の上書きを物理的に防ぐ
 * - 同名衝突時は `generateUniqueTitle()` で `(2)`, `(3)` 採番、取り込み中の他プランも考慮 (連続採番)
 * - 副作用ゼロ。Firestore も localStorage もタッチしない
 */
export function computeImportPlan(args: ComputeImportPlanArgs): ImportPlan {
    const { localPlans, totalCount, byContentCounts, existingTitlesByContent, totalLimit, perContentLimit } = args;

    const toImport: ImportPlanItem[] = [];
    const toSkip: SavedPlan[] = [];
    const result: ImportResult = { imported: 0, skipped: 0, contentBreakdown: {} };

    let totalUsed = totalCount;
    const liveContentCounts: Record<string, number> = { ...byContentCounts };
    const liveTitles = new Map<string, string[]>();
    for (const [k, v] of existingTitlesByContent) liveTitles.set(k, [...v]);

    for (const plan of localPlans) {
        const cid = plan.contentId ?? '';
        const breakdown = (result.contentBreakdown[cid] ??= { imported: 0, skipped: 0 });
        const currentForContent = liveContentCounts[cid] ?? 0;

        if (totalUsed >= totalLimit || currentForContent >= perContentLimit) {
            breakdown.skipped += 1;
            result.skipped += 1;
            toSkip.push(plan);
            continue;
        }

        const titlesForContent = liveTitles.get(cid) ?? [];
        const existingForTitleCheck = titlesForContent.map(title => ({ title, contentId: cid || null }));
        const finalTitle = generateUniqueTitle(plan.title, existingForTitleCheck, cid || null);
        const newId = `plan_${crypto.randomUUID()}`;

        toImport.push({ original: plan, newId, finalTitle });
        breakdown.imported += 1;
        result.imported += 1;
        totalUsed += 1;
        liveContentCounts[cid] = currentForContent + 1;
        liveTitles.set(cid, [...titlesForContent, finalTitle]);
    }

    return { toImport, toSkip, result };
}
