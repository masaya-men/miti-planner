import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { AppliedMitigation, TimelineEvent, Mitigation } from '../../types';
import { formatTime } from '../../utils/templateConversions';

interface PipCueListProps {
    isFs: boolean;
    lang: 'ja' | 'en' | 'zh' | 'ko';
    fgColor: string;
    cueGroups: { time: number; events: TimelineEvent[]; mitigations: { applied: AppliedMitigation; definition: Mitigation }[] }[];
    eventIndexByTime: Record<number, number>;
    cycleEventAtTime: (time: number, total: number) => void;
    notes: Record<string, string>;
    updateNote: (eventId: string, value: string) => void;
    editingEventId: string | null;
    setEditingEventId: React.Dispatch<React.SetStateAction<string | null>>;
    editInputRef: React.RefObject<HTMLInputElement | null>;
    handleEditConfirm: (eventId: string, value: string) => void;
    handleDoubleClick: (eventId: string) => void;
    setMenuTime: React.Dispatch<React.SetStateAction<number | null>>;
}

export const PipCueList: React.FC<PipCueListProps> = ({
    isFs, lang, fgColor, cueGroups, eventIndexByTime, cycleEventAtTime, notes, updateNote,
    editingEventId, setEditingEventId, editInputRef, handleEditConfirm, handleDoubleClick, setMenuTime,
}) => {
    const { t } = useTranslation();
    return (
            <div
                className={clsx(
                    "flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden",
                    isFs ? "px-2 py-1" : "px-1.5 py-1",
                )}
                style={{
                    scrollbarWidth: 'none',
                    ...(isFs && {
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent)',
                        maskImage: 'linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent)',
                    }),
                }}
            >
                {cueGroups.length === 0 ? (
                    <p className={clsx(
                        "text-current/40 text-center",
                        isFs ? "text-base mt-8" : "text-app-base mt-4",
                    )}>
                        {t('timeline.pip_no_events')}
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {cueGroups.map(({ time, events, mitigations }, i) => {
                            const hasEvent = events.length > 0;
                            const idx = hasEvent ? (eventIndexByTime[time] ?? 0) % events.length : 0;
                            const event = hasEvent ? events[idx] : null;
                            const hasExtra = events.length > 1;
                            return (
                                <div
                                    key={time}
                                    className={clsx(
                                        "flex items-center",
                                        isFs ? "gap-2 py-2 px-2" : "gap-1 py-0.5 px-1",
                                        i % 2 === 0 && "bg-current/[0.03]"
                                    )}
                                >
                                    {/* 時間 */}
                                    <span className={clsx(
                                        "text-current/40 font-mono shrink-0 text-right",
                                        isFs ? "text-[15px] w-11" : "text-app-base w-8",
                                    )}>
                                        {formatTime(time)}
                                    </span>

                                    {/* 攻撃名 + 切替バッジ（ダブルクリックで編集） */}
                                    <div className={clsx(
                                        "flex-1 min-w-0 flex items-center",
                                        isFs ? "gap-1.5" : "gap-1",
                                    )}>
                                        {event && (<>
                                            {!isFs && editingEventId === event.id ? (
                                                <input
                                                    ref={editInputRef}
                                                    defaultValue={notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                                    onBlur={(e) => handleEditConfirm(event.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleEditConfirm(event.id, (e.target as HTMLInputElement).value);
                                                        if (e.key === 'Escape') setEditingEventId(null);
                                                    }}
                                                    className="flex-1 min-w-0 bg-current/10 border border-current/30 rounded outline-none text-app-base px-1 py-0"
                                                    style={{ color: fgColor }}
                                                />
                                            ) : (
                                                <>
                                                    <span
                                                        onDoubleClick={!isFs ? () => handleDoubleClick(event.id) : undefined}
                                                        onClick={isFs ? () => setMenuTime(time) : undefined}
                                                        className={clsx(
                                                            "min-w-0 truncate leading-tight text-current/80",
                                                            isFs ? "text-[17px] font-bold cursor-pointer" : "text-app-base cursor-text",
                                                        )}
                                                        title={t('timeline.pip_edit_hint')}
                                                    >
                                                        {notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                                    </span>
                                                    {/* メモあり時のリセットボタン（× クリックで元の名前に戻る） */}
                                                    {notes[event.id] && (
                                                        <button
                                                            onClick={() => updateNote(event.id, '')}
                                                            className={clsx(
                                                                "shrink-0 rounded opacity-50 hover:opacity-100 hover:bg-current/10 text-current/70 transition-opacity cursor-pointer",
                                                                isFs ? "p-1" : "p-0.5",
                                                            )}
                                                            title={t('timeline.pip_reset_note')}
                                                            aria-label={t('timeline.pip_reset_note')}
                                                        >
                                                            <X size={isFs ? 14 : 10} />
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {/* +N 切替バッジ（イベント名のおしり、同時刻に他のイベントがあるとき） */}
                                            {hasExtra && (
                                                <button
                                                    onClick={() => cycleEventAtTime(time, events.length)}
                                                    className={clsx(
                                                        "shrink-0 rounded bg-current/10 hover:bg-current/25 text-current/60 hover:text-current font-mono cursor-pointer transition-colors",
                                                        isFs ? "px-1.5 py-0.5 text-xs" : "px-1 text-app-xs",
                                                    )}
                                                    title={t('timeline.pip_switch_event')}
                                                >
                                                    +{events.length - 1}
                                                </button>
                                            )}
                                        </>)}
                                    </div>

                                    {/* 軽減スキルアイコン */}
                                    <div className="flex items-center shrink-0">
                                        {mitigations.map(({ applied, definition }) => (
                                            <img
                                                key={applied.id}
                                                src={definition.icon}
                                                className={clsx(
                                                    "object-contain shrink-0",
                                                    isFs ? "w-[26px] h-[26px]" : "w-4 h-4",
                                                )}
                                                title={definition.name[lang] || definition.name.ja || definition.name.en || ''}
                                                alt=""
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
    );
};
