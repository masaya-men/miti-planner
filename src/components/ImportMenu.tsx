// src/components/ImportMenu.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Tooltip } from './ui/Tooltip';

interface ImportMenuProps {
    /** アイコンボタン共通クラス（計算済み: iconBtnBase + 状態。空タイムライン時の点滅もここに含む） */
    btnClassName: string;
    /** FF Logs 取り込みを開く（既存の onImportLogs） */
    onImportLogs: () => void;
    /** ジョイナー読み取り専用時は取り込み自体を無効化 */
    readOnly: boolean;
}

/**
 * ヘッダーの「取り込み」統一メニュー。汎用DLアイコン1つを押すと
 * FF Logs / スプレッドシート の取り込みを選べる小メニューを出す。
 * 旧来は Logs とスプシで別アイコンだったのを 1 つに統合。
 *
 * ドロップダウンの作法は HeaderToolsMenu と統一（Portal で body 直下・外側クリックで閉じる）。
 */
export function ImportMenu({ btnClassName, onImportLogs, readOnly }: ImportMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // メニュー位置（ボタン直下・左寄せ）
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

    const itemClass = 'w-full flex items-center gap-2 px-3 py-2 text-app-lg text-left transition-colors cursor-pointer hover:bg-app-text/5 text-app-text';

    return (
        <>
            <Tooltip content={t('importMenu.tooltip')}>
                <button
                    ref={btnRef}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setOpen((prev) => !prev)}
                    className={btnClassName}
                    aria-label={t('importMenu.tooltip')}
                >
                    <Download size={16} className="group-hover:translate-y-0.5 transition-transform duration-300" />
                </button>
            </Tooltip>

            {open && createPortal(
                <div
                    ref={menuRef}
                    className="fixed min-w-[240px] rounded-lg border border-app-text/15 bg-app-bg shadow-lg py-1 z-[99999]"
                    style={{ top: pos.top, left: pos.left }}
                >
                    {/* FF Logs から取り込み */}
                    <button
                        type="button"
                        onClick={() => { setOpen(false); onImportLogs(); }}
                        className={itemClass}
                    >
                        <Download size={14} className="shrink-0 text-app-text-muted" />
                        <span className="flex-1">{t('importMenu.fflogs')}</span>
                    </button>

                    {/* スプレッドシートから取り込み（列グリッド） */}
                    <button
                        type="button"
                        onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('timeline:grid-import')); }}
                        className={itemClass}
                    >
                        <FileSpreadsheet size={14} className="shrink-0 text-app-text-muted" />
                        <span className="flex-1">{t('importMenu.spreadsheet')}</span>
                    </button>
                </div>,
                document.body,
            )}
        </>
    );
}
