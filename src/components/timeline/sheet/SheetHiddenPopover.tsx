// スプシ表示: ジョブ欄の「+(隠した数)」を押したときに出す小窓。隠した技を選んで再表示する。
// 器・位置・閉じ方は SheetTargetPopover と同じ(float-surface・外側クリック/Escape で閉じる・画面内にクランプ)。
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getPhaseName } from '../../../types';
import { useThemeStore } from '../../../store/useThemeStore';
import { backdropClose } from '../../../utils/backdropClose';
import type { SheetColumn } from './sheetColumns';

export interface SheetHiddenPopoverState { memberId: string; x: number; y: number }

interface Props {
    state: SheetHiddenPopoverState;
    columns: readonly SheetColumn[];
    onShow: (mitigationId: string) => void;
    onShowAll: () => void;
    onClose: () => void;
}

const PAD = 8;
const GAP = 8;

export const SheetHiddenPopover: React.FC<Props> = ({ state, columns, onShow, onShowAll, onClose }) => {
    const { t } = useTranslation();
    const contentLanguage = useThemeStore(s => s.contentLanguage);
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        let left = state.x - r.width / 2;
        let top = state.y + GAP;
        if (left + r.width > window.innerWidth - PAD) left = window.innerWidth - PAD - r.width;
        if (left < PAD) left = PAD;
        if (top + r.height > window.innerHeight - PAD) top = state.y - GAP - r.height;
        if (top < PAD) top = PAD;
        setPos({ left, top });
    }, [state.x, state.y, columns.length]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); };
    }, [onClose]);

    // 最後の 1 つを再表示して空になったら自動で閉じる
    useEffect(() => { if (columns.length === 0) onClose(); }, [columns.length, onClose]);

    return createPortal(
        <div className="fixed inset-0 z-[99998] cursor-default" {...backdropClose(onClose)}>
        <div
            ref={ref}
            data-sheet-hidden-popover=""
            className="float-surface fixed z-[99999] rounded-xl p-2 flex flex-col gap-1 w-60"
            style={{
                left: pos?.left ?? state.x,
                top: pos?.top ?? state.y + GAP,
                visibility: pos ? undefined : 'hidden',
            } as React.CSSProperties}
            onClick={e => e.stopPropagation()}
        >
            <div className="px-1 text-app-base font-black text-app-text-sec tracking-tighter leading-none">
                {t('timeline.sheet_hidden_title')}
            </div>
            {columns.map(({ mitigationId, def }) => (
                <button
                    key={mitigationId}
                    type="button"
                    data-sheet-hidden-item={mitigationId}
                    onClick={() => onShow(mitigationId)}
                    className="flex items-center gap-2 px-1.5 py-1 rounded-lg bg-app-surface2 border border-app-border hover:border-app-text/40 cursor-pointer text-left"
                >
                    <img referrerPolicy="no-referrer" src={def.icon} alt="" draggable={false} className="w-6 h-6 object-contain shrink-0" />
                    <span className="text-app-base font-bold text-app-text truncate flex-1">{getPhaseName(def.name, contentLanguage)}</span>
                    <span className="text-app-sm font-black text-app-text-sec shrink-0">{t('timeline.sheet_hidden_show')}</span>
                </button>
            ))}
            <button
                type="button"
                data-sheet-hidden-all=""
                onClick={onShowAll}
                className="mt-0.5 w-full py-1 rounded-full border border-app-border bg-transparent text-app-base font-bold text-app-text cursor-pointer hover:bg-app-text hover:text-app-bg"
            >
                {t('timeline.sheet_hidden_show_all')}
            </button>
        </div>
        </div>,
        document.body,
    );
};
