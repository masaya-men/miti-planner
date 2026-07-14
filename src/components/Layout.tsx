import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCollabSessionStore } from '../store/useCollabSessionStore';
import { reconcileCollabForPlan } from '../lib/collab/collabLifecycle';
import { shouldRestoreMitigationFromPlan } from '../lib/bootstrapMitigation';
import { persistWorkingStore } from '../lib/persistWorkingStore';
import { Sidebar } from './Sidebar';
import { LocalDataSafetyAutoPrompt } from './LocalDataSafetyAutoPrompt';
import { ConsolidatedHeader } from './ConsolidatedHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileShareController } from './collab/MobileShareController';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { AppFooter } from './AppFooter';
import { Loader2, Sun, Moon, Star, Users } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { SyncButton } from './SyncButton';
import { showToast } from './Toast';
import { WelcomeSetup } from './WelcomeSetup';
import { motion } from 'framer-motion';
import clsx from 'clsx';
// import { ParticleBackground } from './ParticleBackground';
import { MobileHeader } from './MobileHeader';
import { MobileFAB } from './MobileFAB';
import { GridOverlay } from './GridOverlay';
import { MobilePartyWithTabs, MobileAccountMenu } from './MobilePartySettings';
import { AetherflowChainPromptModal } from './AetherflowChainPromptModal';
import { AstrologianDrawChainPromptModal } from './AstrologianDrawChainPromptModal';
import { LocalImportDialog } from './LocalImportDialog';
import { useLocalImportDialog } from '../store/useLocalImportDialog';
import { ShareImportSheet } from './ShareImportSheet';
import { LimitResolutionSheet } from './LimitResolutionSheet';
import { getToken } from 'firebase/app-check';
import { ensureAppCheck, auth } from '../lib/firebase';

const PipView = React.lazy(() => import('./PipView'));

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const navigate = useNavigate();
    const plans = usePlanStore(s => s.plans);
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    // サイドバー開閉: プラン未選択なら強制オープン、それ以外はlocalStorage記憶
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => {
        if (typeof window === 'undefined') return true;
        if (window.innerWidth < 768) return false;
        const stored = localStorage.getItem('lopo_sidebar_open');
        return stored !== null ? stored === 'true' : true;
    });
    // 開閉を記憶
    const handleToggleSidebar = () => {
        const next = !isSidebarOpen;
        setIsSidebarOpen(next);
        localStorage.setItem('lopo_sidebar_open', String(next));
    };
    // プラン0件なら強制的に開く
    React.useEffect(() => {
        if (plans.length === 0 || !currentPlanId) setIsSidebarOpen(true);
    }, [plans.length, currentPlanId]);
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore(
        useShallow(s => ({ myJobHighlight: s.myJobHighlight, setMyJobHighlight: s.setMyJobHighlight }))
    );
    const hideEmptyRows = useMitigationStore(s => s.hideEmptyRows);

    // モバイル判定（md: 768px）
    const [isMobile, setIsMobile] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    React.useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Mobile modal triggers — these are read by Timeline.tsx via the store
    const [mobilePartyOpen, setMobilePartyOpen] = React.useState(false);
    const [mobileStatusOpen, setMobileStatusOpen] = React.useState(false);
    const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [mobileLoginModalOpen, setMobileLoginModalOpen] = React.useState(false);
    const [mobileAccountOpen, setMobileAccountOpen] = React.useState(false);
    const [mobileShareOpen, setMobileShareOpen] = React.useState(false);
    const [mobileCueSheet, setMobileCueSheet] = React.useState(false);
    const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore(
        useShallow(s => ({ timelineSortOrder: s.timelineSortOrder, setTimelineSortOrder: s.setTimelineSortOrder }))
    );
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);
    const [isHeaderNear, setIsHeaderNear] = React.useState(false);
    // チュートリアル中ならサイドバーを強制的に開く
    const isTutorialActive = useTutorialStore((state) => state.isActive);
    React.useEffect(() => {
        if (isTutorialActive) {
            setIsSidebarOpen(true);
            setIsHeaderCollapsed(false);
            // チュートリアル中はモバイル用シートをすべて閉じる
            setMobileMenuOpen(false);
            setMobilePartyOpen(false);
            setMobileStatusOpen(false);
            setMobileToolsOpen(false);
            setMobileAccountOpen(false);
        }
    }, [isTutorialActive]);

    // iOS キーボード閉じた後のビューポートずれ修正
    React.useEffect(() => {
        if (!isMobile) return;
        const vv = window.visualViewport;
        if (!vv) return;
        let prevHeight = vv.height;
        const handleResize = () => {
            const newHeight = vv.height;
            // キーボードが閉じた（高さが増えた）
            if (newHeight > prevHeight + 50) {
                window.scrollTo(0, 0);
                document.documentElement.style.height = '100%';
                requestAnimationFrame(() => {
                    document.documentElement.style.height = '';
                });
            }
            prevHeight = newHeight;
        };
        // input/textareaのblur時にもスクロール位置をリセット
        const handleFocusOut = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                setTimeout(() => {
                    window.scrollTo(0, 0);
                }, 100);
            }
        };
        vv.addEventListener('resize', handleResize);
        document.addEventListener('focusout', handleFocusOut);
        return () => {
            vv.removeEventListener('resize', handleResize);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, [isMobile]);

    // スマホ用カンペビューイベント
    React.useEffect(() => {
        const open = () => setMobileCueSheet(true);
        window.addEventListener('mobile:open-cue-sheet', open);
        return () => window.removeEventListener('mobile:open-cue-sheet', open);
    }, []);

    // キーボードショートカット（PCのみ）
    // F: フォーカスモード（サイドバー+ヘッダー両方非表示/復元）
    // S: サイドバー開閉
    // H: ヘッダー開閉
    // P/T/L/A: Timeline.tsx側で処理
    const focusModeRef = React.useRef(false);
    React.useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (isMobile) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const key = e.key.toLowerCase();
            if (key === 's') {
                e.preventDefault();
                handleToggleSidebar();
            } else if (key === 'h') {
                e.preventDefault();
                setIsHeaderCollapsed(prev => !prev);
            } else if (key === 'f') {
                e.preventDefault();
                if (!focusModeRef.current) {
                    // フォーカスモードに入る: サイドバー閉じ＋ヘッダー折りたたみ
                    setIsSidebarOpen(false);
                    localStorage.setItem('lopo_sidebar_open', 'false');
                    setIsHeaderCollapsed(true);
                    focusModeRef.current = true;
                } else {
                    // フォーカスモードから抜ける: 常にサイドバー開＋ヘッダー展開
                    setIsSidebarOpen(true);
                    localStorage.setItem('lopo_sidebar_open', 'true');
                    setIsHeaderCollapsed(false);
                    focusModeRef.current = false;
                }
            }
        };
        const handleExitFocus = () => {
            if (focusModeRef.current) {
                setIsSidebarOpen(true);
                localStorage.setItem('lopo_sidebar_open', 'true');
                setIsHeaderCollapsed(false);
                focusModeRef.current = false;
            }
        };
        // チュートリアル等でキー操作の代わりにフォーカスモードへ入る (Fキー押下と同じ効果)。
        // タブレット/スマホはキーボードが無いため、タップから本イベントで発火させる。
        // PC/タブレット (非モバイル) のみ実フォーカスモードに入る。
        const handleEnterFocus = () => {
            if (isMobile) return;
            if (!focusModeRef.current) {
                setIsSidebarOpen(false);
                localStorage.setItem('lopo_sidebar_open', 'false');
                setIsHeaderCollapsed(true);
                focusModeRef.current = true;
            }
        };
        window.addEventListener('keydown', handleShortcut);
        window.addEventListener('shortcut:exit-focus', handleExitFocus);
        window.addEventListener('shortcut:enter-focus', handleEnterFocus);
        return () => {
            window.removeEventListener('keydown', handleShortcut);
            window.removeEventListener('shortcut:exit-focus', handleExitFocus);
            window.removeEventListener('shortcut:enter-focus', handleEnterFocus);
        };
    }, [isMobile, isSidebarOpen, isHeaderCollapsed]);

    // リモートデータ読み込み中フラグ（PULL/マイグレーション時のdirty marking防止）
    const isRemoteLoadingRef = React.useRef(false);

    // 起動時 desync 復旧 (hydration gate / bootstrapping)。
    // currentPlanId は非空プランを指すのに作業ストアが空 = キャッシュ全消し等の desync。
    // 真実 (plan.data) を作業ストアへ復元し、空のまま見える/空上書きの引き金になるのを防ぐ。
    // localStorage persist は同期復元済みなのでマウント時点で state は揃っている。
    React.useEffect(() => {
        const { currentPlanId, plans } = usePlanStore.getState();
        const plan = plans.find(p => p.id === currentPlanId);
        if (shouldRestoreMitigationFromPlan({
            currentPlanId,
            plan,
            mitigationSnapshot: useMitigationStore.getState().getSnapshot(),
        }) && plan?.data) {
            isRemoteLoadingRef.current = true;
            useMitigationStore.getState().loadSnapshot(plan.data, currentPlanId!);
            isRemoteLoadingRef.current = false;
        } else if (currentPlanId) {
            // 通常起動: 作業ストア(persist 復元済)は currentPlanId を表している → 持ち主を記録。
            // これが無いと初回保存で _loadedPlanId=null となり保存がスキップされる。
            useMitigationStore.getState().setLoadedPlanId(currentPlanId);
        }
    }, []);

    // collab ライフサイクル管制: 「見ているプラン = 接続先」を常に一致させる。
    // collab 中に別プランへ移ったら必ず disconnect (exitCollabMode + unobserve) し、
    // 切替先プランをローカル再ロードする (collab 中 loadSnapshot は no-op だったので張り直す)。
    // ⚠ 配置順が重要: この subscribe は下の自動保存 subscribe より先に登録する。
    //   さもないと自動保存の saveSilently が新プランへ旧(collab)データを書き戻してしまう。
    //   先に disconnect+再ロードで mitistore を新プランに直してから自動保存が走る。
    React.useEffect(() => {
        let prev = usePlanStore.getState().currentPlanId;
        const unsub = usePlanStore.subscribe((state) => {
            const newId = state.currentPlanId;
            if (newId === prev) return;
            prev = newId;
            // 管制本体は collabLifecycle に切り出し済 (回帰テスト collabLifecycle.test.ts)。
            reconcileCollabForPlan(newId);
        });
        // auth 確定でオーナー判定が変わる。ログインが解決した瞬間に現在プランを再評価し、
        // collab-ON の自分のプランならライブ接続を復帰させる (リロード時 auth 未確定対策)。
        // 既に正しく接続済みなら decideCollabAction は 'none' を返すので冪等 (二重接続しない)。
        let prevUid = useAuthStore.getState().user?.uid ?? null;
        const unsubAuth = useAuthStore.subscribe((state) => {
            const uid = state.user?.uid ?? null;
            if (uid === prevUid) return;
            prevUid = uid;
            if (uid) reconcileCollabForPlan(usePlanStore.getState().currentPlanId);
        });
        // ページ離脱時もセッションを切断 (端末メモリ汚染を残さない)。
        const onUnload = () => useCollabSessionStore.getState().session?.disconnect();
        window.addEventListener('beforeunload', onUnload);
        // 初回マウント: 既に collab-ON のプランが開かれていればオーナーは自動接続 (リロード復帰)。
        // この時点で auth 未確定なら上の unsubAuth が確定後に拾う。
        reconcileCollabForPlan(usePlanStore.getState().currentPlanId);
        return () => { unsub(); unsubAuth(); window.removeEventListener('beforeunload', onUnload); };
    }, []);

    // 自動保存（2層構造）
    // localStorage: 変更検知→500msデバウンス→即時保存（コストゼロ）
    // Firestore: イベント駆動（ページ離脱 / タブ非表示 / プラン切替時）+ 5分定期バックアップ
    React.useEffect(() => {
        /** localStorage への保存。
         * 根治: 保存先は「今 UI が見ている表(currentPlanId)」ではなく
         * 「作業ストアが載せている表の持ち主(_loadedPlanId)」。表を素早く切り替えた
         * 一瞬に両者がズレても、データは自分の表以外に書き込まれない(切替先を空で潰さない)。 */
        const saveSilently = () => {
            const mitiStore = useMitigationStore.getState();
            persistWorkingStore({
                loadedPlanId: mitiStore._loadedPlanId,
                getSnapshot: () => mitiStore.getSnapshot(),
                updatePlan: (id, patch) => usePlanStore.getState().updatePlan(id, patch),
            });
        };

        /** Firestoreへの同期（ログイン中 + dirtyがある場合のみ）
         * @param force trueならクールダウン無視（タブ切替・ページ離脱時）
         */
        const syncToCloud = (force = false) => {
            // 共同編集中は Firestore への確定保存を抑制(2クライアントの後勝ち上書き合戦を防ぐ)。
            // localStorage の saveSilently は継続。恒久保存は段取り③で DO が代表実施(設計書 §2-2)。
            if (useMitigationStore.getState()._collabActive) return;
            const authState = useAuthStore.getState();
            const planStore = usePlanStore.getState();
            if (authState.user && planStore.hasDirtyPlans()) {
                const profileName = useAuthStore.getState().profileDisplayName || 'User';
                planStore.syncToFirestore(
                    authState.user.uid,
                    profileName,
                    force,
                ).catch((err) => {
                    console.error('[LoPo] Firestore同期エラー:', err);
                });
            }
        };

        /** Firestoreから最新データを取得（ログイン中のみ）
         *  isRemoteLoadingRefでsubscriptionのdirty markingを抑制
         *  notifyUser=true のときのみトーストを表示（手動 / タブ復帰時のみ） */
        const pullFromCloud = (notifyUser = false) => {
            const authState = useAuthStore.getState();
            if (authState.user) {
                isRemoteLoadingRef.current = true;
                usePlanStore.getState().pullFromFirestore(
                    authState.user.uid,
                ).then(() => {
                    if (notifyUser) showToast(t('app.sync_pull_success'), 'info');
                }).catch((err) => {
                    console.error('[LoPo] Firestore PULL エラー:', err);
                    if (notifyUser) showToast(t('app.sync_pull_error'), 'error');
                }).finally(() => {
                    isRemoteLoadingRef.current = false;
                });
            }
        };

        let localDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        // useMitigationStoreの変更を監視 → localStorageへ500msデバウンス保存
        const unsubMiti = useMitigationStore.subscribe((state, prevState) => {
            // 同じ参照なら何もしない（不要な保存を防止）
            if (state.timelineMitigations === prevState.timelineMitigations
                && state.timelineEvents === prevState.timelineEvents
                && state.phases === prevState.phases
                && state.partyMembers === prevState.partyMembers) return;
            // リモートからの読み込み中は保存・同期をスキップ（dirty循環防止）
            if (isRemoteLoadingRef.current) return;
            // プランが選択されていなければスキップ
            const planIdAtChange = usePlanStore.getState().currentPlanId;
            if (!planIdAtChange) return;

            // インジケーター: 「保存中...」
            usePlanStore.getState().setSaveStatus('saving');

            // localStorage: 500msデバウンス（ブラウザ内保存なのでコストゼロ）
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            localDebounceTimer = setTimeout(() => {
                // 500ms後にplanIdが変わっていたらプラン切替中だったのでスキップ
                // （旧プランに新データを保存するデータ破損を防止）
                const currentId = usePlanStore.getState().currentPlanId;
                if (currentId !== planIdAtChange) return;
                saveSilently();
                usePlanStore.getState().setSaveStatus('saved');
                // クラウド同期も試行（3分クールダウンで自動的に間引かれる）
                syncToCloud();
            }, 500);
        });

        /** ページ離脱時: localStorage即時保存 + Firestore同期（クールダウン無視）
         *  プラン編集中はブラウザ標準の離脱確認ダイアログを表示 */
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            // プラン編集中なら離脱確認を表示
            if (usePlanStore.getState().currentPlanId) {
                e.preventDefault();
                e.returnValue = '';  // Chrome/Edge互換
            }
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            saveSilently();
            syncToCloud(true);
        };

        /** タブ切替時:
         * 非表示 → localStorage保存 + Firestore PUSH
         * 再表示 → Firestore PULL（他端末の変更を取得）
         */
        const onVisibilityChange = () => {
            if (document.hidden) {
                if (localDebounceTimer) clearTimeout(localDebounceTimer);
                saveSilently();
                syncToCloud(true);  // タブ切替 = ユーザーの意図的操作 → クールダウン無視
                usePlanStore.getState().setSaveStatus('saved');
            } else {
                // タブ再表示 → PULL（他端末の変更を取得）/ ユーザーに通知
                pullFromCloud(true);
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('visibilitychange', onVisibilityChange);

        // プラン切替時: 旧プランをlocalStorage保存 + Firestore同期
        let prevPlanId = usePlanStore.getState().currentPlanId;
        const unsubPlan = usePlanStore.subscribe((state) => {
            const newId = state.currentPlanId;
            const oldId = prevPlanId;
            prevPlanId = newId; // 再入防止: saveSilently→updatePlan→subscribe再発火時にスキップさせる
            if (oldId && oldId !== newId) {
                // collab 中のプラン切替は管制(reconcileCollabForPlan)が disconnect+再ロードを担う。
                // ここで saveSilently すると mitistore の collab 部屋データを新プランへ誤保存し、
                // 管制の再ロードが汚染データを読む競合になる。collab 中は保存をスキップ
                // (collab の恒久保存は DO→Firestore が真実。順序非依存の防御層 = defense-in-depth)。
                if (useMitigationStore.getState()._collabActive) return;
                saveSilently();
                syncToCloud(true);  // プラン切替 = 意図的操作 → クールダウン無視
            }
        });

        // 5分ごとの定期同期（PUSH + PULL）
        const periodicSyncInterval = setInterval(() => {
            // PULLの前にローカル編集をflush（未保存の編集が上書きされるのを防止）
            saveSilently();
            syncToCloud();
            pullFromCloud();
        }, 5 * 60 * 1000);

        return () => {
            unsubMiti();
            unsubPlan();
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            clearInterval(periodicSyncInterval);
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [t]);

    // ログイン時のデータマイグレーション（localStorageのプランをFirestoreにアップロード）
    const authUser = useAuthStore((s) => s.user);
    const authLoading = useAuthStore((s) => s.loading);
    const [hasMigrated, setHasMigrated] = React.useState(false);

    // B-1 Revision 3: ローカル取り込みダイアログ
    const localImportOpen = useLocalImportDialog(s => s.isOpen);
    // 注: 以前ここに isImportPreparing / isAuthRedirecting state を持っていたが、
    // ユーザーフィードバックで「ログイン中 / 利用の準備中」 オーバーレイは不要との
    // 判断で撤去。 migrate / pullFromFirestore はバックグラウンドで継続実行する
    // (画面操作とは独立)。
    const closeLocalImportDialog = useLocalImportDialog(s => s.close);
    /**
     * 表示対象: ダイアログで取り込み候補にする plans。
     *
     * 設計: `ownerId === 'local'` (= 未アップロード) かつ
     * `_createdLoggedIn !== true` (= ログイン中に作られたものではない) のみ対象。
     *
     * 理由: ログイン中に作られたプランは Firestore SDK のオフラインキュー経由で
     * 自動同期されるため、 ユーザーに「取り込み確認」 を出す必要が無い。
     * このフィルタにより、 新規作成 / 複製 / コピー直後にリロードしても
     * 誤発火しなくなる。 未ログイン中に作られたプランのみ明示同意フローに乗る。
     */
    const localImportPlans = usePlanStore(
        useShallow(s => s.plans.filter(p =>
            p.ownerId === 'local' && p._createdLoggedIn !== true
        )),
    );

    const handleLocalImport = React.useCallback(
        async (
            planIds: string[],
            onProgress: (event: { id: string; status: 'uploading' | 'success' | 'failed'; error?: string }) => void,
        ): Promise<{ id: string; status: 'success' | 'failed'; error?: string }[]> => {
            const currentUser = useAuthStore.getState().user;
            if (!currentUser) return [];
            const profileName = useAuthStore.getState().profileDisplayName || 'User';
            // サマリーはダイアログ内のサマリーパネルで完結する (B-1 Rev3 仕上げ)。
            // 旧 toast (toast_success / toast_partial / toast_all_failed) は撤去済み。
            return await usePlanStore.getState().executeLocalImport(
                currentUser.uid,
                profileName,
                planIds,
                onProgress,
            );
        },
        [],
    );

    const handleLocalImportClose = React.useCallback(
        () => {
            closeLocalImportDialog();
        },
        [closeLocalImportDialog],
    );

    // ログアウト時（authUser=null）にフラグをリセット → 再ログイン時にmigrateOnLoginが再実行される
    React.useEffect(() => {
        if (!authUser) {
            setHasMigrated(false);
            usePlanStore.getState()._migrationDone && usePlanStore.setState({ _migrationDone: false });
        }
    }, [authUser, hasMigrated]);
    React.useEffect(() => {
        if (authLoading || !authUser || hasMigrated) return;
        setHasMigrated(true);
        // 注: 以前ここで setIsImportPreparing(true) して「ログイン中」 オーバーレイを
        // 表示していたが、 ユーザーフィードバックで撤去。 migrate / pullFromFirestore は
        // ユーザー操作とは独立にバックグラウンドで完了させる。
        const planStore = usePlanStore.getState();
        const profileName = useAuthStore.getState().profileDisplayName || 'User';
        planStore.migrateOnLogin(
            authUser.uid,
            profileName,
        ).then(() => {
            // マイグレーション後: Firestoreからマージした最新データをMitigationStoreに反映
            const { currentPlanId, plans } = usePlanStore.getState();
            if (currentPlanId) {
                const plan = plans.find(p => p.id === currentPlanId);
                if (plan?.data) {
                    isRemoteLoadingRef.current = true;
                    // 根治(I-2): 現在プランを再ロード → 持ち主IDも明示
                    useMitigationStore.getState().loadSnapshot(plan.data, currentPlanId);
                    isRemoteLoadingRef.current = false;
                }
            }
        }).catch((err) => {
            console.error('[LoPo] migrateOnLogin失敗、PULLで回復を試行:', err);
        }).finally(async () => {
            usePlanStore.setState({ _migrationDone: true });
            // PULL: 他端末の変更を確実に取得 (失敗しても致命ではないので無視)
            try {
                await planStore.pullFromFirestore(authUser.uid);
            } catch {
                // pull 失敗 → 次回 pull で回復
            }

            // B-1 Revision 3: ローカル取り込みダイアログを開く前に App Check + ID トークンを揃える
            // - OAuth リダイレクト直後は reCAPTCHA Enterprise トークン未取得で createPlan が permission-denied になる
            // - ダイアログを開く時点でトークン完備にしておけば、ユーザーが「取り込む」押下した瞬間に成功する
            try {
                const appCheck = ensureAppCheck();
                if (appCheck) {
                    // forceRefresh: true で確実に新規トークン取得 (post-OAuth キャッシュ空対策)
                    await getToken(appCheck, true);
                }
                if (auth.currentUser) {
                    await auth.currentUser.getIdToken(true);
                }
            } catch {
                // トークン取得失敗でもダイアログは出す (executeLocalImport で再試行可能)
            }

            // 自動トリガー: ローカルプランがあるときは常に表示する (Phase B-1.5 Task 11)
            // 旧 `lopo_local_import_dont_show` localStorage フラグは既存ユーザーの値を残したまま読み捨てる
            //
            // 注意: フィルタは localImportPlans (= ファイル上部の useShallow) と必ず一致させる。
            // `_createdLoggedIn === true` のプランはログイン中に作られた = 自動同期される
            // ため除外し、 誤発火を防ぐ。
            const localPlanCount = usePlanStore.getState().plans.filter(p =>
                p.ownerId === 'local' && p._createdLoggedIn !== true
            ).length;
            if (localPlanCount > 0) {
                // 微小ディレイ (40ms) は state コミット安定化のため残す
                setTimeout(() => {
                    useLocalImportDialog.getState().open();
                }, 40);
            }
        });
    }, [authUser, authLoading, hasMigrated]);

    // ベースの背景色（テーマ変数を参照するように変更）
    const bgClass = "bg-app-bg";

    // 初回ログイン判定
    const isNewUser = useAuthStore((s) => s.isNewUser);

    // リダイレクト認証の戻り検知（Discord/Twitter — ページロード前に即座に判定）
    // ※ Phase B-1.5 polish 第 2 弾 Rev 3: 一度撤去したが、 OAuth リダイレクト戻り時は
    //   実際にログイン処理中なので「ログイン中…」 オーバーレイは正しい用途として復活。
    //   migrate / pull だけのときに出ていた isImportPreparing オーバーレイは撤去のまま。
    const justLoggedInUser = useAuthStore((s) => s.justLoggedInUser);
    const [isAuthRedirecting, setIsAuthRedirecting] = React.useState(() =>
        localStorage.getItem('lopo_auth_redirecting') === 'true'
    );
    React.useEffect(() => {
        if (justLoggedInUser || !localStorage.getItem('lopo_auth_redirecting')) {
            setIsAuthRedirecting(false);
        }
    }, [justLoggedInUser]);

    return (
        <div data-app-shell className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 md:max-w-[var(--container-max)] md:mx-auto ${bgClass} relative`}>

            {/* 初回ログイン: ウェルカムセットアップ画面 */}
            {isNewUser && <WelcomeSetup />}

            {/* リダイレクト認証中オーバーレイ — Discord/Twitter からの戻り時、 processPendingAuth
                完了前に表示。 実際にログイン処理中の場面のみ出る。 */}
            {isAuthRedirecting && !justLoggedInUser && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-app-bg">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={28} className="animate-spin text-app-text-muted" />
                        <p className="text-app-2xl font-medium text-app-text-muted">{t('login.authenticating')}</p>
                    </div>
                </div>
            )}

            {/* 背景エフェクト — ParticleBackgroundは一時的に無効化 */}
            {/* <ParticleBackground /> */}
            <GridOverlay />

            {/* サイドバー — on PC: normal flow; on mobile: overlay drawer */}
{/* PC sidebar */}
            <div className="hidden md:block">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={handleToggleSidebar}
                    onClose={() => { setIsSidebarOpen(false); localStorage.setItem('lopo_sidebar_open', 'false'); }}
                />
            </div>

            {/* Mobile sidebar — slides up from bottom as a sheet */}
            <MobileBottomSheet
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                title={t('sidebar.menu')}
                height="calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px) - 8px)"
                fillContent
                headerAction={
                    <button
                        onClick={() => { setMobileMenuOpen(false); setMobilePartyOpen(true); }}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-full border border-app-border text-app-text hover:bg-app-text/10 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                        <Users size={15} />
                        <span className="text-app-sm font-bold whitespace-nowrap">{t('nav.party')}</span>
                    </button>
                }
            >
                <div className="flex-1 min-h-0 flex flex-col">
                    <Sidebar
                        isOpen={true}
                        fullWidth
                        onClose={() => setMobileMenuOpen(false)}
                        onAutoPlan={() => { setMobileMenuOpen(false); window.dispatchEvent(new CustomEvent('timeline:autoplan')); }}
                    />
                </div>
            </MobileBottomSheet>

            {/* Mobile: パーティ編成（タブでステータスも表示） */}
            <MobileBottomSheet
                isOpen={mobilePartyOpen}
                onClose={() => setMobilePartyOpen(false)}
                title={t('nav.party')}
                height="calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px) - 8px)"
            >
                <MobilePartyWithTabs />
            </MobileBottomSheet>

            <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative z-10">

                <MobileTriggersContext.Provider value={{
                    mobilePartyOpen, setMobilePartyOpen,
                    mobileStatusOpen, setMobileStatusOpen,
                    mobileToolsOpen, setMobileToolsOpen,
                    mobileMenuOpen, setMobileMenuOpen,
                    isHeaderCollapsed, setIsHeaderCollapsed,
                    isHeaderNear, setIsHeaderNear,
                    isSidebarOpen
                }}>
                    {/* ── PC Header ── */}
                    {/* ── Consolidated Floating Header (on PC) ── */}
                    <div className="hidden md:block h-0 relative z-[120]">
                        <ConsolidatedHeader
                        onAutoPlan={() => {
                            // Dispatch a custom event for Timeline.tsx or use a shared store
                            window.dispatchEvent(new CustomEvent('timeline:autoplan'));
                        }}
                        onImportLogs={() => {
                            window.dispatchEvent(new CustomEvent('timeline:import'));
                        }}
                        partySortOrder={timelineSortOrder}
                        setPartySortOrder={setTimelineSortOrder}
                        statusOpen={mobileStatusOpen}
                        setStatusOpen={setMobileStatusOpen}
                    />
                </div>

                {/* ── Mobile Header ── */}
                <MobileHeader
                    onHome={() => navigate('/')}
                    theme={theme}
                    onToggleTheme={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                />

                {/* Main content — モバイルはfixedヘッダー分のpaddingTop、PCはヘッダー開閉に連動 */}
                <motion.main
                    className={clsx("flex-1 flex flex-col relative overflow-hidden pb-0", !currentPlanId && "no-plan")}
                    initial={false}
                    animate={{ paddingTop: isMobile ? 0 : (isHeaderCollapsed ? 23 : 124) }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                >
                    {children}

                    {/* プラン未選択時 — 抽象イラスト + テキスト（ガラスはTimeline内に配置済み） */}
                    {!currentPlanId && (
                        <div className="absolute inset-0 pb-16 md:pb-0 z-[100] flex items-center justify-center pointer-events-none">
                            <div className="text-center empty-text-in">
                                {/* ハンバーガーメニューアイコン — PC:左からスライドイン / スマホ:上からスライドイン */}
                                <svg
                                    className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} mx-auto mb-4`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-1' : 'empty-burger-left-1'}`} />
                                    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-2' : 'empty-burger-left-2'}`} />
                                    <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-3' : 'empty-burger-left-3'}`} />
                                </svg>
                                <p className={`${isMobile ? 'text-app-2xl' : 'text-app-2xl-plus'} text-app-text font-medium tracking-[0.15em]`}>
                                    {t(isMobile ? 'app.empty_state_mobile' : 'app.empty_state_pc')}
                                </p>
                            </div>
                        </div>
                    )}
                </motion.main>

                {/* Footer — hidden on mobile, shown on PC */}
                <AppFooter />
                </MobileTriggersContext.Provider>
            </div>

            {/* 右罫線 — サイドバー左ハンドルと対称（PC only, フォーカスモード時のみ表示） */}
            <motion.div
                className="hidden md:flex flex-col h-full shrink-0 relative z-40 glass-tier3 glass-frame glass-border-t-0 glass-border-l-0 glass-shadow-none overflow-hidden"
                initial={false}
                animate={{ width: isHeaderCollapsed && !isSidebarOpen ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
                {/* 左端ライン（コンテンツとの境界） */}
                <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border" />
                {/* 右端ライン（画面端から1px内側 — 左側と同じ太さに2px） */}
                <div className="absolute inset-y-0 right-[1px] w-[2px] bg-app-border" />

                {/* フォーカスモード用ボタン — 狭い空間からんーーっぽん！と飛び出すアニメーション */}
                <div className="flex-1 flex flex-col items-center justify-center gap-1 w-6">
                    {[
                        { key: 'theme', delay: 0.6, render: () => (
                            <button
                                onClick={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                                className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-app-text transition-colors cursor-pointer rounded hover:bg-app-text/10 active:scale-90 focus:outline-none"
                            >
                                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                            </button>
                        )},
                        { key: 'highlight', delay: 0.75, render: () => (
                            <button
                                onClick={() => {
                                    const current = useMitigationStore.getState().myJobHighlight;
                                    setMyJobHighlight(!current);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-app-text transition-colors cursor-pointer rounded hover:bg-app-text/10 active:scale-90 focus:outline-none"
                            >
                                <Star size={14} className={myJobHighlight ? "fill-current text-app-text" : ""} />
                            </button>
                        )},
                        { key: 'sync', delay: 0.9, render: () => (
                            <SyncButton size={14} className="w-6 h-6 justify-center" />
                        )},
                    ].map(({ key, delay, render }) => (
                        <motion.div
                            key={key}
                            initial={{ scaleX: 0.3, scaleY: 0.1, opacity: 0 }}
                            animate={isHeaderCollapsed && !isSidebarOpen
                                ? { scaleX: 1, scaleY: 1, opacity: 1 }
                                : { scaleX: 0.3, scaleY: 0.1, opacity: 0 }
                            }
                            transition={{
                                type: "spring",
                                stiffness: 800,
                                damping: 8,
                                delay: isHeaderCollapsed && !isSidebarOpen ? delay : 0,
                            }}
                        >
                            {render()}
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* エーテルフロー連鎖配置プロンプト（SCH が手動で aetherflow を置いたとき） */}
            <AetherflowChainPromptModal />

            {/* 占星ドロー交互配置プロンプト（AST が手動で astral_draw / umbral_draw を置いたとき） */}
            <AstrologianDrawChainPromptModal />

            {/* Mobile FAB — テーマ/同期/言語/ナビ（チュートリアル中は非表示） */}
            {!isTutorialActive && isMobile && (
                <MobileFAB
                    onToggleTheme={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                    theme={theme}
                    onPhaseJump={() => window.dispatchEvent(new Event('mobile:phase-jump'))}
                    onLabelJump={() => window.dispatchEvent(new Event('mobile:label-jump'))}
                    onMechanicSearch={() => window.dispatchEvent(new Event('mobile:mechanic-search'))}
                    onToggleExpand={() => {
                        const store = useMitigationStore.getState();
                        store.setHideEmptyRows(!store.hideEmptyRows);
                    }}
                    hideEmptyRows={hideEmptyRows}
                />
            )}

            {/* Mobile Bottom Nav — 排他制御付きトグル（チュートリアル中は非表示） */}
            {!isTutorialActive && <MobileBottomNav
                onMenuToggle={() => {
                    const next = !mobileMenuOpen;
                    setMobileMenuOpen(next);
                    if (next) { setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                }}
                onImportToggle={() => {
                    const next = !mobileToolsOpen;
                    setMobileToolsOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                }}
                onCueToggle={() => {
                    setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); setMobileAccountOpen(false);
                    window.dispatchEvent(new Event('mobile:open-cue-sheet'));
                }}
                onShareToggle={() => {
                    const next = !mobileShareOpen;
                    setMobileShareOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileAccountOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                }}
                onLoginOpen={() => {
                    const authUser = useAuthStore.getState().user;
                    if (authUser) {
                        const next = !mobileAccountOpen;
                        setMobileAccountOpen(next);
                        if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false); window.dispatchEvent(new Event('mobile:close-miti-flow')); }
                    } else {
                        setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileShareOpen(false);
                        window.dispatchEvent(new Event('mobile:close-miti-flow'));
                        setMobileLoginModalOpen(true);
                    }
                }}
                activeTab={mobileMenuOpen ? 'menu' : mobileToolsOpen ? 'import' : mobileShareOpen ? 'share' : mobileAccountOpen ? 'login' : undefined}
            />}

            {/* Mobile: ログインモーダル（未ログイン時） */}
            <LoginModal isOpen={mobileLoginModalOpen} onClose={() => setMobileLoginModalOpen(false)} />

            {/* Mobile: アカウントシート（ログイン済み時） */}
            <MobileBottomSheet
                isOpen={mobileAccountOpen}
                onClose={() => setMobileAccountOpen(false)}
                title={t('nav.account')}
                height="auto"
            >
                <MobileAccountMenu onClose={() => setMobileAccountOpen(false)} />
            </MobileBottomSheet>

            {/* Mobile: 共有タブ = PC と同じ共有フローを起動(コピー/共同編集2択・オーナーパネル)。
                 専用シートは作らず既存モーダルを開く。カーソル共有UIはスマホでは隠す。 */}
            <MobileShareController
                isOpen={mobileShareOpen}
                onClose={() => setMobileShareOpen(false)}
            />

            {/* スマホ用カンペビュー（フルスクリーン） */}
            {mobileCueSheet && (
                <div className="fixed inset-0 z-[9999] bg-app-bg md:hidden">
                    <React.Suspense fallback={null}>
                        <PipView mode="fullscreen" onClose={() => setMobileCueSheet(false)} />
                    </React.Suspense>
                </div>
            )}

            {/* B-1 Revision 3: ローカル取り込みダイアログ */}
            <LocalImportDialog
                isOpen={localImportOpen}
                plans={localImportPlans}
                onImport={handleLocalImport}
                onClose={handleLocalImportClose}
            />

            {/* Phase B-1.5 Task 17: 共有 URL 自動取り込みシート。
                useShareImportFlow.status !== 'idle' のときだけ自前で描画する self-rendering 設計。
                /share/:shareId 経由で SharePage が start() を叩くと自動的に表示される。 */}
            <ShareImportSheet />
            <LocalDataSafetyAutoPrompt />
            {/* 上限解消シートはグローバル単一マウント（共有取込・スプシ取込の両方が setLimitContext で呼ぶ） */}
            <LimitResolutionSheet />
        </div>
    );
};