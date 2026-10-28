import React from 'react';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import { ChevronLeft, X, Undo2, Redo2, CloudDownload } from 'lucide-react';
import { MobileBottomSheet } from '../MobileBottomSheet';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { getPhaseName } from '../../types';
import { getMitigationPriority } from '../../hooks/useSkillsData';
import type { useMitigations, useJobs } from '../../hooks/useSkillsData';
import { validateMitigationPlacement } from '../../utils/resourceTracker';
import { calculateLinkedShieldValue } from '../../utils/calculator';
import { resolveMitigationTap } from '../../utils/mitigationTapResolver';
import { resolveSeraphismMitigation } from '../../utils/scholarShieldRules';
import { useMitigationStore } from '../../store/useMitigationStore';
import { genId } from './genId';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { useTimelinePartyOrder } from './useTimelineLayout';
import type { useTimelineMobileScrollChrome } from './useTimelineMobileScrollChrome';
import './TimelineMobileSheets.css';

type Dialogs = ReturnType<typeof useTimelineDialogs>;
type MitigationState = ReturnType<typeof useMitigationStore.getState>;

interface TimelineMobileSheetsProps {
    t: TFunction;
    contentLanguage: string;
    mobileMitiFlow: Dialogs['mobileMitiFlow'];
    setMobileMitiFlow: Dialogs['setMobileMitiFlow'];
    timelineEvents: MitigationState['timelineEvents'];
    timelineMitigations: MitigationState['timelineMitigations'];
    partyMembers: MitigationState['partyMembers'];
    currentLevel: number;
    MITIGATIONS: ReturnType<typeof useMitigations>;
    JOBS: ReturnType<typeof useJobs>;
    sortedPartyMembers: ReturnType<typeof useTimelinePartyOrder>['sortedPartyMembers'];
    addMitigation: MitigationState['addMitigation'];
    removeMitigation: MitigationState['removeMitigation'];
}

/** スマホの軽減一覧シート(全メンバーの軽減を一画面で表示)。Timeline から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelineMobileSheets: React.FC<TimelineMobileSheetsProps> = ({
    t, contentLanguage, mobileMitiFlow, setMobileMitiFlow, timelineEvents, timelineMitigations, partyMembers,
    currentLevel, MITIGATIONS, JOBS, sortedPartyMembers, addMitigation, removeMitigation,
}) => {
    return (
        <>
            {/* ── モバイル軽減一覧シート: 全メンバーの軽減を一画面で表示 ── */}
            <MobileBottomSheet
                isOpen={mobileMitiFlow.isOpen}
                onClose={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))}
                title={
                    <span className="flex flex-col min-w-0 items-start gap-0.5">
                        <span className="text-app-base font-black text-app-text-muted uppercase tracking-widest">{t('timeline.add_mitigation_here')}</span>
                        <span className="text-app-md text-app-text font-mono">
                            {(() => {
                                const flowTime = mobileMitiFlow.time;
                                const eventsAtTime = timelineEvents.filter(e => e.time === flowTime);
                                const timeStr = Math.floor(Math.abs(flowTime) / 60) + ':' + (Math.abs(flowTime) % 60).toString().padStart(2, '0');
                                const eventName = eventsAtTime.length > 0
                                    ? (eventsAtTime[0].name ? getPhaseName(eventsAtTime[0].name, contentLanguage) : null)
                                    : null;
                                return <>{timeStr}{eventName ? ` — ${eventName}` : ''}</>;
                            })()}
                        </span>
                    </span>
                }
                height="80dvh"
                fillContent
                swipeArea="handle"
            >
                <div className="flex-1 min-h-0 flex flex-col relative">
                        {/* この時間に配置済みの軽減アイコン — 専用行(長い攻撃名と競合して見えなくなるのを防ぐ)。
                            「ちょうどこの秒に置かれたもの」だけでなく「効果が続いていて今も効いているもの」も含める
                            (タイムライン本体行の mitigationsByTime と同じ判定 = mit.time <= t < mit.time+duration)。 */}
                        {(() => {
                            const placed = timelineMitigations.filter(am =>
                                !am.autoHidden && am.time <= mobileMitiFlow.time && mobileMitiFlow.time < am.time + am.duration
                            );
                            if (placed.length === 0) return null;
                            return (
                                <div className="px-4 pb-2 flex items-center gap-1 flex-wrap">
                                    {placed.map(am => {
                                        const def = MITIGATIONS.find(m => m.id === am.mitigationId);
                                        if (!def) return null;
                                        return <img key={am.id} src={def.icon} className="w-[22px] h-[22px] rounded-sm object-contain opacity-80" />;
                                    })}
                                </div>
                            );
                        })()}
                        {/* 対象/鼓舞の選択サブビュー (対象指定スキル・展開戦術等)。pending 中はスキル一覧に重ねて表示 */}
                        {mobileMitiFlow.pending && (() => {
                            const pending = mobileMitiFlow.pending;
                            if (!pending) return null;
                            const place = (extra: { targetId?: string; linkedMitigationId?: string }) => {
                                addMitigation({
                                    id: genId(),
                                    mitigationId: pending.mit.id,
                                    time: mobileMitiFlow.time,
                                    duration: pending.mit.duration,
                                    ownerId: pending.ownerId,
                                    ...extra,
                                });
                                setMobileMitiFlow(prev => ({ ...prev, pending: null }));
                            };
                            const skillName = getPhaseName(pending.mit.name, contentLanguage);
                            return (
                                <div className="absolute inset-0 z-10 bg-app-bg flex flex-col" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-app-border shrink-0">
                                        <button
                                            onClick={() => setMobileMitiFlow(prev => ({ ...prev, pending: null }))}
                                            className="flex items-center gap-1 text-app-base font-black text-app-text-sec uppercase tracking-tighter active:scale-95 cursor-pointer"
                                        >
                                            <ChevronLeft size={16} />
                                            {pending.mode === 'target'
                                                ? t('mitigation.select_target', '対象を選択')
                                                : t('mitigation.select_shield', '展開する鼓舞を選択')}
                                        </button>
                                        <span className="text-app-sm text-app-text-muted truncate ml-1">{skillName}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3">
                                        {pending.mode === 'target' ? (
                                            <div className="grid grid-cols-4 gap-2">
                                                {sortedPartyMembers.map(member => {
                                                    const job = JOBS.find(j => j.id === member.jobId);
                                                    const isSelfRestricted = pending.mit.targetCannotBeSelf && member.id === pending.ownerId;
                                                    return (
                                                        <button
                                                            key={member.id}
                                                            disabled={isSelfRestricted}
                                                            onClick={() => { if (!isSelfRestricted) place({ targetId: member.id }); }}
                                                            className={clsx(
                                                                "aspect-square rounded-xl border flex items-center justify-center transition-all",
                                                                isSelfRestricted
                                                                    ? "opacity-30 grayscale border-app-border cursor-not-allowed"
                                                                    : "bg-app-surface2 border-app-border active:scale-90 cursor-pointer"
                                                            )}
                                                        >
                                                            {job ? (
                                                                <img src={job.icon} className="w-9 h-9 object-contain rounded" />
                                                            ) : (
                                                                <span className={clsx(
                                                                    "text-app-lg font-black uppercase tracking-tighter",
                                                                    member.role === 'tank' ? 'text-app-role-tank'
                                                                        : member.role === 'healer' ? 'text-app-role-healer'
                                                                            : 'text-app-role-dps'
                                                                )}>
                                                                    {t(`modal.${member.id.toLowerCase()}`, member.id)}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {pending.shields.length === 0 ? (
                                                    <button
                                                        onClick={() => place({})}
                                                        className="w-full p-3 rounded-xl border border-app-border bg-app-surface2 text-app-base text-app-text-sec active:scale-95 cursor-pointer"
                                                    >
                                                        {t('mitigation.no_shield', '有効な鼓舞がありません')}（{t('mitigation.shield_value', { value: 0 })}）
                                                    </button>
                                                ) : (
                                                    pending.shields.map(shield => {
                                                        const shieldOwner = partyMembers.find(p => p.id === shield.ownerId);
                                                        const targetMember = shield.targetId
                                                            ? partyMembers.find(p => p.id === shield.targetId)
                                                            : shieldOwner;
                                                        const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
                                                        const barrierValue = calculateLinkedShieldValue(shield, timelineMitigations, partyMembers, MITIGATIONS);
                                                        return (
                                                            <button
                                                                key={shield.id}
                                                                onClick={() => place({ linkedMitigationId: shield.id })}
                                                                className="flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2 active:scale-95 cursor-pointer"
                                                            >
                                                                {targetJob ? (
                                                                    <img src={targetJob.icon} className="w-8 h-8 object-contain rounded shrink-0" />
                                                                ) : (
                                                                    <span className="w-8 h-8 flex items-center justify-center text-app-lg font-black tracking-tighter uppercase shrink-0">
                                                                        {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                    </span>
                                                                )}
                                                                <div className="flex flex-col items-start min-w-0">
                                                                    <span className="text-app-base font-bold text-app-text truncate">
                                                                        {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                    </span>
                                                                    <span className="text-app-sm text-app-text-sec">
                                                                        {t('mitigation.shield_value', { value: barrierValue.toLocaleString() })}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                        {/* ジョブごとセクション化 (パーティ編成順 MT→D4)、 各セクション内は PC モーダルと同じ並び順 */}
                        <div className="flex-1 overflow-y-auto px-2 pb-4">
                            <div className="flex flex-col gap-3">
                                {sortedPartyMembers.map(member => {
                                    const job = JOBS.find(j => j.id === member.jobId);
                                    if (!job) return null;
                                    const memberMitis = timelineMitigations.filter(m => m.ownerId === member.id);
                                    const mitis = MITIGATIONS
                                        .filter(m =>
                                            m.jobId === job.id
                                            && !m.hidden
                                            && (!m.minLevel || m.minLevel <= currentLevel)
                                            && (!m.maxLevel || m.maxLevel >= currentLevel)
                                        )
                                        // ソートは「すり替え前」の id で行う(PC版と同じ理由: セラフィズムの
                                        // 発動/終了のたびに一覧内の表示位置が飛ぶのを防ぐ)
                                        .sort((a, b) => getMitigationPriority(a.id) - getMitigationPriority(b.id))
                                        .map(m => resolveSeraphismMitigation(m, mobileMitiFlow.time, memberMitis, MITIGATIONS));
                                    if (mitis.length === 0) return null;

                                    return (
                                        <section key={member.id}>
                                            {/* セクションヘッダー: スロット記号 + ジョブアイコン + ジョブ名 */}
                                            <div className="flex items-center gap-2 px-1 mb-1.5">
                                                <span className="text-app-base font-black text-app-text-muted uppercase tracking-widest">
                                                    {t(`modal.${member.id.toLowerCase()}`, member.id)}
                                                </span>
                                                <img src={job.icon} className="w-5 h-5 object-contain rounded" />
                                                <span className="text-app-sm font-bold text-app-text">
                                                    {getPhaseName(job.name, contentLanguage)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {mitis.map(mit => {
                                                    const isAlreadyPlaced = memberMitis.some(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                                    const status = validateMitigationPlacement(
                                                        mit, mobileMitiFlow.time, memberMitis, t
                                                    );
                                                    // PC の MitigationSelector と同じ判定に統一(競合時も配置可能に)。
                                                    // conflictOverride: 既存CD中(forward)でも見た目は赤のままクリックだけ解放。
                                                    const isClickable = status.available || status.conflictOverride || isAlreadyPlaced;

                                                    return (
                                                        <button
                                                            key={`${member.id}-${mit.id}`}
                                                            disabled={!isClickable}
                                                            onClick={() => {
                                                                if (isAlreadyPlaced) {
                                                                    const amToRemove = memberMitis.find(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                                                    if (amToRemove) removeMitigation(amToRemove.id);
                                                                    return;
                                                                }
                                                                if (!status.available && !status.conflictOverride) return;
                                                                // 対象指定スキル(インターベンション等)/鼓舞コピー(展開戦術等)は
                                                                // 即配置せず、サブ選択ビューへ。それ以外は即配置。
                                                                const resolution = resolveMitigationTap(mit, mobileMitiFlow.time, timelineMitigations);
                                                                if (resolution.kind === 'selectTarget') {
                                                                    setMobileMitiFlow(prev => ({ ...prev, pending: { mode: 'target', mit, ownerId: member.id } }));
                                                                    return;
                                                                }
                                                                if (resolution.kind === 'selectShield') {
                                                                    setMobileMitiFlow(prev => ({ ...prev, pending: { mode: 'shield', mit, ownerId: member.id, shields: resolution.shields } }));
                                                                    return;
                                                                }
                                                                addMitigation({
                                                                    id: genId(),
                                                                    mitigationId: mit.id,
                                                                    time: mobileMitiFlow.time,
                                                                    duration: mit.duration,
                                                                    ownerId: member.id,
                                                                    linkedMitigationId: resolution.linkedMitigationId,
                                                                });
                                                            }}
                                                            className={clsx(
                                                                "aspect-square rounded-xl border flex items-center justify-center relative overflow-hidden transition-all active:scale-90",
                                                                isAlreadyPlaced
                                                                    ? "bg-app-text/20 border-app-text"
                                                                    : status.warning
                                                                        ? "bg-app-amber-dim border-app-amber opacity-60"
                                                                        : status.available
                                                                            ? "bg-app-surface2 border-app-border"
                                                                            : "bg-black/20 border-app-red-border opacity-60"
                                                            )}
                                                        >
                                                            <img src={mit.icon} className="w-9 h-9 object-contain rounded" />
                                                            {/* リキャスト/使用不可メッセージ — 軽くグレーアウト + 文字を下端に詰める */}
                                                            {!status.available && !isAlreadyPlaced && status.message && (
                                                                <div className="absolute inset-0 bg-black/30">
                                                                    <span className="absolute bottom-0.5 left-0 right-0 text-app-base leading-tight font-bold text-app-red text-center px-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                                                        {status.message}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {/* リキャスト競合警告 — 軽くグレーアウト + 文字を下端に詰める */}
                                                            {status.warning && (status.shortMessage || status.message) && (
                                                                <div className="absolute inset-0 bg-black/30">
                                                                    <span className="absolute bottom-0.5 left-0 right-0 text-app-base leading-tight font-bold text-app-amber text-center px-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                                                        {status.shortMessage || status.message}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {isAlreadyPlaced && (
                                                                <div className="absolute top-1 right-1">
                                                                    <X size={12} className="text-app-text drop-shadow-sm" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                </div>
            </MobileBottomSheet>
        </>
    );
};

interface TimelineMobileToolsProps {
    t: TFunction;
    tutorialActive: boolean;
    undoRedoWrapRef: ReturnType<typeof useTimelineMobileScrollChrome>['undoRedoWrapRef'];
    canUndo: boolean;
    canRedo: boolean;
    readOnly: boolean;
    mobileToolsSheetOpen: boolean;
    setMobileToolsSheetOpen: (open: boolean) => void;
    setImportModalOpen: Dialogs['setImportModalOpen'];
}

/** スマホの元に戻す/やり直し・ツールシート。Timeline から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelineMobileTools: React.FC<TimelineMobileToolsProps> = ({
    t, tutorialActive, undoRedoWrapRef, canUndo, canRedo, readOnly, mobileToolsSheetOpen, setMobileToolsSheetOpen,
    setImportModalOpen,
}) => {
    return (
        <>
            {/* スマホ: 画面左端に Undo/Redo 常設（編集系は常設ツールバー・ナビ枠を消費しない。チュートリアル中は FAB と同様に隠す）。
                以前は FAB のすぐ左(右端寄り)に置いていたが、スクロールする親指の可動域に重なるという
                実機FBがあり、反対側の左端に移動(2026-08-13)。右端のFABと見た目を揃えるため、
                スクロール中はこちらも同じように隠す(ユーザー要望・2026-08-13)。 */}
            {!tutorialActive && <div
                ref={undoRedoWrapRef}
                className="mobile-undo-redo-wrap fixed z-[300] md:hidden flex items-center gap-2"
                style={{
                    // ボトムナビゲーションになるべく近づける(2026-08-13ユーザー要望)。MobileFAB.tsx の
                    // FAB本体と同じ計算式(bottomNav.height + 少しの余白)に揃える。
                    bottom: `calc(${MOBILE_TOKENS.bottomNav.height}px + 0.5rem)`,
                    left: '1rem',
                }}
            >
                <button
                    onClick={() => useMitigationStore.getState().undo()}
                    disabled={!canUndo || readOnly}
                    aria-label={t('timeline.undo')}
                    className="flex items-center justify-center border text-app-text shadow-xl active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Undo2 size={18} />
                </button>
                <button
                    onClick={() => useMitigationStore.getState().redo()}
                    disabled={!canRedo || readOnly}
                    aria-label={t('timeline.redo')}
                    className="flex items-center justify-center border text-app-text shadow-xl active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Redo2 size={18} />
                </button>
            </div>}

            <MobileBottomSheet
                isOpen={mobileToolsSheetOpen}
                onClose={() => setMobileToolsSheetOpen(false)}
                title={t('mobile.import_title')}
                height="55vh"
                swipeArea="handle"
            >
                <div className="flex flex-col gap-3">
                    {/* FFLogs Import */}
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setImportModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-app-text/5 border border-app-border text-app-text hover:bg-app-text/10 cursor-pointer"
                    >
                        <CloudDownload size={20} />
                        <div className="text-left">
                            <div className="text-app-2xl font-bold">FF Logs</div>
                            <div className="text-app-base text-app-text-muted">{t('fflogs.tooltip_generate')}</div>
                        </div>
                    </button>
                    {/* スプレッドシート取込: スマホでは非表示(有名スプシのマトリクス構造はスマホ貼付で
                        構造的に取り込めず、URL直読みは「あらゆるスプシ対応」を目指す前提で棚上げ。2026-06-30 判断)。
                        PC の入口(menu イベント→setShowGridImport)は別経路で維持。 */}
                </div>
            </MobileBottomSheet>
        </>
    );
};
