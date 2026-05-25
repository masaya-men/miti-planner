import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MEMO_LIMITS } from '../../types/firebase';

interface MemoInputBoxProps {
    /** 配置位置 (シート相対 px) */
    topPx: number;
    leftPx: number;
    /** 既存メモを編集中なら初期値、 新規なら空 */
    initialText?: string;
    onSave: (text: string) => void;
    onCancel: () => void;
}

export const MemoInputBox: React.FC<MemoInputBoxProps> = ({
    topPx,
    leftPx,
    initialText = '',
    onSave,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [text, setText] = useState(initialText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSave = () => {
        onSave(text.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    return (
        <div
            className="absolute z-[9999] glass-tier3 rounded-xl shadow-sm p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200"
            style={{ top: `${topPx}px`, left: `${leftPx}px`, width: 320 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MEMO_LIMITS.MAX_TEXT_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder={t('memo.input_placeholder', { max: MEMO_LIMITS.MAX_TEXT_LENGTH })}
                className="bg-app-bg/60 text-app-text text-app-md px-3 py-2 rounded-lg border border-glass-border resize-none focus:outline-none focus:border-app-text/40"
                rows={3}
                maxLength={MEMO_LIMITS.MAX_TEXT_LENGTH}
            />
            <div className="flex items-center gap-2 text-app-sm">
                <span className="text-app-text-muted">
                    {text.length}/{MEMO_LIMITS.MAX_TEXT_LENGTH}
                </span>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-app-sm font-black uppercase tracking-wider text-app-text-muted hover:bg-app-surface2 hover:text-app-text transition-colors cursor-pointer"
                >
                    {t('memo.input_cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg text-app-sm font-black uppercase tracking-wider bg-app-toggle text-app-toggle-text hover:opacity-90 transition-opacity cursor-pointer"
                >
                    {t('memo.input_save')}
                </button>
            </div>
        </div>
    );
};
