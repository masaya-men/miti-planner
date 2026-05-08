import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';

interface DisplayNameEditorProps {
    value: string;
    onSave: (trimmedName: string) => void;
    onCancel: () => void;
    isSaving?: boolean;
}

export const DisplayNameEditor: React.FC<DisplayNameEditorProps> = ({
    value, onSave, onCancel, isSaving = false,
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const trimmed = name.trim();
    const isValid = trimmed.length >= 1 && trimmed.length <= 30;

    const handleSave = () => {
        if (!isValid || isSaving) return;
        onSave(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onCancel();
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={e => {
                        if (e.target.value.length <= 30) setName(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    maxLength={30}
                    disabled={isSaving}
                    className={clsx(
                        "w-full px-3 py-2 rounded-lg text-[16px] md:text-app-lg text-app-text",
                        "bg-transparent border border-app-border",
                        "focus:outline-none focus:border-app-text/40 transition-colors",
                        "disabled:opacity-50"
                    )}
                />
                <span className={clsx(
                    "absolute right-2 bottom-2 text-app-base",
                    name.length >= 30 ? "text-yellow-500" : "text-app-text-muted/50"
                )}>
                    {name.length}/30
                </span>
            </div>
            <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label={t('profile.cancel')}
                    className={clsx(
                        "px-3 py-1.5 rounded-lg text-app-base flex items-center gap-1 transition-all duration-200 cursor-pointer",
                        "text-app-text-muted hover:text-app-text border border-app-border hover:border-app-text/40 active:scale-95"
                    )}
                >
                    <X size={14} />
                    {t('profile.cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isValid || isSaving}
                    aria-label={t('profile.save')}
                    className={clsx(
                        "px-3 py-1.5 rounded-lg text-app-base flex items-center gap-1 transition-all duration-200",
                        isValid && !isSaving
                            ? "bg-app-toggle text-app-toggle-text hover:opacity-90 active:scale-95 cursor-pointer"
                            : "bg-app-text/20 text-app-text-muted cursor-not-allowed"
                    )}
                >
                    <Check size={14} />
                    {t('profile.save')}
                </button>
            </div>
        </div>
    );
};
