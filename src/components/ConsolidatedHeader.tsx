import React, { useContext } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { PartyStatusPopover } from './PartyStatusPopover';
import { LoginModal } from './LoginModal';
import { HeaderTitleArea } from './header/HeaderTitleArea';
import { HeaderTopActions } from './header/HeaderTopActions';
import { HeaderToolbar } from './header/HeaderToolbar';
import { HeaderCollapseHandle } from './header/HeaderCollapseHandle';
import { useHeaderContentLabel } from './header/useHeaderContentLabel';

interface ConsolidatedHeaderProps {
    onAutoPlan: () => void;
    onImportLogs: () => void;
    partySortOrder: 'light_party' | 'role';
    setPartySortOrder: (order: 'light_party' | 'role') => void;
    statusOpen: boolean;
    setStatusOpen: (open: boolean) => void;
    /** 閲覧専用モード: 部屋のコンテンツID・オーナーラベルを渡す。省略時は従来動作。 */
    viewer?: { contentId: string | null; ownerLabel: string | null };
    /**
     * 閲覧専用モード時のみ有効。ヘッダー右グループ(ShareButtons の代替)に挿入するノード。
     * 未指定(undefined)のとき従来の ShareButtons を表示。viewer が未指定のときは無視される。
     */
    viewerCluster?: React.ReactNode;
}

// SyncButton は ./SyncButton.tsx に共有コンポーネントとして切り出し済み

export const ConsolidatedHeader: React.FC<ConsolidatedHeaderProps> = ({
    onAutoPlan,
    onImportLogs,
    partySortOrder,
    setPartySortOrder,
    statusOpen,
    setStatusOpen,
    viewer,
    viewerCluster,
}) => {
    /** 閲覧専用モード: Task 3 でボタン無効化に再利用 */
    const readOnly = viewer != null;
    const { isHeaderCollapsed } = useContext(MobileTriggersContext);
    const [showLoginModal, setShowLoginModal] = React.useState(false);

    // ログイン成功時: LoginModalを自動で閉じる（ウェルカム表示はLayout.tsxで一括管理）
    const justLoggedIn = useAuthStore((s) => s.justLoggedInUser);
    React.useEffect(() => {
        if (justLoggedIn) setShowLoginModal(false);
    }, [justLoggedIn]);

    // 現在開いているプラン・コンテンツ名
    const currentPlan = usePlanStore(state => state.plans.find(p => p.id === state.currentPlanId));
    const contentLabel = useHeaderContentLabel(readOnly, viewer, currentPlan);

    return (

        <motion.div
            className="absolute top-0 w-full z-[100] flex flex-col pointer-events-none"
            style={{ left: '-1px', width: 'calc(100% + 1px)' }}
            initial={false}
        >
            {/* [1] ── ヘッダー本体コンテナ ── */}
            <motion.div
                initial={false}
                animate={{
                    height: isHeaderCollapsed ? 0 : 101,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className="w-full overflow-hidden pointer-events-auto frame-surface glass-frame glass-border-b-0 glass-border-l-0 glass-shadow-none"
            >
                <div
                    className="flex flex-col w-full h-[96px] pt-[5px]"
                >
                    {/* Layer A（上段）: 左=ナビ+タイトル / 右=共有+チュートリアル+設定（固定） */}
                    <div className="h-12 flex items-center px-6 border-b border-app-border shrink-0 overflow-x-hidden overflow-y-visible">
                        {/* ── 左グループ（余ったスペースを使う） ── */}
                        <HeaderTitleArea
                            readOnly={readOnly}
                            viewer={viewer}
                            currentPlan={currentPlan}
                            contentLabel={contentLabel}
                            isHeaderCollapsed={isHeaderCollapsed}
                        />

                        {/* ── 右グループ（固定位置・絶対に動かない） ── */}
                        <HeaderTopActions
                            readOnly={readOnly}
                            viewerCluster={viewerCluster}
                            currentPlan={currentPlan}
                            contentLabel={contentLabel}
                            onOpenLogin={() => setShowLoginModal(true)}
                        />
                    </div>

                    {/* Layer B（下段・表に近い）: ツールボタン群 */}
                    <HeaderToolbar
                        onAutoPlan={onAutoPlan}
                        onImportLogs={onImportLogs}
                        partySortOrder={partySortOrder}
                        setPartySortOrder={setPartySortOrder}
                        statusOpen={statusOpen}
                        setStatusOpen={setStatusOpen}
                        readOnly={readOnly}
                    />
                </div>
            </motion.div>

            {/* [2] ── 常設ハンドル領域 ── */}
            <HeaderCollapseHandle readOnly={readOnly} />

            <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />

            {/* ログインモーダル */}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </motion.div>
    );
};
