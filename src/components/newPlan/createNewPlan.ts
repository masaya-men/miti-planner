import { useMitigationStore } from '../../store/useMitigationStore';
import { deriveContentId } from '../../lib/contentSelection';
import { commitNewPlan } from '../../lib/commitNewPlan';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import type { ContentLevel, ContentCategory, ContentDefinition, PlanData, SavedPlan } from '../../types';

interface CreateNewPlanArgs {
    level: ContentLevel;
    boss: ContentDefinition | null;
    category: ContentCategory | null;
    title: string;
    activePlanId: string | null;
    updatePlan: (id: string, patch: Partial<SavedPlan>) => void;
    getSnapshot: () => PlanData;
    onClose: (created?: { contentId: string | null; level: ContentLevel; category: ContentCategory }) => void;
}

/** 新規プランを作る一連の処理(現プラン保存 → ストア初期化 → 登録 → 作成結果を通知)。 */
export function createNewPlan({ level, boss, category, title, activePlanId, updatePlan, getSnapshot, onClose }: CreateNewPlanArgs): void {
    // 根治(2): 共同編集ON中なら先に切断。下の clearAllMitigations / updatePartyBulk が
    // 「今繋がっている部屋(別プラン)」に委譲されて、その部屋を空にするのを防ぐ。
    useCollabSessionStore.getState().disconnect();

    // 1. 現在のプランを保存
    if (activePlanId) {
        updatePlan(activePlanId, { data: getSnapshot() });
    }

    const store = useMitigationStore.getState();
    const useLevel = boss ? boss.level : level;

    // 2. レベル・ステータス設定 + 軽減・パーティクリア
    store.setCurrentLevel(useLevel);
    store.applyDefaultStats(useLevel, boss?.patch);
    store.clearAllMitigations();
    store.updatePartyBulk(
        store.partyMembers.map(m => ({ memberId: m.id, jobId: null }))
    );
    store.setMyMemberId(null);

    // 3. 空のタイムラインで開始（テンプレートは読み込まない）
    store.loadSnapshot({
        ...store.getSnapshot(),
        timelineEvents: [],
        timelineMitigations: [],
        phases: [],
        memos: [], // 新規プランは前プランのメモを引き継がない
    });
    store.setHideEmptyRows(false);

    // 4. contentId の決定
    // 零式・絶: 既存のコンテンツID / それ以外: ユーザー入力名をそのまま使う
    const contentId = deriveContentId(boss, category, title);

    // 5. プラン保存 (crypto.randomUUID で同一 ms 連続作成時の ID 衝突を防止)
    const newPlanId = `plan_${crypto.randomUUID()}`;
    const finalSnapshot = store.getSnapshot();
    // 根治(C-1): 持ち主確定→currentPlanId切替を安全な順序で行う共有処理(直前プラン破壊を防ぐ)
    commitNewPlan({
        id: newPlanId,
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId,
        category: category!,
        level: useLevel as ContentLevel,
        title: title.trim(),
        isPublic: false,
        data: finalSnapshot,
        createdAt: Date.now(),
        updatedAt: Date.now()
    });

    // チュートリアル通知
    useTutorialStore.getState().completeEvent('content:selected');
    useTutorialStore.getState().completeEvent('create:plan-created');

    // サイドバーに作成結果を伝える
    onClose({ contentId, level: useLevel as ContentLevel, category: category! });
}
