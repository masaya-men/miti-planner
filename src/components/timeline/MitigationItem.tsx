import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import type { AppliedMitigation } from '../../types';
import { getPhaseName } from '../../types';
import { useJobs, useMitigations } from '../../hooks/useSkillsData';
import clsx from 'clsx';
import { Tooltip } from '../ui/Tooltip';
import { validateMitigationPlacement } from '../../utils/resourceTracker';
import { PlacementToast } from './sheet/PlacementToast';
import { useSortSlide } from '../military/table/useSortSlide';
import { MITI_ICON_PX, mitiIconOffset } from './rowLayout';
import type { RowLayout } from './rowLayout';

export interface MitigationItemProps {
    mitigation: AppliedMitigation;
    /** 行の配置係。縦位置(ドラッグのスナップ・帯クリック)はすべてここから得る */
    rowLayout: RowLayout;
    onRemove: (id: string) => void;
    onUpdateTime: (id: string, newTime: number) => void;
    top: number;
    height: number;
    left: number;
    laneIndex?: number;
    partySortOrder?: 'role' | 'light_party';
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    activeMitigations: AppliedMitigation[];
    overlapOffset?: number;
    isVirtual?: boolean;
    iconOverride?: string;
    /** 仮想アイテムを白黒表示する(ウォーキングデッド用)。 */
    grayscale?: boolean;
    // 初回マウントで memberLayout が未計測 (refs 未確定) の 1 フレーム間、
    // colStart=0 で左端に描画されて「左から飛んでくる」 のを防ぐ。
    // false の間はアイコンを visibility: hidden で隠す。
    layoutReady?: boolean;
    /** 軍事テーマ: 並び替えで列が動いたとき滑る(標準では未指定) */
    slideOnSort?: boolean;
    /** timelineMitigations から派生した競合フラグ（親が useMemo で算出して渡す） */
    isConflicting?: boolean;
    /** エフェクト棒クリック時、下にある配置マス目と同じ挙動にするための転送先(TimelineRowのonCellClickと同一関数)。
     * エフェクト棒はホバーでツールチップを出すためpointer-events-autoにしており、そのままだと
     * 素通りしていた配置クリックが棒に吸われてしまうため、ここで明示的に転送する(2026-08-26)。 */
    onCellClick?: (memberId: string, time: number, e: React.MouseEvent) => void;
    /** アイコンの 1 辺(px)。スプシ表示は SHEET_ICON_PX。省略時は MITI_ICON_PX(レーン表示の出力は不変) */
    iconPx?: number;
    /** スプシ表示: 置いたアイコンをドラッグせずに押した(= もう一度で消す)。マスのクリックと同じ関数を受け取る */
    onIconTap?: (memberId: string, time: number, e: React.MouseEvent) => void;
}

export const getMitigationColorClasses = (jobId: string | undefined, ownerId: string, partySortOrder: string = 'role') => {
    if (partySortOrder === 'light_party') {
        const mtGroup = ['MT', 'H1', 'D1', 'D3'];
        if (mtGroup.includes(ownerId)) {
            return {
                bg: "bg-cyan-500/80",
                border: "border-cyan-400/30",
                shadow: "shadow-[0_0_5px_rgba(6,182,212,0.5)]"
            };
        } else {
            return {
                bg: "bg-amber-500/80",
                border: "border-amber-400/30",
                shadow: "shadow-[0_0_5px_rgba(245,158,11,0.5)]"
            };
        }
    }

    if (!jobId) return {
        bg: "bg-slate-400/80",
        border: "border-slate-300/30",
        shadow: "shadow-[0_0_5px_rgba(148,163,184,0.5)]"
    };

    const tank = ['pld', 'war', 'drk', 'gnb'];
    const healer = ['whm', 'sch', 'ast', 'sge'];
    const melee = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];
    const ranged = ['brd', 'mch', 'dnc', 'blm', 'smn', 'rdm', 'pct'];

    if (tank.includes(jobId)) {
        return {
            bg: "bg-blue-500/80",
            border: "border-blue-400/30",
            shadow: "shadow-[0_0_5px_rgba(59,130,246,0.5)]"
        };
    }
    if (healer.includes(jobId)) {
        return {
            bg: "bg-green-500/80",
            border: "border-green-400/30",
            shadow: "shadow-[0_0_5px_rgba(34,197,94,0.5)]"
        };
    }
    if (melee.includes(jobId)) {
        return {
            bg: "bg-red-500/80",
            border: "border-red-400/30",
            shadow: "shadow-[0_0_5px_rgba(239,68,68,0.5)]"
        };
    }
    if (ranged.includes(jobId)) {
        return {
            bg: "bg-orange-500/80",
            border: "border-orange-400/30",
            shadow: "shadow-[0_0_5px_rgba(249,115,22,0.5)]"
        };
    }

    return {
        bg: "bg-slate-400/80",
        border: "border-slate-300/30",
        shadow: "shadow-[0_0_5px_rgba(148,163,184,0.5)]"
    };
};

export const MitigationItem: React.FC<MitigationItemProps> = React.memo((props) => {
    const {
        mitigation, rowLayout, onRemove, onUpdateTime,
        top, height, left, partySortOrder,
        scrollContainerRef, activeMitigations, overlapOffset = 0,
        isVirtual = false, iconOverride, layoutReady = true, grayscale = false,
        onCellClick, slideOnSort, iconPx = MITI_ICON_PX, onIconTap
    } = props;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t } = useTranslation();

    const { contentLanguage } = useThemeStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();
    const dragStartRef = useRef<{ pointerX: number; pointerY: number; scrollTop: number } | null>(null);
    const autoScrollRef = useRef<number | null>(null);
    const lastPointerYRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    // 軍事テーマ: 並び替えで列が動いたら効果アイコンが滑る(標準では何もしない)
    useSortSlide(containerRef, { left, sortOrder: partySortOrder ?? 'role', enabled: !!slideOnSort, delay: 40 + (Math.round(top / 25) % 16) * 25 });
    const indicatorRef = useRef<HTMLDivElement>(null);
    const timeLabelRef = useRef<HTMLDivElement>(null);

    const myMemberId = useMitigationStore(s => s.myMemberId);
    // 「自分以外」判定。myJobHighlight はここで購読しない（購読すると全アイコンが一斉再描画される）。
    // 薄暗くの ON/OFF は親 .timeline-scroll-container の data-myjob-highlight + CSS が担当。
    const isNotMine = !!myMemberId && myMemberId !== mitigation.ownerId;
    // 競合フラグは親（Timeline本体）が timelineMitigations から派生させ prop 経由で渡す
    const isConflicting = props.isConflicting ?? false;

    const def = MITIGATIONS.find(m => m.id === mitigation.mitigationId);
    const colors = getMitigationColorClasses(def?.jobId, mitigation.ownerId, partySortOrder);

    const durationHeight = height;
    // recast / recastPx は廃止された点線描画 (border-dotted) でのみ使われていたため参照しない。
    // maxTime クリップは効果棒 (effectiveEndTime) で引き続き利用。

    // 縦位置はすべて rowLayout(行の配置係)から得る。
    // アイコンは行の最上段(1 つ目の攻撃の段)の縦中央に置く。
    const iconOffset = mitiIconOffset(rowLayout.unitPx, iconPx);
    // ドラッグ中の「行の上端」Y から、アイコンの中央がある行の秒を求める
    // (均一な行では旧実装の「最も近い行の上端」と同じ動き。背の高い行でもアイコンの下の行に落ちる)
    const timeAtDraggedTop = (rowTopY: number): number => rowLayout.timeAtY(rowTopY + rowLayout.unitPx / 2);

    // エフェクト棒クリック → 下のマス目に配置クリックしたのと同じ扱いに転送する(2026-08-26)。
    // 棒はホバーでツールチップを出すためpointer-events-autoが要るが、そのままだと今まで
    // 素通りしていた配置クリックがここで止まってしまうため、rowLayout.timeAtY で棒のクリック位置
    // (ratio)から行の時間を求め、TimelineRowのonCellClickと同じ関数を直接呼んで橋渡しする。
    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onCellClick || isVirtual) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
        // 棒の上端 = 行の最上段の中央(アイコン中央)。クリック位置を「含む」行の秒へ転送する
        // (旧実装は最も近い行の上端を選んでいたため、行の下半分をクリックすると 1 秒後になるずれがあった)。
        const barTopY = top + rowLayout.unitPx / 2;
        const time = rowLayout.timeAtY(barTopY + ratio * durationHeight);
        onCellClick(mitigation.ownerId, time, e);
    };

    const updateDragPosition = (dy: number, animateSnap: boolean = false) => {
        if (!containerRef.current) return;

        if (animateSnap) {
            containerRef.current.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else {
            containerRef.current.style.transition = 'none';
        }

        const currentY = top + dy;
        containerRef.current.style.top = `${currentY + iconOffset}px`;
        containerRef.current.style.zIndex = '50';
        containerRef.current.style.opacity = '0.9';

        // スナップ先 = アイコンの中央がある行の秒。その行の上端 Y は rowLayout から
        const snappedTime = timeAtDraggedTop(currentY);
        const snappedY = rowLayout.topOf(snappedTime);
        const relativeY = snappedY - currentY; // containerRefからの相対位置

        if (indicatorRef.current) {
            indicatorRef.current.style.display = 'block';
            indicatorRef.current.style.top = `${relativeY}px`;
        }
        if (timeLabelRef.current) {
            timeLabelRef.current.style.display = 'block';
            timeLabelRef.current.style.top = `${relativeY - 8}px`;
            const min = Math.floor(Math.abs(snappedTime) / 60);
            const sec = Math.abs(snappedTime) % 60;
            const sign = snappedTime < 0 ? '-' : '';
            timeLabelRef.current.textContent = `${sign}${min}:${sec.toString().padStart(2, '0')} `;
        }
    };

    const resetDragPosition = (animate: boolean = false) => {
        if (!containerRef.current) return;

        if (animate) {
            containerRef.current.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else {
            containerRef.current.style.transition = 'none';
        }

        containerRef.current.style.top = `${top + iconOffset}px`;

        if (animate) {
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.style.zIndex = '';
                    containerRef.current.style.opacity = '';
                    containerRef.current.style.transition = '';
                }
            }, 300);
        } else {
            containerRef.current.style.zIndex = '';
            containerRef.current.style.opacity = '';
        }

        if (indicatorRef.current) indicatorRef.current.style.display = 'none';
        if (timeLabelRef.current) timeLabelRef.current.style.display = 'none';
    };

    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // スプシ表示(アイコンが標準より小さい)は置く・消すとも左クリックだけ。右クリックでは消さない
        // (ブラウザ標準のメニューはレーン表示と同じく preventDefault で出さない)
        if (iconPx < MITI_ICON_PX) return;
        if (dragStartRef.current || isVirtual) return;
        onRemove(mitigation.id);
    };

    const handleTouchStart = () => {
        if (iconPx < MITI_ICON_PX) return; // スプシ表示は長押しでも消さない(左クリック=タップだけ)
        timerRef.current = setTimeout(() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
            onRemove(mitigation.id);
        }, 600);
    };

    const handleTouchEnd = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const handleTouchMove = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const EDGE_ZONE = 60;
    const MAX_SCROLL_SPEED = 15;

    const stopAutoScroll = () => {
        if (autoScrollRef.current !== null) {
            cancelAnimationFrame(autoScrollRef.current);
            autoScrollRef.current = null;
        }
    };

    const startAutoScroll = () => {
        const tick = () => {
            const container = scrollContainerRef.current;
            if (!container || !dragStartRef.current) { stopAutoScroll(); return; }

            const rect = container.getBoundingClientRect();
            const pointerY = lastPointerYRef.current;
            const distFromTop = pointerY - rect.top;
            const distFromBottom = rect.bottom - pointerY;

            let scrollDelta = 0;
            if (distFromTop < EDGE_ZONE && distFromTop >= 0) {
                scrollDelta = -MAX_SCROLL_SPEED * (1 - distFromTop / EDGE_ZONE);
            } else if (distFromBottom < EDGE_ZONE && distFromBottom >= 0) {
                scrollDelta = MAX_SCROLL_SPEED * (1 - distFromBottom / EDGE_ZONE);
            }

            if (scrollDelta !== 0) {
                container.scrollTop += scrollDelta;
                const scrollTop = container.scrollTop;
                const totalScrollDelta = scrollTop - dragStartRef.current.scrollTop;
                const dy = pointerY - dragStartRef.current.pointerY + totalScrollDelta;
                updateDragPosition(dy);
            }

            autoScrollRef.current = requestAnimationFrame(tick);
        };
        stopAutoScroll();
        autoScrollRef.current = requestAnimationFrame(tick);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0 || isVirtual) return;
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, scrollTop };
        lastPointerYRef.current = e.clientY;
        updateDragPosition(0);
        startAutoScroll();
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragStartRef.current) return;
        lastPointerYRef.current = e.clientY;
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const scrollDelta = scrollTop - dragStartRef.current.scrollTop;
        const dy = e.clientY - dragStartRef.current.pointerY + scrollDelta;
        updateDragPosition(dy);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragStartRef.current) return;
        stopAutoScroll();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const scrollDelta = scrollTop - dragStartRef.current.scrollTop;
        const dy = e.clientY - dragStartRef.current.pointerY + scrollDelta;

        // 👇 修正：指を離した最終的なY座標から、スナップ先の時間を計算する
        const finalY = top + dy;
        const newTime = timeAtDraggedTop(finalY);

        const dragStartX = dragStartRef.current.pointerX;
        dragStartRef.current = null;

        if (newTime !== mitigation.time && def) {
            const status = validateMitigationPlacement(def, newTime, activeMitigations, t, mitigation.id);

            if (status.available) {
                resetDragPosition(false);
                onUpdateTime(mitigation.id, newTime);
            } else {
                setToastMessage(t('timeline.cannot_place_here'));
                resetDragPosition(true);
            }
        } else {
            resetDragPosition(false);
            // スプシ表示: ほぼ動かさずに離した = アイコンのマスをもう一度押した扱い
            if (onIconTap && Math.abs(dy) < 4 && Math.abs(e.clientX - dragStartX) < 4) onIconTap(mitigation.ownerId, mitigation.time, e);
        }
    };

    // スプシ表示(アイコンが標準より小さい)か。対象バッジを自分の列に収めるために使う
    const isSheetIcon = iconPx < MITI_ICON_PX;

    const getEffectiveIcon = () => {
        if (iconOverride) return iconOverride;
        if (!def) return "/icons/Placeholder.png";

        // アーサリースターの動的変化判定 (設置後10秒で変化)
        if (def.id === 'earthly_star') {
            // タイムライン上の表示位置（selectedTimeではない、個別のアイテム位置）
            // ここでは簡易的に現在の配置時間からの経過で判定するロジックを想定
            // シミュレーターとして「10秒後の位置」を特定するのは描画ロジックに依存するため
            // 配置されたオブジェクト自体は1つのため、アイコン1つを表示する
            // ユーザー要望: 10秒後に巨星へ。表示を分ける場合は別ロジックだが
            // ここでは「配置したスターが10s経過位置にあるか」ではなく「スター自体」を表示
        }

        // 学者: サモン・セラフィム中のアイコン置換
        const isSeraphActive = activeMitigations.some(am =>
            am.mitigationId === 'summon_seraph' &&
            am.ownerId === mitigation.ownerId &&
            mitigation.time >= am.time &&
            mitigation.time < am.time + am.duration
        );

        if (isSeraphActive) {
            if (def.id === 'whispering_dawn') return "/icons/Angel's_Whisper.png";
            if (def.id === 'fey_illumination') return "/icons/Seraphic_Illumination.png";
        }

        return def.icon;
    };

    const iconUrl = getEffectiveIcon();
    const nameStr = def ? getPhaseName(def.name, contentLanguage) : '';

    return (
        <>
            <PlacementToast message={toastMessage} />

            <div
                ref={containerRef}
                className="absolute flex flex-col items-center group select-none pointer-events-none animate-in zoom-in-90 fade-in duration-200"
                style={{
                    left: `${left}px`,
                    top: `${top + iconOffset}px`,
                    width: `${iconPx}px`,
                    visibility: layoutReady ? undefined : 'hidden',
                }}
            >
                <div
                    ref={indicatorRef}
                    className="absolute pointer-events-none"
                    style={{ display: 'none', left: '-4px', width: '32px', height: '2px', background: 'rgba(56,189,248,0.8)', boxShadow: '0 0 6px rgba(56,189,248,0.6)', borderRadius: '1px', zIndex: 100 }}
                />
                <div
                    ref={timeLabelRef}
                    className="absolute pointer-events-none text-app-base font-mono text-sky-300 bg-black/70 px-1 rounded"
                    style={{ display: 'none', left: '28px', zIndex: 100 }}
                />
                <div
                    data-myjob-dim={isNotMine ? 'gray' : undefined}
                    className={clsx(
                        "rounded shadow-md relative z-20 flex items-center justify-center",
                        !isVirtual && "cursor-grab hover:scale-110 pointer-events-auto",
                        isVirtual && "cursor-default pointer-events-none",
                        isConflicting && "animate-conflict-pulse ring-2 ring-app-amber"
                    )}
                    style={{ width: `${iconPx}px`, height: `${iconPx}px` }}
                    onContextMenu={handleContextMenu}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                >
                    {/* スプシ表示ではふつう表示用の説明は出さない(列のツールチップが担う) */}
                    <Tooltip content={isSheetIcon ? null : `${nameStr || t('timeline.mitigation')} ${mitigation.targetId ? `(→ ${mitigation.targetId})` : ''} ${t('timeline.mitigation_drag_hint')}`} wrapperClassName="w-full h-full" below={slideOnSort || undefined}>
                        <div
                            data-mit-icon=""
                            data-mit-t={slideOnSort ? mitigation.time : undefined}
                            data-mit-owner={slideOnSort ? mitigation.ownerId : undefined}
                            data-mit-dur={slideOnSort ? mitigation.duration : undefined}
                            className={clsx(
                            "w-full h-full bg-black/50 overflow-hidden rounded border border-app-border flex items-center justify-center",
                            isVirtual && "bg-transparent border-none shadow-none"
                        )}>
                            <img
                                src={iconUrl}
                                alt=""
                                style={grayscale ? { filter: 'grayscale(1)' } : undefined}
                                className={clsx(
                                    "object-contain",
                                    isVirtual ? (
                                        // WD(grayscale)は正方アイコンのため、ペンタゴン形のヘリオス/巨星(w-3 h-auto)より視覚的に小さく見える。
                                        // 光学的バランスのため WD だけ気持ち大きく(w-3.5)。塩梅調整はここの値で。
                                        grayscale
                                            ? "w-3.5 h-3.5"
                                            : (iconUrl.includes('Giant_Dominance.png') || iconUrl.includes('horoscope_helios.png'))
                                                ? "w-3 h-auto"
                                                : "w-5 h-5"
                                    ) : "w-full h-full rounded"
                                )}
                            />
                        </div>
                    </Tooltip>

                    {!isVirtual && mitigation.targetId && (() => {
                        const members = useMitigationStore.getState().partyMembers;
                        const targetMember = members.find((m: import('../../types').PartyMember) => m.id === mitigation.targetId);
                        const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
                        return (
                            <div className={clsx("absolute z-30 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)]", isSheetIcon ? "-bottom-[3px] -right-[4px]" : "-bottom-2 -right-2")}>
                                {targetJob ? (
                                    <img src={targetJob.icon} alt={getPhaseName(targetJob.name, contentLanguage)} className={clsx("object-contain rounded-sm", isSheetIcon ? "w-[10px] h-[10px]" : "w-[20px] h-[20px]")} />
                                ) : (
                                    <div className={clsx("bg-black/90 rounded px-1 py-0.5 text-app-xs font-black text-slate-800 dark:text-white ring-1 ring-white/20 origin-bottom-right", isSheetIcon && "scale-[.6]")}>
                                        {mitigation.targetId}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* エフェクト棒: duration≤1秒（瞬発スキル）は非表示。展開戦術(copiesShield)は
                    「全体扱いのコピーバリア」を表す棒として表示する（2026-08-27 解禁）。
                    ホバーでスキルアイコンだけを浮かべるツールチップを出す(2026-08-26、スクロールで
                    アイコンが画面外に出た後も棒だけでどのスキルか分かるように)。ホバー検知のため
                    pointer-events-autoにする必要があり、今まで棒を素通りしていた配置クリックが
                    棒に吸われてしまうため、handleBarClickでonCellClickへ明示的に転送している。 */}
                {mitigation.duration > 1 && (
                    <div
                        data-mit-bar=""
                        data-myjob-dim={isNotMine ? 'bar' : undefined}
                        onClick={handleBarClick}
                        className={clsx(
                            "absolute w-1.5 z-10 rounded-b-sm border-x pointer-events-auto cursor-pointer",
                            colors.bg,
                            colors.border,
                            colors.shadow
                        )}
                        style={{
                            top: `${iconPx / 2}px`,
                            height: `${Math.max(0, durationHeight)}px`,
                            left: `calc(50% + ${overlapOffset}px)`,
                            transform: 'translateX(-50%)'
                        }}
                    >
                        {/* ホバー検知だけを担う内側のTooltip。棒自体の絶対配置(top/height/left/transform)は
                            外側のdivのまま変えず、内側を重ねるだけに留める(2026-08-26)。棒の見た目の
                            幅(6px)そのままだと当たり判定が細すぎて確認しづらいとの実機FBのため、
                            左右3pxずつ当たり判定だけ広げる(見た目のバー幅は変えない)。同じ持ち主の
                            隣接レーン間隔が12px(PLACEMENT_STEP)のため、3px×2=6pxの拡張なら隣のレーンの
                            判定と重ならない上限ちょうど。 */}
                        <Tooltip
                            content={isSheetIcon ? null : <img src={iconUrl} alt="" className="w-4 h-4 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />}
                            bare
                            below={slideOnSort || undefined}
                            // Tooltipのデフォルトwrapperはw-fit/h-fit(fit-content)なので、left+rightだけ
                            // 指定してもfit-contentが優先されてしまい伸びない(実機で「ホバーしても
                            // 何も出ない」不具合の原因=中身が事実上0サイズに潰れていた)。w-auto/h-autoで
                            // 明示的に上書きしてinset基準の伸縮を効かせる。
                            wrapperClassName="!absolute !inset-y-0 !-left-[3px] !-right-[3px] !w-auto !h-auto"
                        >
                            <div className="w-full h-full" />
                        </Tooltip>
                    </div>
                )}

                {/* 軍事の表だけ: 効果帯の終点の目盛り(見本 v11 css:513・10×1)。標準では出さない */}
                {slideOnSort && mitigation.duration > 1 && (
                    <div
                        data-mit-end=""
                        className="absolute pointer-events-none"
                        style={{
                            top: `${iconPx / 2 + Math.max(0, durationHeight)}px`,
                            left: `calc(50% + ${overlapOffset}px)`,
                            width: '10px', height: '1px', transform: 'translateX(-50%)',
                        }}
                    />
                )}

                {/* リキャスト残時間点線は廃止 (セッション 18 のリキャスト専用行で代替可能)。 */}
            </div>
        </>
    );
});
MitigationItem.displayName = 'MitigationItem';
