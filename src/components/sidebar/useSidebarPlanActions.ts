import { useTutorialStore } from '../../store/useTutorialStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { getContentById } from '../../data/contentRegistry';
import type { ContentLevel, ContentDefinition } from '../../types';
import { usePlanStore } from '../../store/usePlanStore';
import { PLAN_LIMITS } from '../../types/firebase';
import { getTemplate } from '../../data/templateLoader';
import { ensurePhaseEndTimes } from '../../utils/phaseMigration';
import { ensureLabelEndTimes } from '../../utils/labelMigration';
import { createTutorialEvents, TUTORIAL_PLAN_TITLE } from '../../data/tutorialTemplate';
import i18n from '../../i18n';
import { showToast } from '../toastBus';
import { decompressPlanData } from '../../utils/compression';
import { commitNewPlan } from '../../lib/commitNewPlan';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { setLastOpened } from '../../utils/lastOpenedStore';
import type { TFunction } from 'i18next';
import type { useSidebarNav } from './useSidebarNav';
import type { useSidebarPlanSync } from './useSidebarPlanSync';
import type { useTransitionOverlay } from '../ui/transitionOverlayContext';

type Nav = ReturnType<typeof useSidebarNav>;
type Sync = ReturnType<typeof useSidebarPlanSync>;

interface UseSidebarPlanActionsArgs {
    t: TFunction;
    runTransition: ReturnType<typeof useTransitionOverlay>['runTransition'];
    fullWidth?: boolean;
    onClose?: () => void;
    nav: Nav;
    sync: Sync;
}

export function useSidebarPlanActions({ t, runTransition, fullWidth, onClose, nav, sync }: UseSidebarPlanActionsArgs) {
    const { setSelectedContentId, setActiveTab } = nav;
    const { pendingContent, setPendingContent, pendingPlanName, setPendingPlanName, currentPlanId, updatePlan, getSnapshot, loadSnapshot, setCurrentPlanId } = sync;

    // コンテンツクリック → 既存プランがあればそれを開く、なければ名前入力ダイアログを表示
    const handleSelectContent = (content: ContentDefinition, forceNew?: boolean) => {
        setSelectedContentId(content.id);

        // 既にこのコンテンツのプランがある場合
        // （forceNew または チュートリアル中は既存プランを無視し、新規チュートリアルプランを作成する）
        const isTutorial = useTutorialStore.getState().isActive;
        const planStore = usePlanStore.getState();
        const existingPlans = !forceNew && !isTutorial
            ? planStore.plans.filter(p => p.contentId === content.id)
            : [];
        if (existingPlans.length >= 1) {
            // プランあり → サブアイテム展開のみ（プラン読込はサブアイテムから）
            return;
        }

        const store = useMitigationStore.getState();

        // 現在のプランを保存してから切り替え
        if (currentPlanId) {
            planStore.updatePlan(currentPlanId, { data: store.getSnapshot() });
        }

        // 件数制限チェック（チュートリアル中はスキップ）
        if (!useTutorialStore.getState().isActive) {
            const totalCount = planStore.plans.length;
            const contentCount = planStore.plans.filter(p => p.contentId === content.id).length;
            if (totalCount >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
                alert(t('new_plan.plan_limit_total', { max: PLAN_LIMITS.MAX_TOTAL_PLANS }));
                return;
            }
            if (contentCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
                alert(t('new_plan.plan_limit_per_content', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }));
                return;
            }
        }

        // 新規作成
        const defaultName = content.shortName.en || content.shortName.ja;

        // チュートリアル中はダイアログをスキップ、専用プラン名で自動作成
        if (useTutorialStore.getState().isActive) {
            const lang = i18n.language?.startsWith('ja') ? 'ja' : 'en';
            const tutorialName = `${defaultName}_${TUTORIAL_PLAN_TITLE[lang]}`;
            createPlanDirectly(content, tutorialName, true);
            return;
        }

        // 通常: 名前入力ダイアログを表示
        setPendingContent(content);
        setPendingPlanName(defaultName);
    };

    // テンプレート読み込み → プラン保存（共通ロジック）
    // isTutorial: trueの場合、テンプレートの代わりにTUTORIAL_EVENTSをロード
    const createPlanDirectly = (content: ContentDefinition, planTitle: string, isTutorial?: boolean) => {
        runTransition(async () => {
            const store = useMitigationStore.getState();
            // 根治(2): 共同編集ON中に新規作成すると、下の clearAllMitigations / updatePartyBulk が
            // 「今繋がっている部屋(別プラン)」に委譲され、その部屋の軽減・パーティを空にしてしまう。
            // 作成の最初に必ず切断し、_collabActive=false にしてからローカル初期化する。
            useCollabSessionStore.getState().disconnect();

            store.setCurrentLevel(content.level);
            store.applyDefaultStats(content.level, content.patch);
            // 新しいコンテンツを開くので軽減・パーティをクリア
            store.clearAllMitigations();
            // パーティ構成もリセット（前のプランのジョブが引き継がれないように）
            store.updatePartyBulk(
                store.partyMembers.map(m => ({ memberId: m.id, jobId: null }))
            );
            store.setMyMemberId(null);
            if (content.category === 'savage') setActiveTab('savage');
            else if (content.category === 'ultimate') setActiveTab('ultimate');
            else setActiveTab('other');

            if (isTutorial) {
                // チュートリアル: 実際のステータスからダメージを動的計算
                const members = store.partyMembers;
                const tankHp = members.find(m => m.role === 'tank')?.stats.hp ?? 100000;
                const otherHp = members.find(m => m.role === 'healer')?.stats.hp ?? 80000;
                const snap = store.getSnapshot();
                store.loadSnapshot({
                    ...snap,
                    timelineMitigations: [],
                    timelineEvents: createTutorialEvents(otherHp, tankHp),
                    phases: [],
                    memos: [], // 新規プランは前プランのメモを引き継がない
                });
            } else {
                // テンプレートを裏で読み込み → 自動でプランとして保存
                const tpl = await getTemplate(content.id);
                if (tpl) {
                    const snap = store.getSnapshot();
                    const tplMaxEventTime = tpl.timelineEvents.length > 0
                        ? tpl.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
                        : undefined;
                    // ラベル変換: TemplateData.labels → Label[]
                    const labels = tpl.labels
                        ? ensureLabelEndTimes(tpl.labels.map(l => ({
                            id: crypto.randomUUID(),
                            name: l.name,
                            startTime: l.startTimeSec,
                            ...(l.endTimeSec !== undefined ? { endTime: l.endTimeSec } : {}),
                        })), tplMaxEventTime)
                        : undefined;
                    store.loadSnapshot({
                        ...snap,
                        memos: [], // 新規プランは前プランのメモを引き継がない
                        timelineMitigations: [],
                        timelineEvents: tpl.timelineEvents,
                        phases: tpl.phases ? ensurePhaseEndTimes(tpl.phases
                            .filter(p => p.startTimeSec >= 0)
                            .map((p) => ({
                                id: `phase_${p.id}`,
                                name: p.name
                                    ? (typeof p.name === 'string'
                                        ? { ja: p.name, en: '' }
                                        : {
                                            ja: p.name.ja ?? '',
                                            en: p.name.en ?? '',
                                            ...(p.name.zh != null ? { zh: p.name.zh } : {}),
                                            ...(p.name['zh-Hant'] != null ? { 'zh-Hant': p.name['zh-Hant'] } : {}),
                                            ...(p.name.ko != null ? { ko: p.name.ko } : {}),
                                        })
                                    : { ja: '', en: '' },
                                startTime: p.startTimeSec,
                            })), tplMaxEventTime) : [],
                        ...(labels ? { labels } : {}),
                    });
                } else {
                    store.loadSnapshot({
                        ...store.getSnapshot(),
                        timelineEvents: [],
                        timelineMitigations: [],
                        phases: [],
                        memos: [], // 新規プランは前プランのメモを引き継がない
                    });
                }
            }

            // crypto.randomUUID で同一 ms 連続作成時の ID 衝突を防止
            const newPlanId = `plan_${crypto.randomUUID()}`;
            // 根治(C-1): addPlan→持ち主確定→currentPlanId切替を安全な順序で行う共有処理。
            // 持ち主を currentPlanId より先に確定し、切替の同期保存が直前プランを壊さないようにする。
            commitNewPlan({
                id: newPlanId,
                ownerId: 'local',
                ownerDisplayName: 'Guest',
                contentId: content.id,
                title: planTitle,
                isPublic: false,
                data: store.getSnapshot(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            // チュートリアル: トランジション完了後にステップ進行（ローディング中にカード移動が見えない問題を回避）
            setTimeout(() => {
                useTutorialStore.getState().completeEvent('content:selected');
            }, 800);
        }, 'plan');
    };

    // ダイアログから呼ばれるラッパー
    const handleConfirmNewPlan = () => {
        if (!pendingContent || !pendingPlanName.trim()) return;
        createPlanDirectly(pendingContent, pendingPlanName.trim());
        setPendingContent(null);
        setPendingPlanName('');
        // スマホのみメニューを閉じる
        if (fullWidth) onClose?.();
    };

    const handleCancelNewPlan = () => {
        setPendingContent(null);
        setPendingPlanName('');
    };

    const handleLoadPlan = (planId: string) => {
        const plan = usePlanStore.getState().getPlan(planId);
        if (!plan || currentPlanId === planId) return;

        runTransition(async () => {
            // Save current session before switching
            if (currentPlanId) {
                const snapshot = getSnapshot();
                updatePlan(currentPlanId, { data: snapshot });
                // アーカイブ/サイレント圧縮プランなら再圧縮
                const currentPlan = usePlanStore.getState().plans.find(p => p.id === currentPlanId);
                if (currentPlan?.archived || currentPlan?.compressedData) {
                    usePlanStore.getState().archivePlan(currentPlanId);
                }
            }

            // サイレント圧縮されている場合は解凍
            let planData = plan.data;
            if ((!planData || Object.keys(planData).length === 0) && plan.compressedData) {
                try {
                    planData = await decompressPlanData(plan.compressedData);
                    usePlanStore.getState().updatePlan(plan.id, { data: planData, compressedData: undefined });
                } catch {
                    showToast(t('app.decompress_error') || 'データの読み込みに失敗しました。ページを更新してください。ログインしていない場合、データが復元できないことがあります。', 'error');
                    return;
                }
            }

            // Load new plan (根治: 持ち主 ID を記録して保存先を確定)
            loadSnapshot(planData, planId);
            setCurrentPlanId(planId);
            setSelectedContentId(plan.contentId);
            const c = plan.contentId ? getContentById(plan.contentId) : undefined;
            const newLevel = (c?.level ?? plan.level ?? planData.currentLevel ?? 100) as ContentLevel;
            if (c) {
                if (c.category === 'savage') setActiveTab('savage');
                else if (c.category === 'ultimate') setActiveTab('ultimate');
                else setActiveTab('other');
            } else {
                setActiveTab('other');
            }
            useMitigationStore.getState().setCurrentLevel(newLevel);
            // lastOpenedAt を更新
            setLastOpened(planId, Date.now());
        }, 'plan');
    };

    return {
        handleSelectContent,
        handleConfirmNewPlan,
        handleCancelNewPlan,
        handleLoadPlan,
    };
}
