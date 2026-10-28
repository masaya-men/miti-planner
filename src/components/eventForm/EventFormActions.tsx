import React from 'react';
import clsx from 'clsx';
import { Trash2, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../../types';

interface EventFormActionsProps {
    compact: boolean;
    variant: 'modal' | 'pip';
    onCancel?: () => void;
    onDelete?: () => void;
    initialData?: TimelineEvent | null;
    saveButtonKey?: string;
    handleSubmit: (e: React.FormEvent) => void;
}

// フォーム下部の操作(キャンセル / 削除 / 保存)。
export const EventFormActions: React.FC<EventFormActionsProps> = ({
    compact, variant, onCancel, onDelete, initialData, saveButtonKey, handleSubmit,
}) => {
    const { t } = useTranslation();
    return (
            <div className={clsx(
                "flex justify-between items-center border-t transition-colors",
                compact ? "flex-col gap-3 pt-3 mt-3" : "flex-col sm:flex-row gap-4 pt-4 mt-6",
                "border-app-border"
            )}>
                {onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        className={clsx(
                            "px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 border border-app-border text-app-text hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all text-app-lg font-bold cursor-pointer active:scale-95",
                            compact ? "w-full" : "w-full sm:w-auto"
                        )}
                    >
                        <span>{t('timeline.recorder.cancel')}</span>
                    </button>
                ) : onDelete && initialData ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm(t('timeline.delete_event_confirm'))) {
                                onDelete();
                            }
                        }}
                        className={clsx(
                            "px-4 py-2 text-app-red hover:text-app-red-hover hover:bg-app-red-dim rounded-lg flex items-center justify-center gap-1.5 transition-colors text-app-lg font-bold cursor-pointer",
                            compact ? "w-full" : "w-full sm:w-auto"
                        )}
                    >
                        <Trash2 size={16} />
                        <span>{t('modal.delete')}</span>
                    </button>
                ) : <div className="hidden sm:block"></div>}

                <button
                    data-tutorial="event-save-btn"
                    type={variant === 'pip' ? 'button' : 'submit'}
                    onClick={variant === 'pip' ? handleSubmit : undefined}
                    className={clsx(
                        "flex items-center justify-center gap-2 bg-app-blue text-white hover:bg-app-blue-hover font-bold transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-wider cursor-pointer",
                        compact
                            ? "w-full py-3.5 rounded-xl text-app-2xl"
                            : "w-full sm:w-auto flex-1 sm:flex-none px-8 py-2.5 rounded-lg text-app-2xl"
                    )}
                >
                    <Save size={compact ? 18 : 16} />
                    {t(saveButtonKey ?? 'mechanic_modal.add_button')}
                </button>
            </div>
    );
};
