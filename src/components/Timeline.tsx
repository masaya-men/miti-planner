import React, { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TimelineRow } from './TimelineRow';
import { motion } from 'framer-motion';
import { useMitigationStore } from '../store/useMitigationStore';
import { useThemeStore } from '../store/useThemeStore';
import type { TimelineEvent, Mitigation, AppliedMitigation } from '../types';
import { EventModal } from './EventModal';
import { PhaseModal } from './PhaseModal';
import { getMitigationPriority } from '../data/mockData';

import { MitigationSelector } from './MitigationSelector';
import { JobPicker } from './JobPicker';
import { PartyStatusPopover } from './PartyStatusPopover';
import { PartySettingsModal } from './PartySettingsModal';
import { AASettingsPopover } from './AASettingsPopover';
import { Plus, Settings, Shield, User, Sword } from 'lucide-react';
import { JOBS, MITIGATIONS } from '../data/mockData';
import clsx from 'clsx';

// Helper for column widths
export const getColumnWidth = (role: string) => {
    if (role === 'tank' || role === 'healer') return 125; // 25px * 5 slots
    return 50; // 25px * 2 slots for DPS
};

interface MitigationItemProps {
    mitigation: AppliedMitigation;
    pixelsPerSecond: number;
    onRemove: (id: string) => void;
    onUpdateTime: (id: string, newTime: number) => void;
    top: number;
    height: number;
    left: number;
    laneIndex?: number;
    partySortOrder?: 'role' | 'light_party';
    offsetTime: number;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const getMitigationColorClasses = (jobId: string | undefined, ownerId: string, partySortOrder: string = 'role') => {
    // 1. Light Party Sort Logic (Group based)
    if (partySortOrder === 'light_party') {
        const mtGroup = ['MT', 'H1', 'D1', 'D3'];
        // const stGroup = ['ST', 'H2', 'D2', 'D4']; 

        if (mtGroup.includes(ownerId)) {
            // MT Group -> Cyan/Blue Theme
            return {
                bg: "bg-cyan-500/80",
                border: "border-cyan-400/30",
                shadow: "shadow-[0_0_5px_rgba(6,182,212,0.5)]"
            };
        } else {
            // ST Group -> Amber/Orange Theme
            return {
                bg: "bg-amber-500/80",
                border: "border-amber-400/30",
                shadow: "shadow-[0_0_5px_rgba(245,158,11,0.5)]"
            };
        }
    }

    // 2. Role Sort Logic (Job/Role based)
    if (!jobId) return {
        bg: "bg-slate-400/80",
        border: "border-slate-300/30",
        shadow: "shadow-[0_0_5px_rgba(148,163,184,0.5)]"
    };

    const tank = ['pld', 'war', 'drk', 'gnb'];
    const healer = ['whm', 'sch', 'ast', 'sge'];
    const melee = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];
    const ranged = ['brd', 'mch', 'dnc', 'blm', 'smn', 'rdm', 'pct']; // Phys & Magical

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

const MitigationItem: React.FC<MitigationItemProps> = ({ mitigation, onRemove, onUpdateTime, top, height, pixelsPerSecond, left, partySortOrder = 'role', offsetTime, scrollContainerRef }) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { contentLanguage } = useThemeStore();
    const dragStartRef = useRef<{ pointerY: number; scrollTop: number } | null>(null);
    const autoScrollRef = useRef<number | null>(null);
    const lastPointerYRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const timeLabelRef = useRef<HTMLDivElement>(null);

    const def = MITIGATIONS.find(m => m.id === mitigation.mitigationId);
    const colors = getMitigationColorClasses(def?.jobId, mitigation.ownerId, partySortOrder);

    // Calculate visualization metrics
    const durationHeight = height;
    const recast = def?.recast || def?.cooldown || 0;
    const recastPx = recast * pixelsPerSecond;

    // Direct DOM update for drag position (no React re-render)
    const updateDragPosition = (dy: number) => {
        if (!containerRef.current) return;
        containerRef.current.style.top = `${top + 13 + dy}px`;
        containerRef.current.style.zIndex = '50';
        containerRef.current.style.opacity = '0.9';

        // Show time indicator line
        const snappedTime = Math.max(offsetTime, mitigation.time + Math.round(dy / pixelsPerSecond));
        const snappedY = (snappedTime - offsetTime) * pixelsPerSecond;
        const relativeY = snappedY - (top + 13 + dy); // relative to container

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
            timeLabelRef.current.textContent = `${sign}${min}:${sec.toString().padStart(2, '0')}`;
        }
    };

    const resetDragPosition = () => {
        if (!containerRef.current) return;
        containerRef.current.style.top = `${top + 13}px`;
        containerRef.current.style.zIndex = '';
        containerRef.current.style.opacity = '';
        if (indicatorRef.current) indicatorRef.current.style.display = 'none';
        if (timeLabelRef.current) timeLabelRef.current.style.display = 'none';
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragStartRef.current) return;
        onRemove(mitigation.id);
    };

    const handleTouchStart = () => {
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

    // Auto-scroll
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
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        dragStartRef.current = { pointerY: e.clientY, scrollTop };
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
        const deltaTime = Math.round(dy / pixelsPerSecond);
        dragStartRef.current = null;
        resetDragPosition();
        if (deltaTime !== 0) {
            const newTime = mitigation.time + deltaTime;
            onUpdateTime(mitigation.id, Math.max(offsetTime, newTime));
        }
    };

    const iconUrl = def?.icon;
    const name = contentLanguage === 'en' && def?.nameEn ? def.nameEn : def?.name;

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute z-30 flex flex-col items-center group select-none pointer-events-none"
            style={{ left: `${left}px`, top: `${top + 13}px`, width: '24px' }}
        >
            {/* Drag time indicator line */}
            <div
                ref={indicatorRef}
                className="absolute pointer-events-none"
                style={{ display: 'none', left: '-4px', width: '32px', height: '2px', background: 'rgba(56,189,248,0.8)', boxShadow: '0 0 6px rgba(56,189,248,0.6)', borderRadius: '1px', zIndex: 100 }}
            />
            {/* Drag time label */}
            <div
                ref={timeLabelRef}
                className="absolute pointer-events-none text-[10px] font-mono text-sky-300 bg-black/70 px-1 rounded"
                style={{ display: 'none', left: '28px', zIndex: 100 }}
            />
            {/* Icon - Interactive */}
            <div
                className="w-6 h-6 rounded shadow-md relative z-20 cursor-grab hover:scale-110 transition-transform bg-black/50 overflow-hidden border border-white/20 pointer-events-auto"
                onContextMenu={handleContextMenu}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                title={`${name || '軽減'} (ドラッグで移動 / 右クリックで削除)`}
            >
                {iconUrl ? <img src={iconUrl} className="w-full h-full object-cover pointer-events-none" draggable={false} /> : <div className="w-full h-full bg-slate-500"></div>}
            </div>

            {/* Effect Bar (Duration) */}
            <div
                className={clsx(
                    "w-1.5 relative z-10 rounded-b-sm border-x backdrop-blur-sm pointer-events-none",
                    colors.bg,
                    colors.border,
                    colors.shadow
                )}
                style={{ height: `${Math.max(0, durationHeight - 33)}px`, marginTop: '-4px' }}
            ></div>

            {/* Recast Line (Dotted) */}
            {recastPx > durationHeight && (
                <div
                    className="w-0 border-l-[2px] border-dotted border-slate-500/40 absolute z-0 pointer-events-none"
                    style={{
                        top: `${20 + Math.max(0, durationHeight - 33)}px`,
                        height: `${recastPx - Math.max(durationHeight, 33)}px`
                    }}
                ></div>
            )}
        </motion.div>
    );
};

export const Timeline: React.FC = () => {
    const { t } = useTranslation();

    // Column Width Logic
    // const getColumnWidth = (role: string) => (role === 'tank' || role === 'healer') ? 120 : 60;

    // memberLayout moved to after sortedPartyMembers definition

    const {
        timelineEvents, addEvent, updateEvent, removeEvent,
        phases, addPhase, updatePhase, removePhase,
        partyMembers, timelineMitigations, addMitigation, removeMitigation, updateMitigationTime,
        setMemberJob,
        aaSettings, setAaSettings,
        schAetherflowPatterns, setSchAetherflowPattern
    } = useMitigationStore();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    const [selectedTime, setSelectedTime] = useState<number>(0);
    const [eventModalPosition, setEventModalPosition] = useState({ x: 0, y: 0 });

    // Phase Modal State
    const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<{ id: string, name: string } | null>(null);
    const [selectedPhaseTime, setSelectedPhaseTime] = useState<number>(0);
    const [phaseModalPosition, setPhaseModalPosition] = useState({ x: 0, y: 0 });


    // Mitigation Selector State
    const [mitigationSelectorOpen, setMitigationSelectorOpen] = useState(false);
    const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMitigationTime, setSelectedMitigationTime] = useState<number>(0);

    // Job Picker State
    const [jobPickerOpen, setJobPickerOpen] = useState(false);
    const [jobPickerPosition, setJobPickerPosition] = useState({ x: 0, y: 0 });
    const [jobPickerMemberId, setJobPickerMemberId] = useState<string | null>(null);

    // Party Settings Modal
    const [partySettingsOpen, setPartySettingsOpen] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false); // For Stats Popover

    // AA Mode State
    const [isAaModeEnabled, setIsAaModeEnabled] = useState(false);
    const [aaSettingsOpen, setAaSettingsOpen] = useState(false);
    const aaSettingsButtonRef = useRef<HTMLButtonElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showPreStart] = useState(true); // Fixed for now, removed setter to fix lint

    const pixelsPerSecond = 50; // Configurable?
    const fightDuration = 1200; // 20 mins

    const gridLines = useMemo(() => {
        const lines = [];
        const start = -10;
        const end = fightDuration;
        for (let i = start; i <= end; i++) {
            lines.push(i);
        }
        return lines;
    }, [fightDuration]);

    // Group events by time for row-based rendering
    const eventsByTime = useMemo(() => {
        const map = new Map<number, TimelineEvent[]>();
        timelineEvents.forEach(event => {
            const t = event.time;
            if (!map.has(t)) map.set(t, []);
            map.get(t)?.push(event);
        });
        return map;
    }, [timelineEvents]);

    // --- Phase & Event Handlers ---
    const handleAddClick = (time: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Ensure we don't trigger other things

        if (isAaModeEnabled) {
            // Check if we can add an event (Max 2 per row)
            const existingEvents = eventsByTime.get(time) || [];
            if (existingEvents.length < 2) {
                // Add AA Event immediately
                const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
                addEvent({
                    id: newId,
                    time: time,
                    name: 'AA',
                    damageAmount: aaSettings.damage,
                    damageType: aaSettings.type, // Explicit cast if needed, but type matches matches string
                    target: aaSettings.target
                });
                return;
            } else {
                // Row full or other issue -> Normal behavior and turn off AA mode
                setIsAaModeEnabled(false);
                // Fall through to open modal
            }
        }

        setEventModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedTime(time);
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handlePhaseAdd = (time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setPhaseModalPosition({ x: e.clientX, y: e.clientY });
        // User Request: Consider Phase End Point as Time + 1 second
        setSelectedPhaseTime(time + 1);
        setSelectedPhase(null);
        setIsPhaseModalOpen(true);
    };

    const handlePhaseEdit = (id: string, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPhaseModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedPhase({ id, name: currentName });
        // Find existing time? Usually phase edit is just name?
        // But for "New Phase", we need time.
        // For Edit, time might be irrelevant or we might want to edit duration?
        // Let's keep it simple: Name only for now, as implemented in prompt version.
        setIsPhaseModalOpen(true);
    };

    const handlePhaseSave = (name: string, time?: number) => {
        if (selectedPhase) {
            updatePhase(selectedPhase.id, name);
        } else {
            // Create new phase
            // 'time' from handlePhaseAdd is typically the START time of the next phase or END time of the previous?
            // In this app, 'time' passed to addPhase is the END TIME of the phase being created at that row index.
            // The row index represents 'time'. Changing that to a phase end point.

            const targetTime = time !== undefined ? time : selectedPhaseTime;
            if (targetTime !== undefined) {
                addPhase(targetTime, name);
            }
        }
    };

    const handlePhaseDelete = () => {
        if (selectedPhase) {
            removePhase(selectedPhase.id);
            setIsPhaseModalOpen(false);
        }
    };

    const handleEventClick = (event: TimelineEvent, e: React.MouseEvent) => {
        e.stopPropagation();

        // If AA Mode is On, clicking an existing event turns it off (Normal behavior - edit)
        if (isAaModeEnabled) {
            setIsAaModeEnabled(false);
        }

        setEventModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handleSave = (eventData: Omit<TimelineEvent, 'id'>) => {
        // Robust ID generation
        const generateId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'evt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        };

        const newId = generateId();

        if (selectedEvent) {
            updateEvent(selectedEvent.id, eventData);
        } else {
            addEvent({
                ...eventData,
                id: newId,
            });
        }
        setIsModalOpen(false); // Ensure modal closes
    };

    const handleDelete = () => {
        if (selectedEvent) {
            if (confirm('このイベントを削除しますか？')) {
                removeEvent(selectedEvent.id);
                setIsModalOpen(false);
            }
        }
    };

    // --- Mitigation Handlers ---
    const handleCellClick = (memberId: string, time: number, e: React.MouseEvent) => {
        const member = partyMembers.find(m => m.id === memberId);
        if (!member || !member.jobId) return;

        setSelectorPosition({ x: e.clientX, y: e.clientY });
        setSelectedMemberId(memberId);
        setSelectedMitigationTime(time);
        setMitigationSelectorOpen(true);
    };

    const handleMitigationSelect = (mitigation: Mitigation) => {
        if (!selectedMemberId) return;

        addMitigation({
            id: globalThis.crypto?.randomUUID() || Math.random().toString(36).substring(2, 15),
            mitigationId: mitigation.id,
            time: selectedMitigationTime,
            duration: mitigation.duration,
            ownerId: selectedMemberId
        });
        setMitigationSelectorOpen(false);
    };



    // --- Job Picker Handlers ---
    const handleJobIconClick = (memberId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setJobPickerPosition({ x: e.clientX, y: e.clientY });
        setJobPickerMemberId(memberId);
        setJobPickerOpen(true);
    };

    const handleJobSelect = (jobId: string) => {
        if (jobPickerMemberId) {
            setMemberJob(jobPickerMemberId, jobId);
        }
        setJobPickerOpen(false);
    };

    // --- Calculation Helpers ---
    // calculateDamage is used in useMemo, so it must be defined BEFORE damageMap
    // Memoize damage calculation with stateful shield decay
    const damageMap = useMemo(() => {
        const map = new Map<string, { unmitigated: number; mitigated: number, mitigationPercent: number, shieldTotal: number, isInvincible?: boolean }>();

        // 1. Sort events by time to process chronologically
        const sortedEvents = [...timelineEvents].sort((a, b) => a.time - b.time);

        // 2. Shield State Tracking
        // Contexts: 'MT', 'ST', 'Party'. 
        // Maps Context -> (MitigationInstanceId -> RemainingHP)
        const shieldStates = new Map<string, Map<string, number>>();

        const getShieldState = (context: string, instanceId: string, maxValue: number) => {
            if (!shieldStates.has(context)) {
                shieldStates.set(context, new Map());
            }
            const contextMap = shieldStates.get(context)!;
            if (!contextMap.has(instanceId)) {
                contextMap.set(instanceId, maxValue);
            }
            return contextMap.get(instanceId)!;
        };

        const updateShieldState = (context: string, instanceId: string, newValue: number) => {
            if (!shieldStates.has(context)) {
                shieldStates.set(context, new Map());
            }
            shieldStates.get(context)!.set(instanceId, newValue);
        };

        // 3. Process Events
        sortedEvents.forEach(event => {
            if (!event.damageAmount) {
                map.set(event.id, { unmitigated: 0, mitigated: 0, mitigationPercent: 0, shieldTotal: 0, isInvincible: false });
                return;
            }

            // Determine Contexts
            const target = event.target;
            // Explicit check to satisfy Typescript narrowing
            const displayContext = (target === 'MT' || target === 'ST') ? target : 'Party';

            // Affected contexts for shield consumption
            // AOE hits everyone -> Update Party, MT, ST
            // Single Target hits one -> Update that one
            const affectedContexts = (target === 'MT' || target === 'ST') ? [target] : ['Party', 'MT', 'ST'];

            // Calculation variables for the DISPLAY context
            let currentDamage = event.damageAmount;
            let mitigationMultipliers = 1;
            let displayShieldTotal = 0; // Available shield for display
            let displayShieldAbsorbed = 0; // Actually used shield for display
            let isInvincibleForEvent = false;

            // Find Active Mitigations
            const activeMitigations = timelineMitigations.filter(m =>
                m.time <= event.time && event.time < m.time + m.duration
            );

            // Step A: % Mitigations
            activeMitigations.forEach(appMit => {
                const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                if (!def || def.isShield) return;

                // Scope Check: Self buffs only apply to owner (and not to Party context)
                if (def.scope === 'self' && appMit.ownerId !== displayContext) return;

                // Invulnerability Check
                if (def.isInvincible) {
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }

                if (isInvincibleForEvent) return;

                let mitigationValue = def.value;
                if (event.damageType === 'physical' && def.valuePhysical !== undefined) {
                    mitigationValue = def.valuePhysical;
                } else if (event.damageType === 'magical' && def.valueMagical !== undefined) {
                    mitigationValue = def.valueMagical;
                } else {
                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;
                }

                const multiplier = (1 - mitigationValue / 100);
                currentDamage *= multiplier;
                mitigationMultipliers *= multiplier;
            });

            // Round down damage after % mits
            currentDamage = Math.floor(currentDamage);

            // Store the damage to be applied to shields for state updates
            // (Simplification: using the same calculated damage for all contexts)
            const damageForShields = currentDamage;

            // Step B: Shields with Decay (Apply to ALL affected contexts)
            if (!isInvincibleForEvent) {
                activeMitigations.forEach(appMit => {
                    const def = MITIGATIONS.find(m => m.id === appMit.mitigationId);
                    if (!def) return;

                    // Check for Conditional Shields (e.g. Helios Conjunction with Neutral Sect)
                    let isConditionalShield = false;
                    if (def.id === 'helios_conjunction') {
                        // Check if Neutral Sect is active at cast time
                        const nsActive = timelineMitigations.some(m =>
                            m.mitigationId === 'neutral_sect' &&
                            m.time <= appMit.time &&
                            appMit.time < m.time + m.duration
                        );
                        if (nsActive) isConditionalShield = true;
                    }

                    if (!def.isShield && !isConditionalShield) return;

                    // Scope Check: Self shields only apply to owner
                    if (def.scope === 'self' && appMit.ownerId !== displayContext) return;

                    if (def.type === 'physical' && event.damageType === 'magical') return;
                    if (def.type === 'magical' && event.damageType === 'physical') return;

                    const member = partyMembers.find(m => m.id === appMit.ownerId);
                    if (!member) return;

                    // Calculate Healing Potency Multiplier (Snapshot at cast time)
                    let healingMultiplier = 1;
                    const buffsAtCast = timelineMitigations.filter(b =>
                        b.time <= appMit.time && appMit.time < b.time + b.duration && b.id !== appMit.id
                    );

                    buffsAtCast.forEach(buff => {
                        const bDef = MITIGATIONS.find(d => d.id === buff.mitigationId);
                        if (bDef && bDef.healingIncrease) {
                            // Check if this buff applies to the current displayContext
                            // (e.g. Minne on MT boosts shields on MT)
                            // Party buffs apply to everyone. Self buffs apply only to owner.
                            if (bDef.scope === 'self' && buff.ownerId !== displayContext) return;

                            healingMultiplier += (bDef.healingIncrease / 100);
                        }
                    });

                    const maxValBase = member.computedValues[def.name] || 0;
                    const maxVal = Math.floor(maxValBase * healingMultiplier);

                    // 1. Calculate for Display (Viewpoint)
                    const remainingForDisplay = getShieldState(displayContext, appMit.id, maxVal);
                    displayShieldTotal += remainingForDisplay;

                    if (remainingForDisplay > 0 && currentDamage > 0) {
                        const absorbed = Math.min(remainingForDisplay, currentDamage);
                        currentDamage -= absorbed;
                        displayShieldAbsorbed += absorbed;
                    }

                    // 2. Update States for ALL Affected Contexts
                    affectedContexts.forEach(ctx => {
                        const remaining = getShieldState(ctx, appMit.id, maxVal);
                        if (remaining > 0) {
                            const absorbed = Math.min(remaining, damageForShields);
                            updateShieldState(ctx, appMit.id, remaining - absorbed);
                        }
                    });
                });
            }

            // Final Display Values
            const finalTaken = Math.max(0, currentDamage);
            const percentMod = Math.round((1 - mitigationMultipliers) * 100);

            map.set(event.id, {
                unmitigated: event.damageAmount,
                mitigated: finalTaken,
                mitigationPercent: percentMod,
                shieldTotal: displayShieldTotal, // Show available shield overlap at start of event
                isInvincible: isInvincibleForEvent
            });
        });

        return map;
    }, [eventsByTime, timelineMitigations, partyMembers]);

    // Party Sorting State
    const [partySortOrder, setPartySortOrder] = useState<'light_party' | 'role'>('light_party');

    // Derived Sorted Party Members
    const sortedPartyMembers = useMemo(() => {
        // Define priority maps for each sort order
        const lightPartyOrder = ['MT', 'H1', 'D1', 'D3', 'ST', 'H2', 'D2', 'D4'];
        const roleOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];

        const order = partySortOrder === 'light_party' ? lightPartyOrder : roleOrder;

        return [...partyMembers].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
    }, [partyMembers, partySortOrder]);

    const memberLayout = useMemo(() => {
        let currentLeft = 570;
        const layout = new Map<string, { left: number; width: number }>();
        sortedPartyMembers.forEach(m => {
            const width = getColumnWidth(m.role);
            layout.set(m.id, { left: currentLeft, width });
            currentLeft += width;
        });
        return layout;
    }, [sortedPartyMembers]);





    const getJobIcon = (jobId: string | null) => {
        if (!jobId) return null;
        const job = JOBS.find(j => j.id === jobId);
        return job ? job.icon : null;
    };

    return (
        <>
            <div className="flex flex-col h-full w-full bg-transparent px-6 pt-2 pb-6 overflow-auto relative">
                <div className="absolute inset-0 pointer-events-none"></div>

                {/* Control Bar (Status & Settings) - Moved to Top as requested */}
                <div className="mb-4 flex items-center justify-between bg-black/20 backdrop-blur-xl p-2 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-white/5 relative z-[100] group/bar">
                    {/* Subtle Top Highlight */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                    <div className="flex items-center gap-2 relative">
                        <button
                            onClick={() => setPartySettingsOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm text-slate-100 group/btn relative overflow-hidden cursor-pointer water-drop"
                            title={t('party.title')}
                        >
                            <User size={16} className="text-blue-300 opacity-100 group-hover/btn:text-white group-hover/btn:scale-110 transition-all duration-300" />
                            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-100 group-hover/btn:text-white transition-colors shadow-black/50 drop-shadow-sm">{t('party.comp_short')}</span>
                        </button>

                        <button
                            onClick={() => setStatusOpen(!statusOpen)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-2xl text-sm transition-all duration-300 relative overflow-hidden group/btn cursor-pointer",
                                statusOpen
                                    ? "bg-blue-500/40 border-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] border"
                                    : "water-drop text-slate-100 hover:text-white"
                            )}
                            title={t('settings.party_stats')}
                        >
                            <Shield size={16} className={clsx("transition-transform duration-300 group-hover/btn:scale-110", statusOpen ? "text-white" : "text-blue-300 group-hover/btn:text-white")} />
                            <span className="font-bold text-[10px] uppercase tracking-wider shadow-black/50 drop-shadow-sm">{t('settings.config_short')}</span>
                        </button>

                        {/* AA Mode Toggle */}
                        <div className="flex items-center gap-0.5 relative">
                            <button
                                onClick={() => setIsAaModeEnabled(!isAaModeEnabled)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2 rounded-l-2xl text-sm transition-all duration-300 relative overflow-hidden group/btn cursor-pointer border",
                                    isAaModeEnabled
                                        ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.6)]"
                                        : "bg-transparent border-transparent water-drop text-slate-100 hover:text-white hover:bg-white/5"
                                )}
                                title="AA Registration Mode"
                            >
                                <Sword size={16} className={clsx("transition-transform duration-300 group-hover/btn:scale-110", isAaModeEnabled ? "text-white" : "text-slate-300 group-hover/btn:text-white")} />
                                <span className="font-bold text-[10px] uppercase tracking-wider shadow-black/50 drop-shadow-sm">AA Mode</span>
                            </button>
                            <button
                                ref={aaSettingsButtonRef}
                                onClick={() => setAaSettingsOpen(!aaSettingsOpen)}
                                className={clsx(
                                    "px-1.5 py-2 rounded-r-2xl border-l-[1px] border-white/10 transition-colors cursor-pointer hover:bg-white/10",
                                    isAaModeEnabled ? "bg-blue-600 border-blue-500 text-white" : "bg-transparent text-slate-400"
                                )}
                                title="AA Settings"
                            >
                                <Settings size={12} />
                            </button>

                            {/* AA Settings Popover - Positioned Right of Gear */}
                            <div className="absolute top-0 left-full ml-2 z-[101] origin-top-left">
                                <AASettingsPopover
                                    isOpen={aaSettingsOpen}
                                    onClose={() => setAaSettingsOpen(false)}
                                    settings={aaSettings}
                                    onSettingsChange={setAaSettings}
                                    triggerRef={aaSettingsButtonRef}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status Popover */}
                    <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />

                    {/* Sorting Controls */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-black/50 rounded-2xl border border-white/15 relative shadow-inner">
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/[0.05] pointer-events-none" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mr-2 shadow-black/50 drop-shadow-sm">{t('ui.sort')}:</span>

                        <div className="flex gap-1 bg-black/30 p-1 rounded-xl border border-white/10">
                            <button
                                onClick={() => setPartySortOrder('light_party')}
                                className={clsx(
                                    "px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 border cursor-pointer",
                                    partySortOrder === 'light_party'
                                        ? "bg-white/25 text-white border-white/40 shadow-sm"
                                        : "text-slate-300 border-transparent hover:text-white hover:bg-white/15"
                                )}
                            >
                                LIGHT PARTY
                            </button>
                            <div className="w-[1px] h-4 bg-white/15 my-auto" />
                            <button
                                onClick={() => setPartySortOrder('role')}
                                className={clsx(
                                    "px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 border cursor-pointer",
                                    partySortOrder === 'role'
                                        ? "bg-white/25 text-white border-white/40 shadow-sm"
                                        : "text-slate-300 border-transparent hover:text-white hover:bg-white/15"
                                )}
                            >
                                Role Order
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative flex-1 flex flex-col pt-0 glass-panel rounded-xl overflow-hidden shadow-2xl border border-white/5">
                    {/* SCH Aetherflow Pattern Toggle Bars - one per SCH member */}
                    {(() => {
                        const schMembers = sortedPartyMembers
                            .map((m, idx) => ({ member: m, idx }))
                            .filter(({ member }) => member.jobId === 'sch');
                        if (schMembers.length === 0) return null;
                        const fixedColsWidth = 570;
                        return (
                            <div className="flex-shrink-0 z-[51] h-7 relative bg-[#111214]/90 backdrop-blur-md border-b border-white/[0.03]">
                                {schMembers.map(({ member, idx }) => {
                                    let schLeft = fixedColsWidth;
                                    for (let i = 0; i < idx; i++) {
                                        schLeft += getColumnWidth(sortedPartyMembers[i].role);
                                    }
                                    const schWidth = getColumnWidth('healer');
                                    const isPatternOne = (schAetherflowPatterns[member.id] ?? 1) === 1;
                                    return (
                                        <div
                                            key={member.id}
                                            className="absolute top-0 h-full flex items-center justify-center"
                                            style={{ left: `${schLeft - 30}px`, width: `${schWidth + 60}px` }}
                                        >
                                            <button
                                                onClick={() => setSchAetherflowPattern(member.id, isPatternOne ? 2 : 1)}
                                                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/50 border border-white/10 hover:border-amber-400/40 hover:bg-black/70 transition-all duration-300 cursor-pointer group shadow-lg"
                                                title={isPatternOne ? '転化先 → 転化後に切替' : '転化後 → 転化先に切替'}
                                            >
                                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mr-0.5">START</span>
                                                <div className="flex items-center gap-0.5">
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-md overflow-hidden transition-all duration-300 ring-1",
                                                        isPatternOne
                                                            ? "ring-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                                                            : "ring-white/10 opacity-60"
                                                    )}>
                                                        <img src="/icons/Dissipation.png" alt="転化" className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                                <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />
                                                <div className="flex items-center gap-0.5">
                                                    <div className={clsx(
                                                        "w-5 h-5 rounded-md overflow-hidden transition-all duration-300 ring-1",
                                                        !isPatternOne
                                                            ? "ring-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.3)]"
                                                            : "ring-white/10 opacity-60"
                                                    )}>
                                                        <img src="/icons/Aetherflow.png" alt="AF" className="w-full h-full object-contain" />
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* Header Row - sticky within scroll container */}
                    <div className={clsx(
                        "flex-shrink-0 z-50 bg-[#0a0a0c]/40 backdrop-blur-xl border-b border-white/10 text-[11px] font-barlow font-medium text-app-text-muted uppercase tracking-wider text-center h-10 shadow-lg select-none overflow-hidden"
                    )}>
                        {/* ▼▼ 追加: 中身に合わせて伸びるラッパー箱 (PCのみ幅固定) ▼▼ */}
                        <div className="flex items-center h-full md:w-max md:min-w-full">
                            <div className="w-[100px] min-w-[100px] max-w-[100px] flex-none border-r border-white/5 h-full flex items-center justify-center text-app-accent-secondary/80 font-bold bg-transparent">
                                Ph
                            </div>

                            <div className="w-[70px] min-w-[70px] max-w-[70px] flex-none border-r border-white/5 h-full flex items-center justify-center bg-transparent text-app-text-muted/70 font-bold text-[10px]">Time</div>
                            <div className="w-[200px] min-w-[200px] max-w-[200px] flex-none border-r border-white/5 h-full flex items-center justify-center bg-transparent text-app-text-muted/70 text-[10px] pl-2 justify-start font-bold">Mechanic</div>
                        </div>
                        <div className="w-[100px] min-w-[100px] max-w-[100px] flex-none border-r border-white/5 h-full flex items-center justify-center bg-transparent text-app-text-muted/70 text-[10px] font-bold">Raw</div>
                        <div className="w-[100px] min-w-[100px] max-w-[100px] flex-none border-r border-white/5 h-full flex items-center justify-center bg-transparent text-app-text-muted/70 text-[10px] font-bold">Taken</div>

                        {/* Job Columns Headers */}
                        {sortedPartyMembers.map((member, index) => (
                            <div
                                key={member.id}
                                style={{ width: `${getColumnWidth(member.role)}px`, minWidth: `${getColumnWidth(member.role)}px`, maxWidth: `${getColumnWidth(member.role)}px` }}
                                className={clsx(
                                    "flex-none border-r border-white/5 h-full flex flex-col items-center justify-center p-0.5 relative group",
                                    index === sortedPartyMembers.length - 1 && "rounded-tr-2xl border-r-0",
                                    // Vivid Glass Effect for Groups
                                    partySortOrder === 'role' ? (
                                        member.role === 'tank' ? "bg-gradient-to-b from-blue-600/20 via-blue-600/5 to-transparent shadow-[inset_0_1px_0_rgba(37,99,235,0.5)]" :
                                            member.role === 'healer' ? "bg-gradient-to-b from-green-500/20 via-green-500/5 to-transparent shadow-[inset_0_1px_0_rgba(34,197,94,0.5)]" :
                                                "bg-gradient-to-b from-red-500/20 via-red-500/5 to-transparent shadow-[inset_0_1px_0_rgba(239,68,68,0.5)]"
                                    ) : (
                                        // Light Party Default (Blue vs Gold)
                                        ['MT', 'H1', 'D1', 'D3'].includes(member.id)
                                            ? "bg-gradient-to-b from-cyan-500/20 via-blue-500/5 to-transparent shadow-[inset_0_1px_0_rgba(6,182,212,0.5)]" // MT Group (Cyan/Blue)
                                            : "bg-gradient-to-b from-amber-500/20 via-orange-500/5 to-transparent shadow-[inset_0_1px_0_rgba(245,158,11,0.5)]" // ST Group (Amber/Gold)
                                    )
                                )}
                            >
                                <div
                                    className={clsx(
                                        "flex items-center justify-center w-full h-full rounded cursor-pointer hover:bg-white/10 transition-all duration-300 relative"
                                    )}
                                    onClick={(e) => handleJobIconClick(member.id, e)}
                                    title={`${member.id} (${t('ui.change_job')})`}
                                >
                                    {member.jobId ? (
                                        <img src={getJobIcon(member.jobId) || ''} alt={member.jobId} className="w-6 h-6 object-contain opacity-90 drop-shadow-sm transition-transform hover:scale-110" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                                            <Plus size={10} className="text-app-text-muted" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div> {/* ◀◀ 追加したラッパーを閉じる */}
                </div> {/* ◀◀ 追加したラッパーを閉じる */}

                <div className="flex-1 overflow-auto relative" ref={scrollContainerRef} onScroll={handleBodyScroll}>
                    {/* ▼▼ md:w-max md:min-w-full を追加 ▼▼ */}
                    <div className="relative bg-transparent md:w-max md:min-w-full" style={{ height: `${(gridLines.length) * pixelsPerSecond}px` }}>                            {/* Time Grid & Columns */}
                        {gridLines.map((time) => {
                            const offsetTime = showPreStart ? -10 : 0;
                            const rowEvents = eventsByTime.get(time) || [];
                            const rowDamages = rowEvents.map(event => damageMap.get(event.id) || null);

                            return (
                                <TimelineRow
                                    key={time}
                                    time={time}
                                    top={(time - offsetTime) * pixelsPerSecond}
                                    damages={rowDamages}
                                    events={rowEvents}
                                    partyMembers={sortedPartyMembers}
                                    onPhaseAdd={handlePhaseAdd}
                                    onAddEventClick={handleAddClick}
                                    onEventClick={handleEventClick}
                                    onCellClick={handleCellClick}
                                    partySortOrder={partySortOrder}
                                />
                            );
                        })}

                        {/* Render Phases */}
                        {phases.map((phase, index) => {
                            if (!showPreStart && phase.endTime <= 0) return null;

                            const offsetTime = showPreStart ? -10 : 0;
                            const startTime = index === 0 ? -10 : phases[index - 1].endTime;
                            const endTime = phase.endTime;

                            if (!showPreStart && endTime <= 0) return null;

                            const effectiveStartTime = Math.max(startTime, offsetTime);
                            const effectiveEndTime = Math.max(endTime, offsetTime);
                            const duration = effectiveEndTime - effectiveStartTime;

                            const topTime = effectiveStartTime - offsetTime;
                            const top = topTime * pixelsPerSecond;
                            const height = duration * pixelsPerSecond;

                            return (
                                <div
                                    key={phase.id}
                                    className="absolute left-0 w-[100px] border-r border-white/20 bg-white/10 flex items-center justify-center text-sm font-bold text-slate-100 cursor-pointer hover:bg-white/20 transition-colors pointer-events-auto z-10 backdrop-blur-sm shadow-[inset_4px_0_0_0_rgba(255,255,255,0.2)]"
                                    style={{ top: `${top}px`, height: `${height}px` }}
                                    onClick={(e) => handlePhaseEdit(phase.id, phase.name, e)}
                                    title="クリックして名前を変更"
                                >
                                    <div className="transform -rotate-90 whitespace-nowrap overflow-hidden text-ellipsis px-2 drop-shadow-md">
                                        {phase.name}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Render Events Loop Removed - Events are now inside TimelineRow */}

                        {/* Render Mitigations via new Component with Lane Logic */}
                        {(() => {
                            // 1. Filter visible
                            const visibleMitigations = timelineMitigations.filter(m =>
                                showPreStart || (m.time + m.duration > 0)
                            );

                            // 2. Assign Lanes
                            // Group by owner
                            const mitigationsByOwner: Record<string, typeof timelineMitigations> = {};
                            visibleMitigations.forEach(m => {
                                if (!mitigationsByOwner[m.ownerId]) mitigationsByOwner[m.ownerId] = [];
                                mitigationsByOwner[m.ownerId].push(m);
                            });

                            const renderedItems: React.ReactElement[] = [];

                            Object.entries(mitigationsByOwner).forEach(([, ownerMitigations]) => {
                                // Sort by time, then by priority for overlapping mitigations
                                ownerMitigations.sort((a, b) => {
                                    if (a.time !== b.time) return a.time - b.time;
                                    return getMitigationPriority(a.mitigationId) - getMitigationPriority(b.mitigationId);
                                });

                                // Lane Packing
                                const lanes: number[] = [];

                                ownerMitigations.forEach(mitigation => {
                                    const startTime = mitigation.time;
                                    const member = partyMembers.find(m => m.id === mitigation.ownerId);
                                    const maxLanes = (member?.role === 'tank' || member?.role === 'healer') ? 5 : 2;

                                    // Find first free lane
                                    let laneIndex = lanes.findIndex(endTime => endTime <= startTime);

                                    if (laneIndex === -1) {
                                        if (lanes.length < maxLanes) {
                                            laneIndex = lanes.length;
                                            lanes.push(startTime + mitigation.duration);
                                        } else {
                                            laneIndex = maxLanes - 1;
                                            lanes[laneIndex] = Math.max(lanes[laneIndex], startTime + mitigation.duration);
                                        }
                                    } else {
                                        lanes[laneIndex] = startTime + mitigation.duration;
                                    }

                                    laneIndex = Math.min(laneIndex, maxLanes - 1);

                                    const offsetTime = showPreStart ? -10 : 0;
                                    const top = (mitigation.time - offsetTime) * pixelsPerSecond;
                                    const height = mitigation.duration * pixelsPerSecond;

                                    const layout = memberLayout.get(mitigation.ownerId);
                                    const colStart = layout ? layout.left : 0;
                                    const left = colStart + 2 + (laneIndex * 24);

                                    renderedItems.push(
                                        <MitigationItem
                                            key={mitigation.id}
                                            mitigation={mitigation}
                                            pixelsPerSecond={pixelsPerSecond}
                                            onRemove={removeMitigation}
                                            onUpdateTime={updateMitigationTime}
                                            top={top}
                                            height={height}
                                            left={left}
                                            partySortOrder={partySortOrder}
                                            offsetTime={showPreStart ? -10 : 0}
                                            scrollContainerRef={scrollContainerRef}
                                        />
                                    );
                                });
                            });

                            return renderedItems;
                        })()}
                    </div>
                </div>
            </div>
        </div >


            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
                initialData={selectedEvent}
                initialTime={selectedTime}
                position={eventModalPosition}
            />

            <PhaseModal
                isOpen={isPhaseModalOpen}
                isEdit={!!selectedPhase}
                initialName={selectedPhase?.name || ''}
                initialTime={selectedPhaseTime}
                onClose={() => setIsPhaseModalOpen(false)}
                onSave={handlePhaseSave}
                onDelete={selectedPhase ? handlePhaseDelete : undefined}
                position={phaseModalPosition}
            />

            <MitigationSelector
                isOpen={mitigationSelectorOpen}
                onClose={() => setMitigationSelectorOpen(false)}
                onSelect={handleMitigationSelect}
                jobId={selectedMemberId ? partyMembers.find(m => m.id === selectedMemberId)?.jobId || null : null}
                position={selectorPosition}
                activeMitigations={timelineMitigations.filter(m => m.ownerId === selectedMemberId)}
                selectedTime={selectedMitigationTime}
                schAetherflowPattern={(schAetherflowPatterns[selectedMemberId!] ?? 1)}
            />

            <JobPicker
                isOpen={jobPickerOpen}
                onClose={() => setJobPickerOpen(false)}
                onSelect={handleJobSelect}
                position={jobPickerPosition}
                currentJobId={jobPickerMemberId ? partyMembers.find(m => m.id === jobPickerMemberId)?.jobId || null : null}
            />

            <PartySettingsModal
                isOpen={partySettingsOpen}
                onClose={() => setPartySettingsOpen(false)}
            />
        </>
    );
};

export default Timeline;
