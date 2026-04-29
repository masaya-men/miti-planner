
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Calculator, Save } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { getPhaseName } from '../types';
import { useMitigationStore, DEFAULT_TANK_STATS, DEFAULT_HEALER_STATS } from '../store/useMitigationStore';
import { useMitigations, useJobs } from '../hooks/useSkillsData';
import { calculateMemberValues } from '../utils/calculator';
import { useThemeStore } from '../store/useThemeStore';
import { clsx } from 'clsx';
import { useTutorialStore } from '../store/useTutorialStore';
import { Tooltip } from './ui/Tooltip';
import { SegmentButton } from './ui/SegmentButton';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
// SPRING は今後のアニメーション実装で使用予定
// import { SPRING } from '../tokens/motionTokens';

/** 全角数字→半角変換し、数字と小数点以外を除去 */
function toHalfWidthNumber(str: string): string {
    return str.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
              .replace(/[^0-9.]/g, '');
}

// 軽減 ID から burst / crit / crit_protraction の接尾辞を剥がして base ID を返す
const stripVariantSuffix = (id: string): string => {
    return id.replace(/:(burst|crit|crit_protraction)$/, '');
};

// 鼓舞展開の秘策クリティカル倍率（calculator.ts の CRIT_MULTIPLIER と同値）
const CRIT_MULTIPLIER = 1.60;

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: Omit<TimelineEvent, 'id'>) => void;
    onDelete?: () => void;
    initialData?: TimelineEvent | null;
    initialTime?: number;
    position?: { x: number; y: number };
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, onDelete, initialData, initialTime, position }) => {
    useEscapeClose(isOpen, onClose);
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const [name, setName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
    const [time, setTime] = useState(0);
    const [damageType, setDamageType] = useState<TimelineEvent['damageType']>('magical');
    const [damageAmount, setDamageAmount] = useState<number>(0);
    const [target, setTarget] = useState<TimelineEvent['target']>('AoE');

    // Visible mitigations state for Tutorial Step 20
    const [visibleMitigations, setVisibleMitigations] = useState<Set<string>>(new Set());

    // Mobile Detection
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // IntersectionObserver for tracking visible mitigations
    useEffect(() => {
        if (!isOpen) {
            setVisibleMitigations(new Set());
            return;
        }

        const container = document.getElementById('mitigation-grid-container');
        if (!container) return;

        const observer = new IntersectionObserver((entries) => {
            setVisibleMitigations(prev => {
                const next = new Set(prev);
                entries.forEach(entry => {
                    const id = entry.target.getAttribute('data-mitigation-id');
                    if (id) {
                        if (entry.isIntersecting) {
                            next.add(id);
                        } else {
                            next.delete(id);
                        }
                    }
                });
                return next;
            });
        }, {
            root: container,
            threshold: 0.1 // 10% visible is enough
        });

        // Small delay to ensure DOM is ready
        const timeoutId = setTimeout(() => {
            const items = container.querySelectorAll('[data-mitigation-id]');
            items.forEach(item => observer.observe(item));
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, [isOpen]);

    // ... (rest of logic same until return)

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setTime(initialData.time);
                setDamageType(initialData.damageType);
                setDamageAmount(initialData.damageAmount || 0);
                setTarget(initialData.target || 'AoE');

                // 👇 修正：すでにダメージが入っている場合は、電卓が上書きしないように「直接入力(Direct)」モードで開く
                if (initialData.damageAmount && initialData.damageAmount > 0) {
                    setInputMode('direct');
                } else {
                    setInputMode('reverse');
                }
                setCalcActualDamage(0);
                setSelectedMitigations([]);
                setMitigationTargets({});
            } else {
                setName({ ja: '', en: '' });
                setTime(initialTime || 0);
                setDamageType('magical');
                setDamageAmount(0);
                setTarget('AoE');
                // Reset calculator state
                setInputMode('reverse');
                setCalcActualDamage(0);
                setSelectedMitigations([]);
                setMitigationTargets({});
            }
            mitiPresetDoneRef.current = false;
        }
    }, [isOpen, initialData, initialTime]);

    // Calculator State
    const [inputMode, setInputMode] = useState<'direct' | 'reverse'>('reverse');
    const [calcActualDamage, setCalcActualDamage] = useState<number>(0);
    const [selectedMitigations, setSelectedMitigations] = useState<string[]>([]);
    const [mitigationTargets, setMitigationTargets] = useState<Record<string, 'MT' | 'ST'>>({});

    const { partyMembers, currentLevel } = useMitigationStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();

    const tutorialState = useTutorialStore();
    const isTutorialActive = tutorialState.isActive;
    const currentStep = isTutorialActive ? tutorialState.getCurrentStep() : null;
    const mitiPresetDoneRef = useRef(false);

    // Toggle mitigation selection
    const toggleMitigation = (id: string) => {
        if (isTutorialActive && (currentStep?.id === 'add-3-miti' || currentStep?.id === 'create-8-miti')) {
            const baseId = stripVariantSuffix(id);
            const mit = MITIGATIONS.find(m => m.id === baseId);
            if (currentStep?.id === 'create-8-miti') {
                if (!mit || mit.name.en !== 'Reprisal') return;
            } else {
                const isTargetSkill = mit && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en);
                if (!isTargetSkill) return;
            }
        }
        setSelectedMitigations(prev => {
            if (prev.includes(id)) return prev.filter(m => m !== id);
            const baseId = stripVariantSuffix(id);

            // deployment_tactics ファミリー (素 / 秘策 / 秘策+生命回生): 3 バリアント排他選択
            if (baseId === 'deployment_tactics') {
                return [
                    ...prev.filter(m => stripVariantSuffix(m) !== 'deployment_tactics'),
                    id,
                ];
            }

            // burst バリアント: base/burst を排他
            const isBurst = id.endsWith(':burst');
            const counterpart = isBurst ? baseId : `${id}:burst`;
            return [...prev.filter(m => m !== counterpart), id];
        });
    };

    const setMitigationTarget = (id: string, target: 'MT' | 'ST') => {
        setMitigationTargets(prev => ({ ...prev, [id]: target }));
    };

    // Sorting Logic
    // 3段階ソートキー: [roleOrder, jobOrder, scopeOrder]
    const getSortKey = (mit: typeof MITIGATIONS[0]): [number, number, number] => {
        const job = JOBS.find(j => j.id === mit.jobId);
        const role = job?.role || 'dps';

        // 1段目: ロール順 (tank=0, healer=1, dps=2)
        const roleOrder = role === 'tank' ? 0 : role === 'healer' ? 1 : 2;

        // 2段目: JOBS 配列での出現順（同ロール内のジョブ順）
        const jobOrder = JOBS.findIndex(j => j.id === mit.jobId);
        const safeJobOrder = jobOrder === -1 ? 999 : jobOrder;

        // 3段目: scope 順 (party=0, self=1, target=2, undefined=3)
        const scopeOrder =
            mit.scope === 'party' ? 0 :
            mit.scope === 'self' ? 1 :
            mit.scope === 'target' ? 2 : 3;

        return [roleOrder, safeJobOrder, scopeOrder];
    };

    const EXCLUDED_IDS = [
        'aurora', 'thrill_of_battle', 'holmgang', 'living_dead', 'superbolide', 'hallowed_ground',
        'helios_conjunction', 'summon_seraph', 'seraphism', 'philosophia', 'macrocosmos',
        'aspected_helios'
    ];

    const isPureHealOnly = (mit: typeof MITIGATIONS[0]): boolean => {
        return (
            mit.value === 0 &&
            !mit.isShield &&
            !mit.healingIncrease &&
            mit.valueMagical === undefined &&
            mit.valuePhysical === undefined
        );
    };

    // 鼓舞展開バリアント描画用のアイコンパス
    const recitationIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'recitation')?.icon ?? '',
        [MITIGATIONS]
    );
    const protractionIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'protraction')?.icon ?? '',
        [MITIGATIONS]
    );
    const deploymentIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'deployment_tactics')?.icon ?? '',
        [MITIGATIONS]
    );

    // Deduplicate mitigations by English name so role actions (Addle, Feint, Reprisal) only appear once
    const uniqueMitigations = useMemo(() => {
        const seenNames = new Set<string>();
        return MITIGATIONS.filter(mit => {
            // Level sync filtering
            if (mit.minLevel !== undefined && currentLevel < mit.minLevel) return false;
            if (mit.maxLevel !== undefined && currentLevel > mit.maxLevel) return false;

            // Filter out excluded IDs first
            if (EXCLUDED_IDS.includes(mit.id)) return false;

            // Filter out pure-heal-only skills (no mitigation value, no shield, no heal-up buff)
            if (isPureHealOnly(mit)) return false;

            const nameEN = mit.name.en;
            if (seenNames.has(nameEN)) return false;
            seenNames.add(nameEN);
            return true;
        });
    }, [currentLevel, MITIGATIONS]);

    const sortedMitigations = useMemo(() => {
        return [...uniqueMitigations].sort((a, b) => {
            const [ra, ja, sa] = getSortKey(a);
            const [rb, jb, sb] = getSortKey(b);
            if (ra !== rb) return ra - rb;
            if (ja !== jb) return ja - jb;
            if (sa !== sb) return sa - sb;
            return (a.name.ja || "").localeCompare(b.name.ja || "");
        });
    }, [uniqueMitigations, JOBS]);

    // Calculate Raw Damage
    const handleCalculate = () => {
        const actual = calcActualDamage;
        let shieldTotal = 0;
        let mitigationMult = 1;

        // healingIncrease: 選択スキル中の回復効果アップを先に集計
        let healingMultiplier = 1;
        selectedMitigations.forEach(mitId => {
            const baseId = stripVariantSuffix(mitId);
            const def = MITIGATIONS.find(m => m.id === baseId);
            if (!def || !def.healingIncrease) return;
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;
            // 新規: target=MT/ST のとき、scope='target' のバフは投げ先と一致するときだけ採用
            if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
                const assignedTarget = mitigationTargets[mitId] ?? 'MT';
                if (assignedTarget !== target) return;
            }
            healingMultiplier += (def.healingIncrease / 100);
        });

        selectedMitigations.forEach(mitId => {
            const isBurst = mitId.endsWith(':burst');
            const baseId = stripVariantSuffix(mitId);
            const def = MITIGATIONS.find(m => m.id === baseId);
            if (!def) return;

            // 鼓舞展開バリアント分岐 (deployment_tactics / :crit / :crit_protraction)
            if (baseId === 'deployment_tactics') {
                const variant = mitId.includes(':') ? mitId.split(':')[1] : 'plain';
                const schMember = partyMembers.find(m => m.jobId === 'sch');
                let baseShield = schMember?.computedValues['鼓舞激励の策'] ?? 0;

                // フォールバック: 学者不在 or computedValues 未生成のとき、デフォルトステータスで計算
                if (baseShield === 0) {
                    const tempComputed = calculateMemberValues(
                        { id: 'temp', jobId: 'sch', role: 'healer', stats: DEFAULT_HEALER_STATS, computedValues: {} } as any,
                        currentLevel
                    );
                    baseShield = tempComputed['鼓舞激励の策'] ?? 0;
                }

                if (baseShield > 0) {
                    let shield = baseShield;
                    if (variant === 'crit' || variant === 'crit_protraction') {
                        shield *= CRIT_MULTIPLIER;
                    }
                    if (variant === 'crit_protraction') {
                        const protractionDef = MITIGATIONS.find(m => m.id === 'protraction');
                        const hi = protractionDef?.healingIncrease ?? 10;
                        shield *= (1 + hi / 100);
                    }
                    shieldTotal += Math.floor(shield * healingMultiplier);
                }
                return; // 通常の value/isShield 集計をスキップ
            }

            // ニュートラルセクト分岐: 押下時にコンジャ/アスペクト・ヘリオスのバリアを自動加算
            // healingIncrease (selfOnly: 20%) は既存ロジックで自動適用される
            if (baseId === 'neutral_sect') {
                const heliosId = currentLevel >= 96 ? 'helios_conjunction' : 'aspected_helios';
                const heliosDef = MITIGATIONS.find(m => m.id === heliosId);
                const heliosName = heliosDef?.name.ja;
                if (heliosName) {
                    const astMember = partyMembers.find(m => m.jobId === 'ast');
                    let baseShield = astMember?.computedValues[heliosName] ?? 0;

                    // フォールバック: 占星不在 or computedValues 未生成のときデフォルトステータス計算
                    if (baseShield === 0) {
                        const tempComputed = calculateMemberValues(
                            { id: 'temp', jobId: 'ast', role: 'healer', stats: DEFAULT_HEALER_STATS, computedValues: {} } as any,
                            currentLevel
                        );
                        baseShield = tempComputed[heliosName] ?? 0;
                    }

                    if (baseShield > 0) {
                        shieldTotal += Math.floor(baseShield * healingMultiplier);
                    }
                }
                return;
            }

            // Scope filtering: AoE attacks only use party-wide mitigations
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;

            // 新規: target=MT/ST のとき、scope='target' のバフは投げ先と一致するときだけ採用
            if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
                const assignedTarget = mitigationTargets[mitId] ?? 'MT';
                if (assignedTarget !== target) return;
            }

            // Percentage Mitigation (apply for ALL skills with value > 0, including shield+mitigation hybrids)
            if (def.value > 0) {
                let val = def.value;
                if (damageType === 'physical' && def.valuePhysical !== undefined) {
                    val = def.valuePhysical;
                } else if (damageType === 'magical' && def.valueMagical !== undefined) {
                    val = def.valueMagical;
                } else {
                    if (def.type === 'physical' && damageType === 'magical') val = 0;
                    if (def.type === 'magical' && damageType === 'physical') val = 0;
                }

                mitigationMult *= (1 - val / 100);

                // Burst: apply additional mitigation from the enhanced window
                if (isBurst && def.burstValue) {
                    mitigationMult *= (1 - def.burstValue / 100);
                }
            }

            // Shield Calculation
            if (def.isShield) {
                // Always use Japanese name for computedValues lookup (SKILL_DATA keys are Japanese)
                const jaName = typeof def.name === 'string' ? def.name : (def.name.ja || '');
                const member = partyMembers.find(m => m.jobId === def.jobId);
                let shieldVal = 0;

                if (member && member.computedValues) {
                    shieldVal = member.computedValues[jaName] || 0;
                }

                // Fallback: use calculateMemberValues with default stats
                if (shieldVal === 0) {
                    let stats = DEFAULT_HEALER_STATS;
                    let role = 'healer';

                    if (def.jobId) {
                        const m2 = partyMembers.find(m => m.jobId === def.jobId);
                        if (m2) {
                            stats = m2.stats;
                            role = m2.role;
                        } else {
                            const job = JOBS.find(j => j.id === def.jobId);
                            if (job?.role === 'tank') { stats = DEFAULT_TANK_STATS; role = 'tank'; }
                        }
                    }

                    const tempComputed = calculateMemberValues(
                        { id: 'temp', jobId: def.jobId || null, role, stats, computedValues: {} } as any,
                        currentLevel
                    );
                    shieldVal = tempComputed[jaName] || 0;
                }

                // healingIncrease を適用
                shieldTotal += Math.floor(shieldVal * healingMultiplier);
            }
        });

        // Formula: Raw = (Actual + Shields) / Mult
        if (mitigationMult === 0) mitigationMult = 0.01;
        const raw = Math.ceil((actual + shieldTotal) / mitigationMult);

        return raw;
    };

    // Auto-calculate running effect
    useEffect(() => {
        if (inputMode === 'reverse') {
            const calculated = handleCalculate();
            setDamageAmount(calculated);
        }
    }, [calcActualDamage, selectedMitigations, mitigationTargets, damageType, inputMode, target]);

    // --- Tutorial Progression Logic ---
    const [targetActualDamage, setTargetActualDamage] = useState(0);

    // Compute expected damage for Step 9C
    useEffect(() => {
        if (isTutorialActive && currentStep?.id === 'add-2-damage') {
            const h1 = partyMembers.find(m => m.id === 'H1');
            setTargetActualDamage(Math.floor(h1 ? h1.stats.hp * 0.8 : 80000));
        }
    }, [isTutorialActive, currentStep?.id, partyMembers]);

    // Watchers for tutorial steps
    useEffect(() => {
        if (!isTutorialActive) return;

        // 9B: Name Input
        if (currentStep?.id === 'add-1-name') {
            setInputMode('reverse');
            const val = getPhaseName(name, contentLanguage).toLowerCase();
            if (val.includes('アルテマ') || val.includes('ultima')) {
                const tId = setTimeout(() => tutorialState.completeEvent('event:name-entered'), 500);
                return () => clearTimeout(tId);
            }
        }

        // 9C: Damage Input
        if (currentStep?.id === 'add-2-damage' && targetActualDamage > 0) {
            if (calcActualDamage === targetActualDamage) {
                const tId = setTimeout(() => tutorialState.completeEvent('event:damage-entered'), 500);
                return () => clearTimeout(tId);
            }
        }

        // 9D: Mitigation Selection
        if (currentStep?.id === 'add-3-miti') {
            const selectedENNames = selectedMitigations.map(id => MITIGATIONS.find(m => m.id === id)?.name.en);
            const hasReprisal = selectedENNames.includes('Reprisal');
            const hasAddle = selectedENNames.includes('Addle');
            const hasSoil = selectedENNames.includes('Sacred Soil');

            if (hasReprisal && hasAddle && hasSoil) {
                const tId = setTimeout(() => tutorialState.completeEvent('event:miti-selected'), 500);
                return () => clearTimeout(tId);
            }
        }

        // 9D: Auto-scroll to mitigations area
        if (currentStep?.id === 'add-3-miti') {
            const container = document.getElementById('event-modal-form');
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        // 9E: Auto-scroll to bottom (save button)
        if (currentStep?.id === 'add-4-save') {
            const container = document.getElementById('event-modal-form');
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }
        }

        // create-plan: ステップ8 — 軽減プリセット + リプライザル検知
        if (currentStep?.id === 'create-8-miti') {
            // プリセットは一度だけ、少し遅延させて isOpen リセットと競合しないようにする
            if (!mitiPresetDoneRef.current) {
                mitiPresetDoneRef.current = true;
                const presetTimer = setTimeout(() => {
                    const sacredSoilId = MITIGATIONS.find(m => m.name.en === 'Sacred Soil')?.id;
                    const divineVeilId = MITIGATIONS.find(m => m.name.en === 'Divine Veil')?.id;
                    const presets = [sacredSoilId, divineVeilId].filter((id): id is string => !!id);
                    setSelectedMitigations(prev => {
                        const newSet = new Set([...prev, ...presets]);
                        return Array.from(newSet);
                    });
                    // プリセット追加後にスクロール
                    setTimeout(() => {
                        const container = document.getElementById('event-modal-form');
                        if (container) {
                            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                        }
                    }, 50);
                }, 200);
                return () => clearTimeout(presetTimer);
            }

            // リプライザル選択で即座に次ステップへ（カードが上に流れるのを防止）
            const reprisalId = MITIGATIONS.find(m => m.name.en === 'Reprisal')?.id;
            if (reprisalId && selectedMitigations.includes(reprisalId)) {
                tutorialState.completeEvent('create:miti-selected');
            }
        }
    }, [name, contentLanguage, calcActualDamage, selectedMitigations, isTutorialActive, currentStep?.id, targetActualDamage, tutorialState]);

    const getTooltipText = (mit: typeof MITIGATIONS[0]) => {
        return getPhaseName(mit.name, contentLanguage);
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            time,
            damageType,
            damageAmount,
            target
        });
        useTutorialStore.getState().completeEvent('create:event-saved');
        onClose();
    };

    const handleBackdropClick = () => {
        // Tutorial: block closing the modal during the tutorial
        if (useTutorialStore.getState().isActive) return;

        if (name.ja.trim() || name.en.trim()) {
            onSave({ name, time, damageType, damageAmount, target });
        }
        onClose();
    };

    // Right-side positioning logic (offset by 20px from cursor)
    const x = position ? Math.min(position.x + 20, window.innerWidth - 520) : '50%';
    const y = position ? Math.min(position.y, window.innerHeight - 600) : '50%'; // Approx height

    // Style logic:
    // 1. Mobile -> Bottom sheet (fixed to bottom, above bottom nav)
    // 2. Tutorial Active -> Force Center
    // 3. Desktop with position -> Follow cursor
    // 4. Desktop without position -> Center
    const desktopStyle = isTutorialActive
        ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        : (position
            ? { left: x, top: y }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        );

    return createPortal(
        <div className="fixed inset-0 z-[9999] text-left pointer-events-none">
            {/* Transparent Backdrop */}
            <div className={`absolute inset-0 transition-opacity duration-100 pointer-events-auto ${isMobile ? '' : 'bg-transparent'}`} style={{ backgroundColor: isMobile ? 'var(--color-overlay)' : 'transparent' }} onClick={handleBackdropClick} />

            <div
                data-tutorial-modal
                onClick={(e) => e.stopPropagation()}
                className={clsx(
                    "flex flex-col overflow-hidden shadow-sm ring-1 ring-inset pointer-events-auto",
                    !isMobile && "glass-tier3",
                    "ring-black/[0.02] dark:ring-white/5",
                    isMobile
                        ? "fixed bottom-14 left-0 right-0 z-[9999] w-full max-h-[75vh] border-b-0"
                        : "absolute w-[500px] rounded-2xl transition-all duration-200"
                )}
                style={isMobile ? {
                    backgroundColor: 'var(--color-sheet-bg)',
                    borderTopLeftRadius: MOBILE_TOKENS.sheet.radius,
                    borderTopRightRadius: MOBILE_TOKENS.sheet.radius,
                } : desktopStyle}
            >
                {/* Mobile Drag Handle Indicator */}
                {isMobile && (
                    <div className="flex justify-center pt-2.5 pb-1">
                        <div
                            className="bg-[var(--app-text)]/20"
                            style={{
                                width: MOBILE_TOKENS.sheet.handleWidth,
                                height: MOBILE_TOKENS.sheet.handleHeight,
                                borderRadius: MOBILE_TOKENS.sheet.handleRadius,
                            }}
                        />
                    </div>
                )}

                {isMobile ? (
                    /* Mobile iOS-style Navbar: キャンセル + タイトル + 保存 */
                    <div className="flex justify-between items-center px-4 py-2.5 border-b flex-shrink-0 border-app-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-app-blue text-app-2xl font-medium cursor-pointer"
                        >
                            {t('app.event_cancel', { defaultValue: 'キャンセル' })}
                        </button>
                        <h2 className="text-app-2xl font-bold text-app-text">
                            {initialData ? t('app.event_edit_title', { defaultValue: 'イベント編集' }) : t('app.event_add_title', { defaultValue: 'イベント追加' })}
                        </h2>
                        <button
                            type="submit"
                            form="event-modal-form"
                            className="text-app-blue text-app-2xl font-bold cursor-pointer"
                        >
                            {t('app.event_save', { defaultValue: '保存' })}
                        </button>
                    </div>
                ) : (
                    /* PC Title Row */
                    <div className={clsx(
                        "flex justify-between items-center px-6 py-4 border-b flex-shrink-0 transition-colors",
                        "border-app-border bg-app-surface2"
                    )}>
                        <h2 className={clsx(
                            "text-app-2xl font-bold transition-colors",
                            "text-app-text"
                        )}>
                            {initialData ? t('modal.edit_event') : t('modal.add_event')}
                        </h2>
                        <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90">
                            <X size={16} />
                        </button>
                    </div>
                )}

                <form id="event-modal-form" onSubmit={handleSubmit} className={clsx("overflow-y-auto custom-scrollbar", isMobile ? "p-4 space-y-4 max-h-[75vh]" : "p-6 space-y-6 max-h-[75vh]")}>
                    {/* Input Mode Toggle */}
                    <SegmentButton
                        options={[
                            { value: 'reverse', label: t('modal.mode_reverse', '逆算入力 (Reverse)'), icon: <Calculator size={14} /> },
                            { value: 'direct', label: t('modal.mode_direct', '直接入力 (Direct)') },
                        ]}
                        value={inputMode}
                        onChange={setInputMode}
                        className={isMobile ? 'mb-3' : 'mb-6'}
                    />

                    {/* Common Event Properties */}
                    <div className={clsx("grid grid-cols-2", isMobile ? "gap-3" : "gap-4")}>
                        <div>
                            <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.time')}</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={time}
                                onChange={(e) => { const v = toHalfWidthNumber(e.target.value); setTime(v === '' ? 0 : Number(v)); }}
                                onFocus={(e) => e.target.select()}
                                className={clsx(
                                    "w-full rounded-lg p-2.5 text-[16px] md:text-app-2xl transition-all font-barlow border focus:outline-none focus:ring-1",
                                    "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                                )}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.name_label')}</label>
                            <input
                                data-tutorial="event-name-input"
                                type="text"
                                lang={t('app.language') === 'English' ? 'en' : 'ja'}
                                value={contentLanguage === 'en' ? name.en : name.ja}
                                onChange={(e) => setName({ ...name, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                                className={clsx(
                                    "w-full rounded-lg p-2.5 text-[16px] md:text-app-2xl transition-all border focus:outline-none focus:ring-1",
                                    "bg-app-surface2 border-app-border text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                                )}
                                required
                                placeholder={t('mechanic_modal.placeholder')}
                            />
                        </div>
                    </div>

                    {/* Type & Target Row */}
                    <div className={clsx("grid grid-cols-2", isMobile ? "gap-3" : "gap-4")}>
                        {/* Damage Type */}
                        <div className="flex flex-col">
                            <label className={clsx("block text-app-lg font-medium text-app-text", isMobile ? "mb-1.5" : "mb-2")}>{t('modal.damage_type')}</label>
                            <SegmentButton
                                options={[
                                    { value: 'magical', label: t('modal.magical'), icon: '/icons/type_magic.png' },
                                    { value: 'physical', label: t('modal.physical'), icon: '/icons/type_phys.png' },
                                    { value: 'unavoidable', label: t('modal.unavoidable'), icon: '/icons/type_dark.png' },
                                ]}
                                value={damageType}
                                onChange={(v) => setDamageType(v as any)}
                                size={isMobile ? 'sm' : 'md'}
                                layout="vertical"
                                className="flex-1"
                            />
                        </div>

                        {/* Target Selection */}
                        <div className="flex flex-col">
                            <label className={clsx("block text-app-lg font-medium text-app-text", isMobile ? "mb-1.5" : "mb-2")}>{t('modal.target')}</label>
                            <SegmentButton
                                options={[
                                    { value: 'AoE', label: t('modal.aoe') },
                                    { value: 'MT', label: t('modal.mt') },
                                    { value: 'ST', label: t('modal.st') },
                                ]}
                                value={target ?? 'AoE'}
                                onChange={(v) => setTarget(v as any)}
                                size={isMobile ? 'sm' : 'md'}
                                className="flex-1"
                            />
                        </div>
                    </div>

                    <div className={clsx(
                        "w-full h-px transition-colors",
                        isMobile ? "my-3" : "my-6",
                        "bg-app-surface2"
                    )} />

                    {/* Dynamic Inputs Area */}
                    <div className={isMobile ? "space-y-4" : "space-y-6"}>
                        {inputMode === 'direct' ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.damage_amount')}</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={damageAmount}
                                    onChange={(e) => { const v = toHalfWidthNumber(e.target.value); setDamageAmount(v === '' ? 0 : Number(v)); }}
                                    onFocus={(e) => e.target.select()}
                                    className={clsx(
                                        "w-full rounded-lg p-2.5 text-[16px] md:text-app-3xl font-mono transition-all font-bold border focus:outline-none focus:ring-1",
                                        "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                                    )}
                                />
                            </div>
                        ) : (
                            <div className={clsx("animate-in fade-in slide-in-from-bottom-2 duration-300", isMobile ? "space-y-4" : "space-y-6")}>
                                <div className={clsx(
                                    "rounded-xl border shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] transition-colors",
                                    isMobile ? "p-3" : "p-5",
                                    "bg-app-surface2 border-app-border"
                                )}>
                                    <div className={clsx("flex flex-col", isMobile ? "gap-3" : "gap-4")}>
                                        <div>
                                            <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.actual_damage')}</label>
                                            <div className="flex gap-2">
                                                <input
                                                    data-tutorial="event-actual-damage-input"
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={calcActualDamage}
                                                    onChange={(e) => { const v = toHalfWidthNumber(e.target.value); setCalcActualDamage(v === '' ? 0 : Number(v)); }}
                                                    onFocus={(e) => e.target.select()}
                                                    className={clsx(
                                                        "flex-1 border rounded-lg px-4 py-2.5 text-[16px] md:text-app-3xl font-mono outline-none transition-all",
                                                        "bg-app-surface border-app-border text-app-text focus:border-app-text"
                                                    )}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                            "bg-app-text/5 border-app-border"
                                        )}>
                                            <span className="text-app-lg font-bold text-app-text uppercase tracking-widest">{t('mechanic_modal.estimated_raw')}</span>
                                            <span className="text-app-4xl font-mono font-bold text-app-text tracking-tight">{damageAmount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <label className="block text-app-lg font-medium text-app-text shrink-0">{t('mechanic_modal.calc_mitigations')}</label>
                                        {selectedMitigations.length > 0 && (
                                          <div className="flex flex-wrap items-center justify-end gap-x-0.5 gap-y-1 min-w-0">
                                            {selectedMitigations.map(mitId => {
                                              const baseId = stripVariantSuffix(mitId);
                                              const mit = MITIGATIONS.find(m => m.id === baseId);
                                              if (!mit) return null;
                                              const lang = t('app.language') === 'English' ? 'en' : 'ja';
                                              return (
                                                <img
                                                  key={mitId}
                                                  src={mit.icon}
                                                  alt={mit.name[lang] || mit.name.ja}
                                                  className="w-5 h-5 rounded object-contain"
                                                />
                                              );
                                            })}
                                          </div>
                                        )}
                                    </div>
                                    <div
                                        id="mitigation-grid-container"
                                        className={clsx(
                                            "grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[160px] overflow-y-auto p-2 rounded-xl border custom-scrollbar shadow-inner transition-colors relative",
                                            "bg-app-surface2 border-app-border"
                                        )}
                                    >
                                        {sortedMitigations.flatMap((mit: typeof MITIGATIONS[0]) => {
                                            const hasBurst = !!(mit.burstValue && mit.burstDuration);
                                            const isDeployTactics = mit.id === 'deployment_tactics';

                                            const variants: Array<{ id: string; burst: boolean; deployVariant?: 'plain' | 'crit' | 'crit_protraction' }> =
                                                isDeployTactics
                                                    ? [
                                                        { id: 'deployment_tactics', burst: false, deployVariant: 'plain' },
                                                        { id: 'deployment_tactics:crit', burst: false, deployVariant: 'crit' },
                                                        { id: 'deployment_tactics:crit_protraction', burst: false, deployVariant: 'crit_protraction' },
                                                    ]
                                                    : hasBurst
                                                        ? [{ id: mit.id, burst: false }, { id: `${mit.id}:burst`, burst: true }]
                                                        : [{ id: mit.id, burst: false }];

                                            return variants.map(variant => {
                                                const isTutorialTarget = isTutorialActive && !variant.burst && (
                                                    (currentStep?.id === 'add-3-miti' && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en) && !selectedMitigations.includes(mit.id)) ||
                                                    (currentStep?.id === 'create-8-miti' && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id))
                                                );
                                                const shouldHighlight = isTutorialTarget && (tutorialState.isActive || visibleMitigations.has(mit.id));

                                                return (
                                                    <div key={variant.id} className="flex flex-col items-center gap-0.5">
                                                        <button
                                                            data-mitigation-id={variant.id}
                                                            data-tutorial={
                                                                !variant.burst && isTutorialActive && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id)
                                                                    ? 'tutorial-skill-reprisal'
                                                                    : shouldHighlight ? 'tutorial-skill-target' : undefined
                                                            }
                                                            type="button"
                                                            onClick={() => toggleMitigation(variant.id)}
                                                            className={clsx(
                                                                "relative group p-1.5 rounded-lg border transition-all flex items-center justify-center transform active:scale-95 cursor-pointer w-full",
                                                                selectedMitigations.includes(variant.id)
                                                                    ? "bg-app-text/15 border-app-text ring-1 ring-app-text/30"
                                                                    : "bg-app-surface border-app-border hover:bg-app-surface2 hover:border-app-border opacity-80 hover:opacity-100"
                                                            )}
                                                        >
                                                            <Tooltip content={
                                                                variant.deployVariant === 'plain' ? '展開戦術（素打ち）' :
                                                                variant.deployVariant === 'crit' ? '展開戦術 ＋ 秘策' :
                                                                variant.deployVariant === 'crit_protraction' ? '展開戦術 ＋ 秘策 ＋ 生命回生法' :
                                                                getTooltipText(mit) + (variant.burst ? ` (${mit.burstDuration}s)` : '')
                                                            }>
                                                                <div className="relative">
                                                                    {variant.deployVariant === 'plain' || variant.deployVariant === undefined ? (
                                                                        <>
                                                                            <img src={mit.icon} alt={getPhaseName(mit.name, contentLanguage)} className="w-7 h-7 object-contain drop-shadow" />
                                                                            {variant.burst && (
                                                                                <img
                                                                                    src={mit.icon}
                                                                                    alt=""
                                                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                                />
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        // 鼓舞展開バリアント: 対角線分割融合 (秘策=左上三角 / 展開戦術=右下三角)
                                                                        <div className="relative w-7 h-7">
                                                                            <img
                                                                                src={recitationIcon}
                                                                                alt=""
                                                                                className="absolute inset-0 w-7 h-7 object-contain drop-shadow"
                                                                                style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                                                                            />
                                                                            <img
                                                                                src={deploymentIcon}
                                                                                alt={getPhaseName(mit.name, contentLanguage)}
                                                                                className="absolute inset-0 w-7 h-7 object-contain drop-shadow"
                                                                                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                                                                            />
                                                                            {variant.deployVariant === 'crit_protraction' && (
                                                                                <img
                                                                                    src={protractionIcon}
                                                                                    alt=""
                                                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </Tooltip>
                                                        </button>
                                                        {/* MT/ST トグル: 単体バフ選択時のみ表示 */}
                                                        {mit.scope === 'target' && selectedMitigations.includes(variant.id) && (
                                                            <div className="flex gap-px text-[9px] font-bold rounded overflow-hidden border border-app-border" onClick={(e) => e.stopPropagation()}>
                                                                {(['MT', 'ST'] as const).map(tgt => {
                                                                    const isActive = (mitigationTargets[variant.id] ?? 'MT') === tgt;
                                                                    return (
                                                                        <button
                                                                            key={tgt}
                                                                            type="button"
                                                                            onClick={() => setMitigationTarget(variant.id, tgt)}
                                                                            className={clsx(
                                                                                "px-1.5 py-0.5 transition-colors cursor-pointer",
                                                                                isActive ? "bg-app-text text-app-bg" : "bg-app-surface text-app-text-muted hover:bg-app-surface2"
                                                                            )}
                                                                        >
                                                                            {tgt}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })}
                                    </div>
                                    {/* Tutorial scroll hint for Step 9D */}
                                    {currentStep?.id === 'add-3-miti' && selectedMitigations.length < 3 && (
                                        <div className="flex flex-col items-center gap-1 py-2 text-cyan-400 animate-bounce">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 5v14M5 12l7 7 7-7" />
                                            </svg>
                                            <span className="text-app-base font-bold uppercase tracking-wider opacity-80">
                                                {t('mechanic_modal.scroll_hint')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className={clsx(
                        "flex justify-between items-center border-t transition-colors",
                        isMobile ? "flex-col gap-3 pt-3 mt-3" : "flex-col sm:flex-row gap-4 pt-4 mt-6",
                        "border-app-border"
                    )}>
                        {onDelete && initialData ? (
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm(t('timeline.delete_event_confirm'))) {
                                        onDelete();
                                        onClose();
                                    }
                                }}
                                className={clsx(
                                    "px-4 py-2 text-app-red hover:text-app-red-hover hover:bg-app-red-dim rounded-lg flex items-center justify-center gap-1.5 transition-colors text-app-lg font-bold cursor-pointer",
                                    isMobile ? "w-full" : "w-full sm:w-auto"
                                )}
                            >
                                <Trash2 size={16} />
                                <span>{t('modal.delete')}</span>
                            </button>
                        ) : <div className="hidden sm:block"></div>}

                        <button
                            data-tutorial="event-save-btn"
                            type="submit"
                            className={clsx(
                                "flex items-center justify-center gap-2 bg-app-blue text-white hover:bg-app-blue-hover font-bold transition-all hover:scale-[1.02] active:scale-95 uppercase tracking-wider cursor-pointer",
                                isMobile
                                    ? "w-full py-3.5 rounded-xl text-app-2xl"
                                    : "w-full sm:w-auto flex-1 sm:flex-none px-8 py-2.5 rounded-lg text-app-2xl"
                            )}
                        >
                            <Save size={isMobile ? 18 : 16} />
                            {t('mechanic_modal.add_button')}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
