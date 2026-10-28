import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { LoPoButton } from '../LoPoButton';
import { usePlanStore } from '../../store/usePlanStore';
import { Tooltip } from '../ui/Tooltip';
import { SyncButton } from '../SyncButton';
import type { SavedPlan } from '../../types';

interface HeaderTitleAreaProps {
    readOnly: boolean;
    viewer?: { contentId: string | null; ownerLabel: string | null };
    currentPlan: SavedPlan | undefined;
    contentLabel: string | null;
    isHeaderCollapsed: boolean;
}

/** 上段の左グループ: ホームへ戻る + コンテンツ名 + プラン名(ダブルクリックで編集) */
export const HeaderTitleArea: React.FC<HeaderTitleAreaProps> = ({
    readOnly,
    viewer,
    currentPlan,
    contentLabel,
    isHeaderCollapsed,
}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    // ヘッダーのプラン名インライン編集
    const [editingHeaderTitle, setEditingHeaderTitle] = React.useState(false);
    const [headerTitleDraft, setHeaderTitleDraft] = React.useState('');
    const headerTitleInputRef = React.useRef<HTMLInputElement>(null);

    const startHeaderEdit = () => {
        if (!currentPlan) return;
        setHeaderTitleDraft(currentPlan.title);
        setEditingHeaderTitle(true);
        setTimeout(() => headerTitleInputRef.current?.select(), 0);
    };

    const finishHeaderEdit = () => {
        if (editingHeaderTitle && headerTitleDraft.trim() && currentPlan) {
            usePlanStore.getState().updatePlan(currentPlan.id, { title: headerTitleDraft.trim() });
        }
        setEditingHeaderTitle(false);
    };

    return (
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
            <Tooltip content={t('app.return_home')}>
                <div className="shrink-0">
                    <LoPoButton size="sm" onClick={() => navigate('/')} />
                </div>
            </Tooltip>

            {/* viewer モード: 部屋の contentId からコンテンツ名を表示（ownerLabel があればタイトルも） */}
            {readOnly && (contentLabel || viewer!.ownerLabel) && (
                <div className="flex items-baseline gap-2" style={{ minWidth: 0, overflow: 'hidden', flex: '1 1 0%' }}>
                    {contentLabel && (
                        <span
                            className={clsx(
                                "text-app-text leading-tight whitespace-nowrap shrink-0",
                                i18n.language.startsWith('ja') ? "text-app-4xl" : "text-app-5xl"
                            )}
                            style={{
                                fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif",
                                fontWeight: 700,
                                letterSpacing: i18n.language.startsWith('ja') ? '-0.02em' : '0.04em',
                                ...(i18n.language.startsWith('ja') ? { transform: 'scaleY(1.18)', transformOrigin: 'center' } : {}),
                            }}
                        >
                            {contentLabel}
                        </span>
                    )}
                    {viewer!.ownerLabel && viewer!.ownerLabel !== contentLabel && (
                        <div
                            className="text-app-xl text-app-text tracking-wider uppercase"
                            style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: '1 1 0%',
                                minWidth: 0,
                            }}
                        >
                            {viewer!.ownerLabel}
                        </div>
                    )}
                </div>
            )}
            {/* 通常モード: usePlanStore の currentPlan からコンテンツ名・タイトルを表示 */}
            {!readOnly && currentPlan && (
                <div className="flex items-baseline gap-2" style={{ minWidth: 0, overflow: 'hidden', flex: '1 1 0%' }}>
                    {contentLabel && (
                        <span
                            className={clsx(
                                "text-app-text leading-tight whitespace-nowrap shrink-0",
                                i18n.language.startsWith('ja') ? "text-app-4xl" : "text-app-5xl"
                            )}
                            style={{
                                fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif",
                                fontWeight: 700,
                                letterSpacing: i18n.language.startsWith('ja') ? '-0.02em' : '0.04em',
                                ...(i18n.language.startsWith('ja') ? { transform: 'scaleY(1.18)', transformOrigin: 'center' } : {}),
                            }}
                        >
                            {contentLabel}
                        </span>
                    )}
                    {currentPlan.title && currentPlan.title !== contentLabel && (
                        editingHeaderTitle ? (
                            <input
                                ref={headerTitleInputRef}
                                autoFocus
                                value={headerTitleDraft}
                                onChange={e => setHeaderTitleDraft(e.target.value)}
                                onBlur={finishHeaderEdit}
                                onKeyDown={e => { if (e.key === 'Enter') finishHeaderEdit(); if (e.key === 'Escape') setEditingHeaderTitle(false); }}
                                className="text-[16px] md:text-app-xl text-app-text tracking-wider uppercase min-w-0 bg-transparent border-b border-app-text/30 outline-none font-inherit"
                                style={{ fontFamily: 'inherit', fontWeight: 'inherit', flex: '1 1 0%' }}
                            />
                        ) : (
                            <div
                                className="text-app-xl text-app-text tracking-wider uppercase cursor-pointer hover:border-b hover:border-app-text/20"
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: '1 1 0%',
                                    minWidth: 0,
                                }}
                                onDoubleClick={startHeaderEdit}
                            >
                                {currentPlan.title}
                            </div>
                        )
                    )}
                    {/* 保存インジケータ — プラン名の直後に表示（フォーカスモード時は右パネルに移動するため非表示） */}
                    {!isHeaderCollapsed && <SyncButton size={16} className="px-1.5 py-1" showLabel />}
                </div>
            )}
        </div>
    );
};
