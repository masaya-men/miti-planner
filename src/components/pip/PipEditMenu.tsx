import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Pencil } from 'lucide-react';
import clsx from 'clsx';
import type { AppliedMitigation, TimelineEvent, Mitigation } from '../../types';

interface PipEditMenuProps {
    menuTime: number;
    lang: 'ja' | 'en' | 'zh' | 'ko';
    fgColor: string;
    cueGroups: { time: number; events: TimelineEvent[]; mitigations: { applied: AppliedMitigation; definition: Mitigation }[] }[];
    eventIndexByTime: Record<number, number>;
    setEventIndexByTime: React.Dispatch<React.SetStateAction<Record<number, number>>>;
    notes: Record<string, string>;
    editingEventId: string | null;
    setEditingEventId: React.Dispatch<React.SetStateAction<string | null>>;
    editInputRef: React.RefObject<HTMLInputElement | null>;
    handleEditConfirm: (eventId: string, value: string) => void;
    closeMenu: () => void;
}

/** スマホ全画面: 編集モーダル */
export const PipEditMenu: React.FC<PipEditMenuProps> = ({
    menuTime, lang, fgColor, cueGroups, eventIndexByTime, setEventIndexByTime, notes,
    editingEventId, setEditingEventId, editInputRef, handleEditConfirm, closeMenu,
}) => {
    const { t } = useTranslation();
                const group = cueGroups.find(g => g.time === menuTime);
                if (!group) return null;
                return (
                    <div
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4"
                        onClick={closeMenu}
                    >
                        <div
                            className="relative float-surface rounded-xl w-full max-w-[360px] py-4 px-3"
                            onClick={e => e.stopPropagation()}
                            style={{ color: fgColor }}
                        >
                            <button
                                onClick={closeMenu}
                                className="absolute top-2 right-2 w-8 h-8 rounded flex items-center justify-center cursor-pointer text-current/40 hover:text-current hover:bg-current/10 transition-colors"
                                title={t('timeline.pip_close')}
                                aria-label={t('timeline.pip_close')}
                            >
                                <X size={18} />
                            </button>
                            <div className="flex flex-col gap-1 mt-2 pr-8">
                                {group.events.map((ev, evIdx) => {
                                    const displayName = notes[ev.id] || ev.name[lang] || ev.name.ja || ev.name.en || '';
                                    const isCurrentlyShown = evIdx === ((eventIndexByTime[group.time] ?? 0) % group.events.length);
                                    return (
                                        <div
                                            key={ev.id}
                                            className={clsx(
                                                "flex items-center gap-2 rounded-lg px-3 py-2 min-h-[44px]",
                                                isCurrentlyShown ? "bg-current/10" : "hover:bg-current/5",
                                            )}
                                        >
                                            {editingEventId === ev.id ? (
                                                <input
                                                    ref={editInputRef}
                                                    defaultValue={displayName}
                                                    onBlur={(e) => {
                                                        handleEditConfirm(ev.id, e.target.value);
                                                        closeMenu();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleEditConfirm(ev.id, (e.target as HTMLInputElement).value);
                                                            closeMenu();
                                                        }
                                                        if (e.key === 'Escape') {
                                                            e.stopPropagation();
                                                            setEditingEventId(null);
                                                        }
                                                    }}
                                                    className="flex-1 min-w-0 bg-current/10 border border-current/30 rounded px-2 py-1 text-[17px] outline-none"
                                                    style={{ color: fgColor }}
                                                />
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            if (!isCurrentlyShown) {
                                                                setEventIndexByTime(prev => ({ ...prev, [group.time]: evIdx }));
                                                            }
                                                            closeMenu();
                                                        }}
                                                        className="flex-1 min-w-0 text-left text-[17px] font-bold text-current/90 truncate cursor-pointer"
                                                        title={isCurrentlyShown ? t('timeline.pip_already_shown', '表示中') : t('timeline.pip_switch_to', 'この攻撃に切替')}
                                                    >
                                                        {displayName}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingEventId(ev.id)}
                                                        className="shrink-0 w-9 h-9 rounded flex items-center justify-center cursor-pointer text-current/60 hover:text-current hover:bg-current/10 transition-colors"
                                                        title={t('timeline.pip_edit_hint')}
                                                        aria-label={t('timeline.pip_edit_hint')}
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
};
