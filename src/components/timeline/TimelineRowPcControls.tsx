import React from 'react';
import { Plus, Copy } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { PartyMember, TimelineEvent } from '../../types';
import { useTranslation } from 'react-i18next';
import { useEffectiveThemeStyle } from '../../store/useThemeStore';
import { useJobs } from '../../hooks/useSkillsData';
import { useMitigationStore } from '../../store/useMitigationStore';
import { Tooltip } from '../ui/Tooltip';
import { DamageTypeIcon } from '../DamageTypeIcon';
import { nextDamageType } from '../../utils/damageTypeLogic';

// PC用: 種別アイコン — 左クリックで physical→magical→unavoidable を循環 / 右クリックでデバフ軽減不可をトグル。
// いずれも updateEvent 経由なので collab 同期・Undo・ダメージ再計算・赤枠反映はモーダル変更と完全に同一経路。
// 純粋な閲覧者は store 側ガードで no-op。md: のみ表示(モバイルは別途 DamageTypeIcon を表示)。
export const PcTypeToggle: React.FC<{ event: TimelineEvent }> = ({ event }) => {
    const { t } = useTranslation();
    const updateEvent = useMitigationStore(state => state.updateEvent);
    // 軍事の表の見た目用の印は軍事のときだけ付ける(標準の DOM は 1 文字も変えない)
    const isMilspec = useEffectiveThemeStyle() === 'military';
    // enrage(時間切れ)はアイコンを持たない種別なので、空のクリック領域を作らないよう非表示。
    if (!event.damageType || event.damageType === 'enrage') return null;
    const stateLabel = event.ignoresDebuffMitigation ? 'ON' : 'OFF';
    return (
        <Tooltip
            content={
                <div className="leading-snug">
                    <div>{t('timeline.type_action_left')}</div>
                    <div>{t('timeline.type_action_right', { state: stateLabel })}</div>
                </div>
            }
        >
            <button
                type="button"
                data-damage-type={isMilspec ? event.damageType : undefined}
                onClick={(e) => {
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止して即トグル
                    updateEvent(event.id, { damageType: nextDamageType(event.damageType) });
                }}
                onContextMenu={(e) => {
                    e.preventDefault();  // ブラウザ標準の右クリックメニューを抑止
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止
                    updateEvent(event.id, { ignoresDebuffMitigation: !event.ignoresDebuffMitigation });
                }}
                className="hidden md:inline-flex items-center cursor-pointer rounded-sm hover:bg-app-surface2 active:scale-95 transition-all"
            >
                <DamageTypeIcon damageType={event.damageType} ignoresDebuffMitigation={event.ignoresDebuffMitigation} size="w-3 h-3" withTooltip={false} />
            </button>
        </Tooltip>
    );
};

// PC用: 対象(MT/ST)表示 — クリックで MT⇄ST をトグル(イベント編集モーダルを開かず即切替)。
// updateEvent 経由なので collab 同期・Undo・ダメージ再計算はモーダルでの変更と完全に同一経路。
// 純粋な閲覧者は store 側ガードで no-op。対象が MT/ST 以外(AoE 等)のときは何も出さない。
// effTarget: 挑発によるタンクスイッチを反映した実効ターゲット（表示用）。クリックは元 target を編集。
export const PcTargetToggle: React.FC<{ event: TimelineEvent; partyMembers: PartyMember[]; effTarget: TimelineEvent['target']; badgeTextClass?: string }> = ({ event, partyMembers, effTarget, badgeTextClass = 'text-app-base' }) => {
    const JOBS = useJobs();
    const { t } = useTranslation();
    const updateEvent = useMitigationStore(state => state.updateEvent);
    // reduced-motion ユーザーはアニメーションを省略する
    const reduce = useReducedMotion();
    // 実効ターゲットが MT/ST 以外なら表示しない
    if (effTarget !== 'MT' && effTarget !== 'ST') return null;
    const member = partyMembers.find(m => m.id === effTarget);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    return (
        <Tooltip content={t('timeline.toggle_target_hint')}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止して即トグル
                    // クリックは元 target（raw）を編集する。表示 effTarget ではない。
                    updateEvent(event.id, { target: event.target === 'MT' ? 'ST' : 'MT' });
                }}
                className="flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 hover:bg-app-surface2 active:scale-95 transition-all"
            >
                {/* "on" ラベルはアニメーション対象外 */}
                <span className="text-app-base text-app-text-muted font-mono">on</span>
                {/* effTarget が切り替わったときにアイコン/バッジをフリップアニメーション */}
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={String(effTarget)}
                        initial={reduce ? false : { opacity: 0, scale: 0.6, rotateY: -90 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotateY: 90 }}
                        transition={{ duration: 0.18 }}
                        className="inline-flex"
                    >
                        {job ? (
                            <img referrerPolicy="no-referrer" src={job.icon} className="w-6 h-6 rounded-sm" alt={effTarget} />
                        ) : (
                            <span className={clsx(
                                "font-bold px-1 rounded",
                                badgeTextClass,
                                effTarget === 'MT' ? "text-app-role-mt bg-app-role-mt-dim" : "text-app-role-st bg-app-role-st-dim"
                            )}>
                                {effTarget}
                            </span>
                        )}
                    </motion.span>
                </AnimatePresence>
            </button>
        </Tooltip>
    );
};

// PC用: コピーボタン — 「+」の右隣、対象トグルの左に同サイズ(w-6 h-6)で並べる。
// ホバー時だけ幅を開いて可視化(攻撃名はその分だけ縮む)。対象アイコンが無い(AoE)行では親の ml-auto により右端へ寄る。
export const PcCopyButton: React.FC<{ event: TimelineEvent }> = ({ event }) => {
    const { t } = useTranslation();
    const setClipboardEvent = useMitigationStore(state => state.setClipboardEvent);
    return (
        <Tooltip content={t('timeline.copy_event_hint')} position="top">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setClipboardEvent(event);
                }}
                className="flex items-center justify-center w-6 h-6 rounded-sm text-app-text-muted hover:text-app-accent cursor-pointer opacity-0 pointer-events-none group-hover/slot:opacity-100 group-hover/slot:pointer-events-auto transition-opacity active:scale-95"
            >
                <Copy size={14} />
            </button>
        </Tooltip>
    );
};

// PC用: イベント追加ボタン — コピーの左隣。ホバー時だけ出る(コピーと同じ動き)。
// 動きは空の行の「+」と同じ onAddEventClick(コピー中は貼り付け / AA モード中は AA 追加 / それ以外は追加モーダル)。
export const PcAddEventButton: React.FC<{ time: number; onAddEventClick: (time: number, e: React.MouseEvent) => void }> = ({ time, onAddEventClick }) => {
    const { t } = useTranslation();
    return (
        <Tooltip content={t('timeline.event_add_here')} position="top">
            <button
                type="button"
                aria-label={t('timeline.event_add_here')}
                onClick={(e) => {
                    e.stopPropagation();
                    onAddEventClick(time, e);
                }}
                className="flex items-center justify-center w-6 h-6 rounded-sm text-app-text-muted hover:text-app-accent cursor-pointer opacity-0 pointer-events-none group-hover/slot:opacity-100 group-hover/slot:pointer-events-auto transition-opacity active:scale-95"
            >
                <Plus size={14} />
            </button>
        </Tooltip>
    );
};
