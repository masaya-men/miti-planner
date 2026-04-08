import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { TimelineEvent, LocalizedString } from '../types';

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function formatTimeDisplay(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function getEventName(event: TimelineEvent, lang: string): string {
    const name = event.name as string | LocalizedString;
    if (typeof name === 'string') return name;
    const loc = name as LocalizedString;
    if (lang === 'ja' && loc.ja) return loc.ja;
    if (lang === 'en' && loc.en) return loc.en;
    if (lang === 'zh' && loc.zh) return loc.zh ?? loc.en ?? loc.ja ?? '';
    if (lang === 'ko' && loc.ko) return loc.ko ?? loc.en ?? loc.ja ?? '';
    return loc.en || loc.ja || '';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MobileContextMenuProps {
    isOpen: boolean;
    onClose: () => void;
    event: TimelineEvent;
    time: number;
    onEdit: () => void;
    onAdd: () => void;
    onDelete: () => void;
    contentLanguage: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MobileContextMenu: React.FC<MobileContextMenuProps> = ({
    isOpen,
    onClose,
    event,
    time,
    onEdit,
    onAdd,
    onDelete,
    contentLanguage,
}) => {
    const { t } = useTranslation();

    const eventName = getEventName(event, contentLanguage);
    const timeDisplay = formatTimeDisplay(time);

    // ダメージタイプのラベル
    const damageTypeLabel: Record<string, string> = {
        magical: t('app.damage_type_magical', { defaultValue: 'M' }),
        physical: t('app.damage_type_physical', { defaultValue: 'P' }),
        unavoidable: t('app.damage_type_unavoidable', { defaultValue: '?' }),
        enrage: t('app.damage_type_enrage', { defaultValue: '!' }),
    };

    const handleEdit = () => { onEdit(); onClose(); };
    const handleAdd = () => { onAdd(); onClose(); };
    const handleDelete = () => { onDelete(); onClose(); };

    return (
        /* z-[400] — FAB(300)より上 */
        <div className="fixed inset-0 z-[400] md:hidden pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* 背景オーバーレイ */}
                        <motion.div
                            key="context-overlay"
                            className="absolute inset-0 bg-black/60 pointer-events-auto"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={onClose}
                        />

                        {/* ボトムシート */}
                        <motion.div
                            key="context-sheet"
                            className={clsx(
                                "absolute left-0 right-0",
                                "glass-tier3",
                                "rounded-t-2xl rounded-b-none",
                                "flex flex-col overflow-hidden",
                                "pointer-events-auto",
                            )}
                            style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{
                                type: 'spring',
                                stiffness: 380,
                                damping: 34,
                            }}
                        >
                            {/* ドラッグハンドル */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-app-border" />
                            </div>

                            {/* コンテキストヘッダー — どのイベントか確認できる */}
                            <div className="px-5 pt-2 pb-3 border-b border-app-border">
                                <p className="text-app-2xl font-bold text-app-text leading-tight truncate">
                                    {eventName}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-app-lg font-medium text-app-text-muted">
                                        {timeDisplay}
                                    </span>
                                    {event.target && (
                                        <span className="text-app-lg text-app-text-muted">
                                            {event.target}
                                        </span>
                                    )}
                                    {event.damageType && (
                                        <span className="text-app-lg text-app-text-muted">
                                            {damageTypeLabel[event.damageType] ?? event.damageType}
                                        </span>
                                    )}
                                    {event.damageAmount != null && event.damageAmount > 0 && (
                                        <span className="text-app-lg text-app-text-muted">
                                            {event.damageAmount.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* メニュー項目 */}
                            <div className="flex flex-col py-2">
                                {/* 編集 */}
                                <button
                                    onClick={handleEdit}
                                    className={clsx(
                                        "flex items-center gap-4 px-5 py-3.5",
                                        "active:bg-app-surface2 transition-colors duration-100",
                                    )}
                                >
                                    <span className="w-9 h-9 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                                        <Pencil size={18} className="text-indigo-400" />
                                    </span>
                                    <span className="flex flex-col items-start text-left">
                                        <span className="text-app-2xl font-semibold text-app-text">
                                            {t('app.context_edit_event')}
                                        </span>
                                        <span className="text-app-lg text-app-text-muted">
                                            {t('app.context_edit_event_desc')}
                                        </span>
                                    </span>
                                </button>

                                {/* 追加 */}
                                <button
                                    onClick={handleAdd}
                                    className={clsx(
                                        "flex items-center gap-4 px-5 py-3.5",
                                        "active:bg-app-surface2 transition-colors duration-100",
                                    )}
                                >
                                    <span className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <Plus size={18} className="text-emerald-400" />
                                    </span>
                                    <span className="flex flex-col items-start text-left">
                                        <span className="text-app-2xl font-semibold text-app-text">
                                            {t('app.context_add_event')}
                                        </span>
                                        <span className="text-app-lg text-app-text-muted">
                                            {t('app.context_add_event_desc', { time: timeDisplay })}
                                        </span>
                                    </span>
                                </button>

                                {/* セパレーター */}
                                <div className="mx-5 my-1 h-px bg-app-border" />

                                {/* 削除（赤、視覚的に分離） */}
                                <button
                                    onClick={handleDelete}
                                    className={clsx(
                                        "flex items-center gap-4 px-5 py-3.5",
                                        "active:bg-red-500/10 transition-colors duration-100",
                                    )}
                                >
                                    <span className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                                        <Trash2 size={18} className="text-red-400" />
                                    </span>
                                    <span className="flex flex-col items-start text-left">
                                        <span className="text-app-2xl font-semibold text-red-400">
                                            {t('app.context_delete_event')}
                                        </span>
                                        <span className="text-app-lg text-app-text-muted">
                                            {t('app.context_delete_event_desc')}
                                        </span>
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
