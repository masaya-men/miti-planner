import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasContentRegistry } from '../lib/contentSelection';
import type { ContentLevel, ContentCategory } from '../types';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { PLAN_LIMITS } from '../types/firebase';
import { LoginModal } from './LoginModal';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton, CloseButton } from './ui/ModalParts';
import { useNewPlanSelection } from './newPlan/useNewPlanSelection';
import { createNewPlan } from './newPlan/createNewPlan';
import { NewPlanLevelCategoryTabs } from './newPlan/NewPlanLevelCategoryTabs';
import { NewPlanContentFields } from './newPlan/NewPlanContentFields';
import { NewPlanLimitWarning } from './newPlan/NewPlanLimitWarning';

interface NewPlanModalProps {
    isOpen: boolean;
    onClose: (created?: { contentId: string | null; level: ContentLevel; category: ContentCategory }) => void;
    /** 指定時: 開いた瞬間にこのコンテンツ(零式/絶)をレベル・カテゴリ・ボス込みで選択済みにし、
        タイトル入力にフォーカスする。MIL-SPEC のコンテンツツリー「＋追加」用。 */
    initialContentId?: string | null;
}

export const NewPlanModal: React.FC<NewPlanModalProps> = ({ isOpen, onClose, initialContentId }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'en' ? 'en' : 'ja';

    const { plans, updatePlan, currentPlanId: activePlanId } = usePlanStore();
    const { getSnapshot } = useMitigationStore();
    const user = useAuthStore(s => s.user);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 件数制限チェック
    const totalPlanCount = plans.length;
    const isTotalLimitReached = totalPlanCount >= PLAN_LIMITS.MAX_TOTAL_PLANS;
    const isArchiveWarning = totalPlanCount >= PLAN_LIMITS.ARCHIVE_WARNING_THRESHOLD;

    const {
        level, setLevel, category, setCategory, boss, title, setTitle,
        titleInputRef, filteredBosses, handleBossSelect,
    } = useNewPlanSelection(isOpen, initialContentId);

    // バリデーション
    const isLevelSelected = level !== null;
    const isCategorySelected = category !== null;
    const hasBossOrFreeInput = hasContentRegistry(category)
        ? boss !== null  // 零式・絶: ドロップダウンから選択必須
        : title.trim().length > 0;  // その他: 名前入力必須
    const canCreate = isLevelSelected && isCategorySelected && hasBossOrFreeInput && title.trim().length > 0;

    // 選択中コンテンツの件数チェック
    const contentPlanCount = boss ? plans.filter(p => p.contentId === boss.id).length : 0;
    const isContentLimitReached = boss ? contentPlanCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT : false;
    const isBlocked = isTotalLimitReached || isContentLimitReached;

    const handleCreate = () => {
        if (!canCreate || isBlocked || !level) return;
        createNewPlan({ level, boss, category, title, activePlanId, updatePlan, getSnapshot, onClose });
    };

    // Enterキーで作成
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && canCreate && !isBlocked) {
            e.preventDefault();
            handleCreate();
        }
    };

    if (!isOpen) return null;

    // 未入力項目の案内メッセージ
    const getMissingMessage = (): string | null => {
        if (!isLevelSelected) return t('new_plan.select_level');
        if (!isCategorySelected) return t('new_plan.select_category');
        if (hasContentRegistry(category) && !boss) return t('new_plan.select_content');
        if (!title.trim()) return t('new_plan.enter_name');
        return null;
    };
    const missingMessage = getMissingMessage();

    return (<>
        <ModalShell
            isOpen
            onClose={() => onClose()}
            className="w-full max-w-[440px]"
            style={{ maxHeight: 'min(720px, calc(100vh - 64px))' }}
            panelProps={{ 'data-tutorial-modal': true, onKeyDown: handleKeyDown }}
        >
                    {/* Header */}
                    <ModalHeader
                        title={t('new_plan.modal_title')}
                        extra={
                            <span data-tutorial="new-plan-close" className="inline-flex">
                                <CloseButton onClick={() => onClose()} label={t('common.close')} />
                            </span>
                        }
                    />

                    <div className="p-6 space-y-7 overflow-y-auto no-scrollbar">
                        <NewPlanLevelCategoryTabs
                            level={level}
                            setLevel={setLevel}
                            category={category}
                            setCategory={setCategory}
                            lang={lang}
                        />
                        <NewPlanContentFields
                            level={level}
                            category={category}
                            boss={boss}
                            title={title}
                            setTitle={setTitle}
                            titleInputRef={titleInputRef}
                            filteredBosses={filteredBosses}
                            handleBossSelect={handleBossSelect}
                            lang={lang}
                        />
                    </div>

                    <NewPlanLimitWarning
                        isBlocked={isBlocked}
                        isArchiveWarning={isArchiveWarning}
                        isTotalLimitReached={isTotalLimitReached}
                        isContentLimitReached={isContentLimitReached}
                    />

                    {/* Footer */}
                    <ModalFooter className="flex-wrap">
                        {/* 非ログイン時のさりげない案内 */}
                        {!user && (
                            <p className="w-full text-app-base text-app-text-muted text-center leading-relaxed">
                                {t('new_plan.guest_hint')
                                    .split(/<\/?login>/)
                                    .map((part, i) =>
                                        i === 1 ? (
                                            <button
                                                key="login"
                                                onClick={() => setShowLoginModal(true)}
                                                className="underline hover:text-app-text transition-colors cursor-pointer"
                                            >
                                                {part}
                                            </button>
                                        ) : (
                                            <span key={i}>{part}</span>
                                        )
                                    )}
                            </p>
                        )}
                        {/* 未入力項目の案内 */}
                        {missingMessage && !isBlocked && (
                            <p className="w-full text-app-base text-app-text-muted text-center">{missingMessage}</p>
                        )}
                        <ModalButton variant="secondary" onClick={() => onClose()}>
                            {t('new_plan.cancel_button')}
                        </ModalButton>
                        <ModalButton
                            data-tutorial="create-plan-btn"
                            variant="primary"
                            onClick={handleCreate}
                            disabled={!canCreate || isBlocked}
                        >
                            {t('new_plan.create_button')}
                        </ModalButton>
                    </ModalFooter>
        </ModalShell>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>);
};
