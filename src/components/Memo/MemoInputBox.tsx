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
            className="absolute z-30 bg-app-surface border border-app-border rounded p-2 shadow-lg flex flex-col gap-1"
            style={{ top: `${topPx}px`, left: `${leftPx}px`, width: 220 }}
            onClick={(e) => e.stopPropagation()}
        >
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MEMO_LIMITS.MAX_TEXT_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder={t('memo.input_placeholder', { max: MEMO_LIMITS.MAX_TEXT_LENGTH })}
                className="bg-app-bg text-app-text text-app-sm px-2 py-1 rounded border border-app-border resize-none"
                rows={3}
                maxLength={MEMO_LIMITS.MAX_TEXT_LENGTH}
            />
            <div className="flex justify-end gap-1 text-app-xs">
                <span className="text-app-text-muted self-center mr-auto">
                    {text.length}/{MEMO_LIMITS.MAX_TEXT_LENGTH}
                </span>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-2 py-0.5 rounded hover:bg-app-surface2 text-app-text-muted"
                >
                    {t('memo.input_cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    className="px-2 py-0.5 rounded bg-app-blue text-white hover:bg-app-blue/80"
                >
                    {t('memo.input_save')}
                </button>
            </div>
        </div>
    );
};
