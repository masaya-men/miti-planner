
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, Calculator, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { getPhaseName } from '../types';
import { useMitigationStore, DEFAULT_TANK_STATS, DEFAULT_HEALER_STATS } from '../store/useMitigationStore';
import { useMitigations, useJobs } from '../hooks/useSkillsData';
import { calculateMemberValues, CRIT_MULTIPLIER } from '../utils/calculator';
import { useThemeStore } from '../store/useThemeStore';
import { clsx } from 'clsx';
import { useTutorialStore } from '../store/useTutorialStore';
import { Tooltip } from './ui/Tooltip';
import { SegmentButton } from './ui/SegmentButton';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
import { computeInitialDamageState } from '../lib/eventFormDamageState';
import { isMitigationBlockedByEvent } from '../utils/damageTypeLogic';
import { NumericInput } from './ui/NumericInput';
import { TimeInput } from './ui/TimeInput';

// 軽減 ID から burst / crit / crit_protraction の接尾辞を剥がして base ID を返す
const stripVariantSuffix = (id: string): string => {
    return id.replace(/:(burst|crit|crit_protraction)$/, '');
};

export interface EventFormLabels {
    /** 保存ボタンの文言(i18n キー)。未指定なら 'mechanic_modal.add_button' */
    saveButtonKey?: string;
}

interface EventFormProps {
    onSave: (event: Omit<TimelineEvent, 'id'>) => void;
    onDelete?: () => void;
    /** 指定時のみキャンセルボタンを表示(PiP 用) */
    onCancel?: () => void;
    initialData?: TimelineEvent | null;
    initialTime?: number;
    variant?: 'modal' | 'pip';   // default 'modal'
    reverseOnly?: boolean;       // true: hide reverse/direct toggle, force inputMode='reverse'
    labels?: EventFormLabels;
}

/**
 * EventModal / VideoRecorderModal 共通のイベント入力フォーム本体。
 * `<form id="event-modal-form">` を直接返す (Portal / backdrop は持たない)。
 * チュートリアルは DOM id / data-tutorial-* / data-mitigation-id を参照するため、それらは厳守する。
 */
export const EventForm: React.FC<EventFormProps> = ({ onSave, onDelete, onCancel, initialData, initialTime, variant = 'modal', reverseOnly = false, labels }) => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const [name, setName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
    const [altName, setAltName] = useState<import('../types').LocalizedString>({ ja: '', en: '' });
    const [time, setTime] = useState(0);
    const [damageType, setDamageType] = useState<TimelineEvent['damageType']>('magical');
    const [damageAmount, setDamageAmount] = useState<number>(() => computeInitialDamageState(initialData, reverseOnly).damageAmount);
    const [target, setTarget] = useState<TimelineEvent['target']>('AoE');
    const [ignoresDebuffMitigation, setIgnoresDebuffMitigation] = useState(false);

    // Calculator State
    const [inputMode, setInputMode] = useState<'direct' | 'reverse'>(() => computeInitialDamageState(initialData, reverseOnly).inputMode);
    const [calcActualDamage, setCalcActualDamage] = useState<number>(0);
    const [selectedMitigations, setSelectedMitigations] = useState<string[]>([]);
    const [mitigationTargets, setMitigationTargets] = useState<Record<string, 'MT' | 'ST'>>({});

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

    // pip variant / mobile はコンパクト表示にする
    const compact = variant === 'pip' || isMobile;

    // IntersectionObserver for tracking visible mitigations
    useEffect(() => {
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
    }, []);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setAltName(initialData.altName ?? { ja: '', en: '' });
            setTime(initialData.time);
            setDamageType(initialData.damageType);
            setIgnoresDebuffMitigation(!!initialData.ignoresDebuffMitigation);
            setTarget(initialData.target || 'AoE');

            // すでにダメージが入っている場合は、電卓 (逆算) が上書きしないように「直接入力 (Direct)」モードで開く。
            // 初期 useState の lazy initializer と同じ純関数を使い、初期化と再初期化で挙動を一致させる。
            const initDamage = computeInitialDamageState(initialData, reverseOnly);
            setDamageAmount(initDamage.damageAmount);
            setInputMode(initDamage.inputMode);
            setCalcActualDamage(0);
            setSelectedMitigations([]);
            setMitigationTargets({});
        } else {
            setName({ ja: '', en: '' });
            setAltName({ ja: '', en: '' });
            setTime(initialTime || 0);
            setDamageType('magical');
            setIgnoresDebuffMitigation(false);
            setDamageAmount(0);
            setTarget('AoE');
            // Reset calculator state
            setInputMode('reverse');
            setCalcActualDamage(0);
            setSelectedMitigations([]);
            setMitigationTargets({});
        }
        mitiPresetDoneRef.current = false;
    }, [initialData, initialTime, reverseOnly]);

    const { partyMembers, currentLevel } = useMitigationStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();

    const tutorialState = useTutorialStore();
    const isTutorialActive = tutorialState.isActive;
    const currentStep = isTutorialActive ? tutorialState.getCurrentStep() : null;
    const mitiPresetDoneRef = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);
    useSmoothWheelScroll(formRef, { enabled: true });
    const mitigationGridRef = useRef<HTMLDivElement>(null);
    useSmoothWheelScroll(mitigationGridRef, { stiffness: 25, wheelMultiplier: 0.4, stopPropagation: true, enabled: true });

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

    // 並び順ソートキー
    // グループ 0: 全体軽減 (scope: 'party' or undefined) → T/H/D → ジョブ順 → リキャスト短→長
    // グループ 1: タンクLB (id 'tank_lb' 始まり) → LB1→LB2→LB3 → ジョブ順
    // グループ 2: 個別軽減 (scope: 'self' or 'target') → T/H/D → ジョブ順 → self→target → リキャスト短→長
    const EXCLUDED_IDS = [
        'aurora', 'thrill_of_battle', 'holmgang', 'living_dead', 'superbolide', 'hallowed_ground',
        'helios_conjunction', 'summon_seraph', 'seraphism', 'philosophia', 'macrocosmos',
        'aspected_helios', 'riddle_of_earth'
    ];

    const getSortKey = (mit: typeof MITIGATIONS[0]) => {
        // requires がある場合、 親の recast を借りて「親の直後」 に並ぶよう調整する。
        // ただし scope/jobId/group は mit 自身を維持する (例: 占星カードは scope='target' を
        // 保持しつつ、 親 Astral Draw の recast 55 に隣接配置)。
        let parentRecast: number | null = null;
        if (mit.requires && !EXCLUDED_IDS.includes(mit.requires)) {
            const parent = MITIGATIONS.find(m => m.id === mit.requires);
            if (parent) {
                parentRecast = parent.recast ?? null;
            }
        }

        const job = JOBS.find(j => j.id === mit.jobId);
        const role = job?.role || 'dps';
        const roleOrder = role === 'tank' ? 0 : role === 'healer' ? 1 : 2;
        const jobOrder = JOBS.findIndex(j => j.id === mit.jobId);
        const safeJobOrder = jobOrder === -1 ? 999 : jobOrder;

        // グループ判定
        let groupOrder: number;
        if (mit.id.startsWith('tank_lb')) {
            groupOrder = 1;
        } else if (mit.scope === 'self' || mit.scope === 'target') {
            groupOrder = 2;
        } else {
            // scope === 'party' または scope === undefined
            groupOrder = 0;
        }

        // LB レベル (1/2/3)
        let lbLevel = 0;
        if (groupOrder === 1) {
            const m = mit.id.match(/tank_lb(\d)/);
            lbLevel = m ? parseInt(m[1], 10) : 0;
        }

        // scope 内順序: グループ 2 でのみ意味あり（self=0, target=1）
        const scopeInnerOrder = mit.scope === 'self' ? 0 : mit.scope === 'target' ? 1 : 0;

        const recast = parentRecast !== null
            ? parentRecast + 0.5
            : (mit.recast ?? 999);

        return { groupOrder, roleOrder, safeJobOrder, scopeInnerOrder, lbLevel, recast };
    };

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
            const ka = getSortKey(a);
            const kb = getSortKey(b);

            // グループ
            if (ka.groupOrder !== kb.groupOrder) return ka.groupOrder - kb.groupOrder;

            // グループ 1 (LB): lbLevel → jobOrder
            if (ka.groupOrder === 1) {
                if (ka.lbLevel !== kb.lbLevel) return ka.lbLevel - kb.lbLevel;
                if (ka.safeJobOrder !== kb.safeJobOrder) return ka.safeJobOrder - kb.safeJobOrder;
                return (a.name.ja || "").localeCompare(b.name.ja || "");
            }

            // グループ 0 / 2: ロール → ジョブ順 → scope内順 → リキャスト順
            if (ka.roleOrder !== kb.roleOrder) return ka.roleOrder - kb.roleOrder;
            if (ka.safeJobOrder !== kb.safeJobOrder) return ka.safeJobOrder - kb.safeJobOrder;
            if (ka.scopeInnerOrder !== kb.scopeInnerOrder) return ka.scopeInnerOrder - kb.scopeInnerOrder;
            if (ka.recast !== kb.recast) return ka.recast - kb.recast;
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
            // 注: キー名は calculator.ts の SKILL_DATA で「(Nセクト)」付きで登録されている
            if (baseId === 'neutral_sect') {
                const heliosName = currentLevel >= 96
                    ? 'コンジャンクション・ヘリオス (Nセクト)'
                    : 'アスペクト・ヘリオス (Nセクト)';
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
                return;
            }

            // Scope filtering: AoE attacks only use party-wide mitigations
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;

            // 新規: target=MT/ST のとき、scope='target' のバフは投げ先と一致するときだけ採用
            if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
                const assignedTarget = mitigationTargets[mitId] ?? 'MT';
                if (assignedTarget !== target) return;
            }

            // デバフ軽減不可フラグONなら、デバフ系軽減の % は逆算に含めない。
            // 本関数は%とバリアを単一ループで処理するため return はバリア寄与もスキップするが、
            // デバフ4系は全て isShield:false のため本体計算(Timeline.tsx の%ループのみ)と結果一致。
            // 将来デバフ系のシールドを追加する場合はここを%スキップのみに分離すること。
            if (isMitigationBlockedByEvent({ ignoresDebuffMitigation }, def)) return;

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
    }, [calcActualDamage, selectedMitigations, mitigationTargets, damageType, inputMode, target, ignoresDebuffMitigation]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const hasAltName = !!(altName.ja?.trim() || altName.en?.trim() || altName.zh?.trim() || altName.ko?.trim());
        onSave({
            name,
            time,
            damageType,
            damageAmount,
            target,
            ignoresDebuffMitigation,
            ...(hasAltName ? { altName } : {}),
        });
        useTutorialStore.getState().completeEvent('create:event-saved');
    };

    return (
        <form ref={formRef} id="event-modal-form" onSubmit={handleSubmit} className={clsx("overflow-y-auto custom-scrollbar", compact ? "p-4 space-y-4" : "p-6 space-y-6", variant === 'pip' ? "h-full" : "max-h-[75vh]")}>
            {/* Input Mode Toggle */}
            {!reverseOnly && (
                <SegmentButton
                    options={[
                        { value: 'reverse', label: t('modal.mode_reverse', '逆算入力 (Reverse)'), icon: <Calculator size={14} /> },
                        { value: 'direct', label: t('modal.mode_direct', '直接入力 (Direct)') },
                    ]}
                    value={inputMode}
                    onChange={setInputMode}
                    className={compact ? 'mb-3' : 'mb-6'}
                />
            )}

            {/* 時間（M:SS でも 裸の秒数でも入力可。幅控えめ・全幅にすると間延びするため上限を設ける） */}
            <div className="max-w-[200px]">
                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.time')}</label>
                <TimeInput
                    value={time}
                    onChange={(sec) => setTime(sec ?? 0)}
                    data-testid="event-time-input"
                    placeholder={t('modal.time_placeholder')}
                    className={clsx(
                        "w-full rounded-lg p-2.5 text-[16px] md:text-app-2xl transition-all font-barlow border focus:outline-none focus:ring-1",
                        "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                    )}
                />
                <p className="mt-1 text-app-sm text-app-text-muted">{t('modal.time_format_hint')}</p>
            </div>

            {/* 攻撃名 ＋ 2択攻撃の別名（任意）— 別名を攻撃名の直下に密着させ、続きの欄だと分かるようにする */}
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
                {/* 淡色サブラベル＋密着配置（mt-2）で「攻撃名の続き＝もう一方の名前」と伝える */}
                <label className="block text-app-sm text-app-text-muted mt-2 mb-1">{t('event.alt_name_label')}</label>
                <input
                    data-testid="event-altname-input"
                    type="text"
                    lang={t('app.language') === 'English' ? 'en' : 'ja'}
                    value={contentLanguage === 'en' ? altName.en : altName.ja}
                    onChange={(e) => setAltName({ ...altName, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                    className={clsx(
                        "w-full rounded-lg p-2.5 text-[16px] md:text-app-2xl transition-all border focus:outline-none focus:ring-1",
                        "bg-app-surface2 border-app-border text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                    )}
                    placeholder={t('event.alt_name_placeholder')}
                />
            </div>

            {/* Type & Target Row */}
            <div className={clsx("grid grid-cols-2", compact ? "gap-3" : "gap-4")}>
                {/* Damage Type */}
                <div className="flex flex-col">
                    <label className={clsx("block text-app-lg font-medium text-app-text", compact ? "mb-1.5" : "mb-2")}>{t('modal.damage_type')}</label>
                    <SegmentButton
                        options={[
                            { value: 'magical', label: t('modal.magical'), icon: '/icons/type_magic.png' },
                            { value: 'physical', label: t('modal.physical'), icon: '/icons/type_phys.png' },
                            { value: 'unavoidable', label: t('modal.unavoidable'), icon: '/icons/type_dark.png' },
                        ]}
                        value={damageType}
                        onChange={(v) => setDamageType(v as any)}
                        size={compact ? 'sm' : 'md'}
                        layout="vertical"
                        className="flex-1"
                    />
                </div>

                {/* Target Selection */}
                <div className="flex flex-col">
                    <label className={clsx("block text-app-lg font-medium text-app-text", compact ? "mb-1.5" : "mb-2")}>{t('modal.target')}</label>
                    <SegmentButton
                        options={[
                            { value: 'AoE', label: t('modal.aoe') },
                            { value: 'MT', label: t('modal.mt') },
                            { value: 'ST', label: t('modal.st') },
                        ]}
                        value={target ?? 'AoE'}
                        onChange={(v) => setTarget(v as any)}
                        size={compact ? 'sm' : 'md'}
                        className="flex-1"
                    />
                </div>
            </div>

            {/* デバフ軽減不可(外周攻撃など) */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    data-testid="ignores-debuff-mit"
                    checked={ignoresDebuffMitigation}
                    onChange={(e) => setIgnoresDebuffMitigation(e.target.checked)}
                    className="w-4 h-4 accent-red-500 cursor-pointer"
                />
                <span className="text-app-base text-app-text">{t('modal.ignores_debuff_mitigation')}</span>
                <span className="text-app-sm text-app-text-muted">{t('modal.ignores_debuff_mitigation_desc')}</span>
            </label>

            <div className={clsx(
                "w-full h-px transition-colors",
                compact ? "my-3" : "my-6",
                "bg-app-surface2"
            )} />

            {/* Dynamic Inputs Area */}
            <div className={compact ? "space-y-4" : "space-y-6"}>
                {inputMode === 'direct' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.damage_amount')}</label>
                        <NumericInput
                            value={damageAmount}
                            onChange={setDamageAmount}
                            thousandSeparator
                            className={clsx(
                                "w-full rounded-lg p-2.5 text-[16px] md:text-app-3xl font-mono transition-all font-bold border focus:outline-none focus:ring-1",
                                "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                            )}
                        />
                    </div>
                ) : (
                    <div className={clsx("animate-in fade-in slide-in-from-bottom-2 duration-300", compact ? "space-y-4" : "space-y-6")}>
                        <div className={clsx(
                            "rounded-xl border shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] transition-colors",
                            compact ? "p-3" : "p-5",
                            "bg-app-surface2 border-app-border"
                        )}>
                            <div className={clsx("flex flex-col", compact ? "gap-3" : "gap-4")}>
                                <div>
                                    <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.actual_damage')}</label>
                                    <div className="flex gap-2">
                                        <NumericInput
                                            data-tutorial="event-actual-damage-input"
                                            value={calcActualDamage}
                                            onChange={setCalcActualDamage}
                                            thousandSeparator
                                            className={clsx(
                                                "flex-1 border rounded-lg px-4 py-2.5 text-[16px] md:text-app-3xl font-mono outline-none transition-all",
                                                "bg-app-surface border-app-border text-app-text focus:border-app-text"
                                            )}
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
                                ref={mitigationGridRef}
                                id="mitigation-grid-container"
                                className={clsx(
                                    "grid gap-2 overflow-y-auto p-2 rounded-xl border custom-scrollbar shadow-inner transition-colors relative",
                                    // pip (動画モーダル) は右パネルが狭いため 6 列固定 + 高さ広めでアイコンを窮屈にしない
                                    variant === 'pip' ? "grid-cols-6 max-h-[300px]" : "grid-cols-6 sm:grid-cols-8 max-h-[160px]",
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

                                    return variants.map(mitVariant => {
                                        const isTutorialTarget = isTutorialActive && !mitVariant.burst && (
                                            (currentStep?.id === 'add-3-miti' && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en) && !selectedMitigations.includes(mit.id)) ||
                                            (currentStep?.id === 'create-8-miti' && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id))
                                        );
                                        const shouldHighlight = isTutorialTarget && (tutorialState.isActive || visibleMitigations.has(mit.id));

                                        return (
                                            <div key={mitVariant.id} className="flex flex-col items-center gap-0.5">
                                                <button
                                                    data-mitigation-id={mitVariant.id}
                                                    data-tutorial={
                                                        !mitVariant.burst && isTutorialActive && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id)
                                                            ? 'tutorial-skill-reprisal'
                                                            : shouldHighlight ? 'tutorial-skill-target' : undefined
                                                    }
                                                    type="button"
                                                    onClick={() => toggleMitigation(mitVariant.id)}
                                                    className={clsx(
                                                        "relative group p-1.5 rounded-lg border transition-all flex items-center justify-center transform active:scale-95 cursor-pointer w-full",
                                                        selectedMitigations.includes(mitVariant.id)
                                                            ? "bg-app-text/15 border-app-text ring-1 ring-app-text/30"
                                                            : "bg-app-surface border-app-border hover:bg-app-surface2 hover:border-app-border opacity-80 hover:opacity-100"
                                                    )}
                                                >
                                                    <Tooltip content={
                                                        mitVariant.deployVariant === 'plain' ? t('mechanic_modal.deployment_variants.plain') :
                                                        mitVariant.deployVariant === 'crit' ? t('mechanic_modal.deployment_variants.crit') :
                                                        mitVariant.deployVariant === 'crit_protraction' ? t('mechanic_modal.deployment_variants.crit_protraction') :
                                                        getTooltipText(mit) + (mitVariant.burst ? ` (${mit.burstDuration}s)` : '')
                                                    }>
                                                        <div className="relative">
                                                            {mitVariant.deployVariant === 'plain' || mitVariant.deployVariant === undefined ? (
                                                                <>
                                                                    <img src={mit.icon} alt={getPhaseName(mit.name, contentLanguage)} className="w-7 h-7 object-contain drop-shadow" />
                                                                    {mitVariant.burst && (
                                                                        <img
                                                                            src={mit.icon}
                                                                            alt=""
                                                                            className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                        />
                                                                    )}
                                                                </>
                                                            ) : (
                                                                // 鼓舞展開バリアント: 展開戦術ベース + 右上に秘策バッジ (+ crit_protraction なら右下に生命回生バッジ)
                                                                <div className="relative w-7 h-7">
                                                                    <img
                                                                        src={deploymentIcon}
                                                                        alt={getPhaseName(mit.name, contentLanguage)}
                                                                        className="w-7 h-7 object-contain drop-shadow"
                                                                    />
                                                                    {/* 右上: 秘策（crit と crit_protraction の両方） */}
                                                                    <img
                                                                        src={recitationIcon}
                                                                        alt=""
                                                                        className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                    />
                                                                    {/* 右下: 生命回生法（crit_protraction のみ） */}
                                                                    {mitVariant.deployVariant === 'crit_protraction' && (
                                                                        <img
                                                                            src={protractionIcon}
                                                                            alt=""
                                                                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                        />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Tooltip>
                                                </button>
                                                {/* MT/ST トグル: 単体バフ選択時のみ表示 */}
                                                {mit.scope === 'target' && selectedMitigations.includes(mitVariant.id) && (
                                                    <div className="flex gap-px text-[9px] font-bold rounded overflow-hidden border border-app-border" onClick={(e) => e.stopPropagation()}>
                                                        {(['MT', 'ST'] as const).map(tgt => {
                                                            const isActive = (mitigationTargets[mitVariant.id] ?? 'MT') === tgt;
                                                            return (
                                                                <button
                                                                    key={tgt}
                                                                    type="button"
                                                                    onClick={() => setMitigationTarget(mitVariant.id, tgt)}
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
                    {t(labels?.saveButtonKey ?? 'mechanic_modal.add_button')}
                </button>
            </div>
        </form>
    );
};

export default EventForm;
