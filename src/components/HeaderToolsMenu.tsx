// src/components/HeaderToolsMenu.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MoreHorizontal, Wand2, Star, Eye, Check } from 'lucide-react';
import clsx from 'clsx';
import { useMitigationStore } from '../store/useMitigationStore';
import { useProgressBarVisibility } from '../store/useProgressBarVisibility';
import { Tooltip } from './ui/Tooltip';

interface HeaderToolsMenuProps {
    /** アイコンボタン共通クラス (ConsolidatedHeader の iconBtnBase/iconBtnDefault) */
    btnClassName: string;
    /** 軽減自動組み立ての実行 */
    onAutoPlan: () => void;
    /** ジョイナー読み取り専用時は自動組み立て/ハイライトを無効化 */
    readOnly: boolean;
}

/**
 * ヘッダー下段の「⋯ その他」メニュー。あまり使わない操作を集約してヘッダーを空ける。
 * - 軽減自動組み立て (実行)
 * - MYジョブハイライト (ON/OFF トグル・ON で星が金色)
 * - 進捗バーを表示 (ON/OFF トグル・表示中は ✓)
 *
 * ヘッダーの overflow を回避するため Portal で body 直下にレンダリング (TutorialMenu と同方式)。
 * ⋯ アイコンはホバーで 90°回転 (横→縦) してメニューを予告する (framer spring)。
 */
export function HeaderToolsMenu({ btnClassName, onAutoPlan, readOnly }: HeaderToolsMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const myJobHighlight = useMitigationStore(s => s.myJobHighlight);
    const setMyJobHighlight = useMitigationStore(s => s.setMyJobHighlight);
    const progressBarVisible = useProgressBarVisibility(s => s.visible);

    // メニュー位置 (ボタン直下・右寄せ)
    const [pos, setPos] = useState({ top: 0, left: 0 });
    useEffect(() => {
        if (!open || !btnRef.current) return;
        const r = btnRef.current.getBoundingClientRect();
        setPos({ top: r.bottom + 4, left: r.left });
    }, [open]);

    // 外側クリックで閉じる
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target as Node) &&
                btnRef.current && !btnRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const itemClass = 'w-full flex items-center gap-2 px-3 py-2 text-app-lg text-left transition-colors cursor-pointer hover:bg-app-text/5 text-app-text disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <>
            <Tooltip content={t('ui.more')}>
                <button
                    ref={btnRef}
                    type="button"
                    onClick={() => setOpen(prev => !prev)}
                    className={btnClassName}
                    aria-label={t('ui.more')}
                >
                    {/* ホバー or 開いている間は 90°回転 (横三点→縦三点) */}
                    <motion.span
                        className="flex items-center justify-center"
                        animate={{ rotate: open ? 90 : 0 }}
                        whileHover={{ rotate: 90 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    >
                        <MoreHorizontal size={16} />
                    </motion.span>
                </button>
            </Tooltip>

            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed min-w-[220px] rounded-lg border border-app-text/15 bg-app-bg shadow-lg py-1 z-[99999]"
                    style={{ top: pos.top, left: pos.left }}
                >
                    {/* 軽減自動組み立て */}
                    <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => { setOpen(false); onAutoPlan(); }}
                        className={itemClass}
                    >
                        <Wand2 size={14} className="shrink-0 text-app-text-muted" />
                        <span className="flex-1">{t('mitigation.auto_plan')}</span>
                    </button>

                    {/* MYジョブハイライト (ON で金色の星・チェックなし) */}
                    <button
                        type="button"
                        data-tutorial="my-job-highlight-btn"
                        disabled={readOnly}
                        onClick={() => { setOpen(false); setMyJobHighlight(!myJobHighlight); }}
                        className={itemClass}
                    >
                        <Star
                            size={14}
                            className={clsx('shrink-0', myJobHighlight ? 'text-app-amber fill-current' : 'text-app-text-muted')}
                        />
                        <span className="flex-1">{t('ui.highlight_my_job')}</span>
                    </button>

                    {/* 進捗バーを表示 (トグル・表示中は ✓) */}
                    <button
                        type="button"
                        onClick={() => { setOpen(false); useProgressBarVisibility.getState().toggle(); }}
                        className={itemClass}
                    >
                        <Eye size={14} className="shrink-0 text-app-text-muted" />
                        <span className="flex-1">{t('progress.show_bar')}</span>
                        {progressBarVisible && <Check size={12} className="text-[#22c55e] flex-shrink-0" />}
                    </button>
                </div>,
                document.body
            )}
        </>
    );
}
