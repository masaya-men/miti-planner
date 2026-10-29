// スプシ表示: 対象指定の技(インターベンション等)・展開戦術をマスに置くとき、その場に出す小窓。
// 材料は MitigationSelector の対象選択 / 鼓舞選択サブビュー(MitigationSelector.tsx:456-600)と同じ。
// 器は浮かぶものの素材 float-surface(2026-10-28 統一)。
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppliedMitigation, Mitigation, PartyMember } from '../../../types';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { useJobs, useMitigations } from '../../../hooks/useSkillsData';
import { backdropClose } from '../../../utils/backdropClose';
import { calculateLinkedShieldValue } from '../../../utils/calculator';
import { sameSecondTargets } from '../../../utils/sameSecondStack';

export interface SheetPopoverState {
    memberId: string;
    time: number;
    def: Mitigation;
    kind: 'selectTarget' | 'selectShield';
    shields: AppliedMitigation[];
    /** 押した位置(clientX/Y) */
    x: number;
    y: number;
}

interface Props {
    state: SheetPopoverState;
    /** removeId = この秒にもう使った人を押した(その 1 つを消す) */
    onPick: (pick: { targetId?: string; linkedMitigationId?: string; removeId?: string }) => void;
    onClose: () => void;
}

const VIEWPORT_PADDING = 8;
const GAP = 8;

const BTN = clsx(
    'rounded-lg border transition-all duration-200',
    'bg-app-surface2 border-app-border hover:bg-app-surface2 hover:border-app-border',
    'shadow-sm dark:shadow-none hover:shadow-md',
);

/** 押した位置の下(はみ出すなら上)に出す。左右・上下は画面内にクランプ(PartyVisibilityMenu と同じ式) */
function clampPopoverPos(x: number, y: number, w: number, h: number, vw: number, vh: number): { left: number; top: number } {
    let left = x - w / 2;
    let top = y + GAP;
    if (left + w > vw - VIEWPORT_PADDING) left = vw - VIEWPORT_PADDING - w;
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
    if (top + h > vh - VIEWPORT_PADDING) top = y - GAP - h;
    if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING;
    return { left, top };
}

export const SheetTargetPopover: React.FC<Props> = ({ state, onPick, onClose }) => {
    const { t } = useTranslation();
    const JOBS = useJobs();
    const MITIGATIONS = useMitigations();
    const partyMembers = useMitigationStore(s => s.partyMembers);
    const timelineMitigations = useMitigationStore(s => s.timelineMitigations);
    const panelRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    useLayoutEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setPos(clampPopoverPos(state.x, state.y, r.width, r.height, window.innerWidth, window.innerHeight));
    }, [state.x, state.y, state.kind]);

    // 外側クリック / Escape で閉じる
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    // この秒にもう相手にした人(押すと消える)・まだ足せるか
    const { used, canAddMore } = sameSecondTargets(
        state.def, state.time, timelineMitigations.filter(m => m.ownerId === state.memberId),
    );

    const memberLabel = (m: PartyMember | undefined) => t(`modal.${(m?.id || '').toLowerCase()}`, m?.id || '');
    const roleText = (m: PartyMember | undefined) =>
        m?.role === 'tank' ? 'text-app-role-tank'
            : m?.role === 'healer' ? 'text-app-role-healer'
                : 'text-app-role-dps';

    return createPortal(
        <div className="fixed inset-0 z-[99998] cursor-default" {...backdropClose(onClose)}>
        <div
            ref={panelRef}
            data-sheet-popover={state.kind}
            className="float-surface fixed z-[99999] rounded-xl p-2 flex flex-col gap-1.5"
            style={{
                left: pos?.left ?? state.x,
                top: pos?.top ?? state.y + GAP,
                visibility: pos ? undefined : 'hidden',
            } as React.CSSProperties}
            onClick={e => e.stopPropagation()}
        >
            <div className="px-1 text-app-base font-black text-app-text-sec uppercase tracking-tighter leading-none">
                {state.kind === 'selectTarget'
                    ? t('mitigation.select_target', '対象を選択')
                    : t('mitigation.select_shield', '展開する鼓舞を選択')}
            </div>

            {state.kind === 'selectTarget' ? (
                <div className="grid grid-cols-4 grid-rows-2 gap-1.5">
                    {partyMembers.map(member => {
                        const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                        const usedId = used.get(member.id);
                        const disabled = !usedId && ((!!state.def.targetCannotBeSelf && member.id === state.memberId) || !canAddMore);
                        return (
                            <button
                                key={member.id}
                                type="button"
                                data-target-id={member.id}
                                disabled={disabled}
                                aria-pressed={usedId ? true : undefined}
                                title={usedId ? t('mitigation.remove') : undefined}
                                onClick={() => { if (usedId) onPick({ removeId: usedId }); else if (!disabled) onPick({ targetId: member.id }); }}
                                className={clsx(
                                    BTN, 'relative w-10 h-10 flex items-center justify-center p-1',
                                    usedId && 'border-app-red',
                                    disabled ? 'opacity-30 cursor-not-allowed grayscale shadow-none' : 'cursor-pointer active:scale-95 hover:scale-[1.03]',
                                )}
                            >
                                {job ? (
                                    <img src={job.icon} alt={job.name?.en || job.id} className="w-7 h-7 object-contain drop-shadow-md" />
                                ) : (
                                    <span className={clsx('text-app-lg font-black tracking-tighter uppercase', roleText(member))}>
                                        {memberLabel(member)}
                                    </span>
                                )}
                                {usedId && (
                                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-app-red text-white p-0.5 shadow-sm">
                                        <X size={9} strokeWidth={3} />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            ) : state.shields.length === 0 ? (
                <div className="flex flex-col gap-1.5 w-56">
                    <p className="text-app-base text-app-amber font-bold text-center">
                        {t('mitigation.no_shield', '有効な鼓舞がありません')}
                    </p>
                    <button
                        type="button"
                        data-shield-id=""
                        onClick={() => onPick({})}
                        className={clsx(BTN, 'w-full p-2 cursor-pointer active:scale-95 text-app-base text-app-text-sec')}
                    >
                        {t('mitigation.no_shield', '有効な鼓舞がありません')}（{t('mitigation.shield_value', { value: 0 })}）
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-1.5 w-56">
                    {state.shields.map(shield => {
                        const owner = partyMembers.find(p => p.id === shield.ownerId);
                        const target = shield.targetId ? partyMembers.find(p => p.id === shield.targetId) : owner;
                        const targetJob = target?.jobId ? JOBS.find(j => j.id === target.jobId) : null;
                        const value = calculateLinkedShieldValue(shield, timelineMitigations, partyMembers, MITIGATIONS);
                        return (
                            <button
                                key={shield.id}
                                type="button"
                                data-shield-id={shield.id}
                                onClick={() => onPick({ linkedMitigationId: shield.id })}
                                className={clsx(BTN, 'flex items-center gap-2 p-1.5 cursor-pointer active:scale-95')}
                            >
                                {targetJob ? (
                                    <img src={targetJob.icon} alt={targetJob.name?.en || targetJob.id} className="w-7 h-7 object-contain drop-shadow-md shrink-0" />
                                ) : (
                                    <span className={clsx('w-7 h-7 flex items-center justify-center text-app-lg font-black uppercase shrink-0', roleText(target))}>
                                        {memberLabel(target)}
                                    </span>
                                )}
                                <div className="flex flex-col items-start min-w-0">
                                    <span className="text-app-base font-bold text-app-text truncate">{memberLabel(target)}</span>
                                    <span className="text-app-sm text-app-text-sec">{t('mitigation.shield_value', { value: value.toLocaleString() })}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
        </div>,
        document.body,
    );
};
