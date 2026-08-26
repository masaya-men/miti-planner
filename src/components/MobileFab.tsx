import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    MoreHorizontal, X, List, Tag, Search,
    Globe, Sun, Moon,
    Rows3, AlignJustify, ChevronDown,
    Sparkles, Users,
} from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '../store/useThemeStore';
import type { ContentLanguage, MobileEffectBarMode } from '../store/useThemeStore';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import { SPRING, STAGGER } from '../tokens/motionTokens';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { PARTY_MEMBER_IDS } from '../constants/party';

interface MobileFABProps {
    onToggleTheme: () => void;
    theme: string;
    onPhaseJump?: () => void;
    onLabelJump?: () => void;
    onMechanicSearch?: () => void;
    onToggleExpand?: () => void;
    hideEmptyRows?: boolean;
}

const LANG_LABELS: Record<ContentLanguage, string> = {
    ja: '日',
    en: 'EN',
    zh: '中',
    'zh-Hant': '繁',
    ko: '한',
};

// チップ(言語/エフェクトモード共通)のレイアウト定数 — 対応するボタンのラベルの左に一直線
const FAN_CHIP_SIZE = 36;
const FAN_CHIP_GAP = 6;
// 表示順序（左から: 日 EN 中 繁 한→ 右端が現在地に近い）
const LANG_DISPLAY_ORDER: ContentLanguage[] = ['ja', 'en', 'zh', 'zh-Hant', 'ko'];
// 2026-08-14: 'scroll'(連動)は一時除外していたが、初動の重さの主因の一つ
// (.mobile-row-dim-textの属性セレクタ切替)を修正した実測で大幅改善したため復活。
const EFFECT_MODE_ORDER: MobileEffectBarMode[] = ['icon', 'scroll', 'bar'];
const EFFECT_MODE_CHIP_LABELS: Record<MobileEffectBarMode, string> = {
    icon: '静止',
    scroll: '連動',
    bar: '常時',
};

// i番目のチップのx位置（対応ボタン中心基準、左方向=負）。
// ボタン(44px) + gap(10px) + ラベル実測幅 + gap(12px) + チップ列。
// ラベル幅を固定50px決め打ちにしていた版は「スクロール演出」等の長いラベルでチップが
// ラベル本体に重なるバグだったため、実測値(labelWidth)を必須で受け取るようにした
// (2026-08-14実機FB)。
function fanChipX(i: number, count: number, labelWidth: number): number {
    const labelOffset = -(MOBILE_TOKENS.fab.itemSize / 2 + 10 + labelWidth + 12);
    return labelOffset - (count - 1 - i) * (FAN_CHIP_SIZE + FAN_CHIP_GAP) - FAN_CHIP_SIZE / 2;
}

// チップ(言語/エフェクトモード共通)のアニメーション variants
const fanChipVariants = {
    hidden: {
        x: 0,
        scale: 0,
        opacity: 0,
    },
    visible: (custom: { i: number; targetX: number }) => ({
        x: custom.targetX,
        scale: 1,
        opacity: 1,
        transition: {
            ...SPRING.bouncy,
            delay: custom.i * 0.05,
        },
    }),
    exit: (custom: { i: number; count: number; isSelected: boolean }) => {
        if (custom.isSelected) {
            return {
                x: 0,
                scale: 0,
                opacity: 0,
                transition: {
                    duration: 0.2,
                    ease: 'easeIn' as const,
                },
            };
        }
        return {
            x: 0,
            scale: 0,
            opacity: 0,
            transition: {
                ...SPRING.snappy,
                delay: (custom.count - 1 - custom.i) * 0.04,
            },
        };
    },
    tap: {
        scale: 1.3,
        transition: { duration: 0.1 },
    },
};

// パーティ表示/非表示グリッド専用のチップvariants(2026-08-19、fanChipVariantsと同じ技法を
// 2段×4列グリッドに適用)。1軸のx移動ではなくx/y両方でボタン位置から個別に飛び出す。
// タップしても閉じない仕様のため exit の isSelected 分岐は不要(fanChipVariantsと違う点)。
const partyVisCellVariants = {
    hidden: { x: 0, y: 0, scale: 0, opacity: 0 },
    visible: (custom: { i: number; targetX: number; targetY: number }) => ({
        x: custom.targetX,
        y: custom.targetY,
        scale: 1,
        opacity: 1,
        transition: { ...SPRING.bouncy, delay: custom.i * (STAGGER.fab / 1000) },
    }),
    exit: (custom: { i: number; count: number }) => ({
        x: 0,
        y: 0,
        scale: 0,
        opacity: 0,
        transition: {
            ...SPRING.snappy,
            delay: (custom.count - 1 - custom.i) * 0.04,
        },
    }),
};

// セッション 22: スマホは同期ボタン完全撤去。 FAB メニュー奥で結局見えないし、
// 自動同期が信頼できる状態なので意味も乏しい。 PC ヘッダのインジケータ (SyncButton)
// にエラー時のみ気づける形に集約。

export const MobileFAB: React.FC<MobileFABProps> = ({
    onToggleTheme,
    theme,
    onPhaseJump,
    onLabelJump,
    onMechanicSearch,
    onToggleExpand,
    hideEmptyRows,
}) => {
    const { t, i18n } = useTranslation();
    const { setContentLanguage, mobileEffectBarMode, setMobileEffectBarMode } = useThemeStore();
    const { runTransition } = useTransitionOverlay();

    // パーティ表示/非表示スイッチ(2026-08-19): 見た目だけの絞り込み。共同編集とは無関係。
    // モバイルは並び替え設定を使わず常に固定順(PARTY_MEMBER_IDS)で表示する既存方針に合わせる。
    const partyMembersForVisibility = useMitigationStore(state => state.partyMembers);
    const hiddenPartyMemberIds = useMitigationStore(state => state.hiddenPartyMemberIds);
    const toggleHiddenPartyMember = useMitigationStore(state => state.toggleHiddenPartyMember);
    const JOBS_FOR_VISIBILITY = useJobs();
    const partyVisibilityCells = React.useMemo(() => {
        return PARTY_MEMBER_IDS.map((id) => {
            const member = partyMembersForVisibility.find(m => m.id === id);
            const job = member?.jobId ? JOBS_FOR_VISIBILITY.find(j => j.id === member.jobId) : null;
            return { id, icon: job?.icon ?? null, hidden: hiddenPartyMemberIds.includes(id) };
        });
    }, [partyMembersForVisibility, hiddenPartyMemberIds, JOBS_FOR_VISIBILITY]);
    const [open, setOpen] = React.useState(false);
    // タイムラインを指でスクロール中はFAB本体を隠す(親指の邪魔になるという実機FB・2026-08-13)。
    // Timeline.tsx とは別コンポーネントなので、他のFAB系連携と同じ window CustomEvent 経由で受け取る
    // (Timeline.tsx側はReact stateを介さずDOM属性を直接操作する高頻度更新の仕組みのため、こちらも
    // Reactの再レンダーを伴わない直接イベント発火に揃える。開始/終了の低頻度イベントのみなので軽量)。
    const [isMobileScrolling, setIsMobileScrolling] = React.useState(false);
    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ scrolling: boolean }>).detail;
            setIsMobileScrolling(detail.scrolling);
        };
        window.addEventListener('mobile:timeline-scroll-state', handler);
        return () => window.removeEventListener('mobile:timeline-scroll-state', handler);
    }, []);
    const [langOpen, setLangOpen] = React.useState(false);
    const [selectedLang, setSelectedLang] = React.useState<ContentLanguage | null>(null);
    const langTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    // エフェクトモード選択チップ(言語チップと同じ「ボタン→fan-out」パターン。2026-08-14ユーザー要望=
    // 順送りタップ式ではなく言語ボタンのように選べる形にしたい)。
    const [effectModeOpen, setEffectModeOpen] = React.useState(false);
    // パーティ表示/非表示スイッチ(2026-08-19)。言語/エフェクトモードと同じ「ボタン→ぽよん」の
    // 開閉パターンだが、中身は横一列のfan-outチップではなく2段×4列のジョブアイコングリッド
    // (複数メンバーをまとめてON/OFFするため、選択して即閉じる言語チップとは違い開いたまま連続で
    // 操作できる)。
    const [partyVisOpen, setPartyVisOpen] = React.useState(false);

    // メニューのスクロール可否（端のフェード + ↓ アイコン表示用）
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [canScrollUp, setCanScrollUp] = React.useState(false);
    const [canScrollDown, setCanScrollDown] = React.useState(false);
    const updateScrollState = React.useCallback(() => {
        const el = menuRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 0);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    }, []);
    React.useEffect(() => {
        if (!open) return;
        const timer = setTimeout(updateScrollState, 50);
        return () => clearTimeout(timer);
    }, [open, updateScrollState]);
    const menuMaskImage = React.useMemo(() => {
        const top = canScrollUp ? 'transparent 0, black 40px' : 'black 0';
        const bottom = canScrollDown ? 'black calc(100% - 40px), transparent 100%' : 'black 100%';
        return `linear-gradient(to bottom, ${top}, ${bottom})`;
    }, [canScrollUp, canScrollDown]);

    // 言語ボタンの位置を取得（言語チップを Portal で body に出すため）
    // overflow-y-auto のメニュー内では横方向に展開するチップが clip されるので Portal 化が必須。
    // ラベル幅も一緒に実測する(チップの開始位置計算に使う。固定50px決め打ちだと「スクロール演出」
    // のような長いラベルにチップが重なるバグだったため。2026-08-14実機FB)。
    const langButtonRef = React.useRef<HTMLButtonElement>(null);
    const langLabelRef = React.useRef<HTMLSpanElement>(null);
    const [langButtonRect, setLangButtonRect] = React.useState<DOMRect | null>(null);
    const [langLabelWidth, setLangLabelWidth] = React.useState(50);
    React.useEffect(() => {
        if (!langOpen) {
            setLangButtonRect(null);
            return;
        }
        const update = () => {
            if (langButtonRef.current) {
                setLangButtonRect(langButtonRef.current.getBoundingClientRect());
            }
            if (langLabelRef.current) {
                setLangLabelWidth(langLabelRef.current.getBoundingClientRect().width);
            }
        };
        update();
        const onChange = () => update();
        // capture phase でメニュー内 scroll も拾う
        window.addEventListener('scroll', onChange, true);
        window.addEventListener('resize', onChange);
        return () => {
            window.removeEventListener('scroll', onChange, true);
            window.removeEventListener('resize', onChange);
        };
    }, [langOpen]);

    // パーティ表示/非表示ボタンの位置取得(言語/エフェクトモードボタンと同じ仕組み)。
    // ラベル幅も実測する(2026-08-19実機FB: 固定オフセットだとグリッドがFABラベル文言
    // 「表示メンバー」に重なるバグだった。言語/エフェクトモードと同じ理由・同じ直し方)。
    const partyVisButtonRef = React.useRef<HTMLButtonElement>(null);
    const partyVisLabelRef = React.useRef<HTMLSpanElement>(null);
    const [partyVisButtonRect, setPartyVisButtonRect] = React.useState<DOMRect | null>(null);
    const [partyVisLabelWidth, setPartyVisLabelWidth] = React.useState(50);
    React.useEffect(() => {
        if (!partyVisOpen) {
            setPartyVisButtonRect(null);
            return;
        }
        const update = () => {
            if (partyVisButtonRef.current) {
                setPartyVisButtonRect(partyVisButtonRef.current.getBoundingClientRect());
            }
            if (partyVisLabelRef.current) {
                setPartyVisLabelWidth(partyVisLabelRef.current.getBoundingClientRect().width);
            }
        };
        update();
        const onChange = () => update();
        window.addEventListener('scroll', onChange, true);
        window.addEventListener('resize', onChange);
        return () => {
            window.removeEventListener('scroll', onChange, true);
            window.removeEventListener('resize', onChange);
        };
    }, [partyVisOpen]);

    // エフェクトモードボタンの位置取得(言語ボタンと同じ仕組み)。
    const effectModeButtonRef = React.useRef<HTMLButtonElement>(null);
    const effectModeLabelRef = React.useRef<HTMLSpanElement>(null);
    const [effectModeButtonRect, setEffectModeButtonRect] = React.useState<DOMRect | null>(null);
    const [effectModeLabelWidth, setEffectModeLabelWidth] = React.useState(50);
    React.useEffect(() => {
        if (!effectModeOpen) {
            setEffectModeButtonRect(null);
            return;
        }
        const update = () => {
            if (effectModeButtonRef.current) {
                setEffectModeButtonRect(effectModeButtonRef.current.getBoundingClientRect());
            }
            if (effectModeLabelRef.current) {
                setEffectModeLabelWidth(effectModeLabelRef.current.getBoundingClientRect().width);
            }
        };
        update();
        const onChange = () => update();
        window.addEventListener('scroll', onChange, true);
        window.addEventListener('resize', onChange);
        return () => {
            window.removeEventListener('scroll', onChange, true);
            window.removeEventListener('resize', onChange);
        };
    }, [effectModeOpen]);

    // 言語切替タイマーのクリーンアップ
    React.useEffect(() => {
        return () => {
            if (langTimerRef.current) {
                clearTimeout(langTimerRef.current);
            }
        };
    }, []);

    // fan-outチップ(言語/エフェクトモード)を両方とも閉じる。メニュー全体を閉じる時に
    // チップだけ画面に取り残されるバグの対策(2026-08-14実機FB=「言語を選択するまで消えない」。
    // 原因はメインFABボタンのトグルがlangOpenをリセットしていなかったこと)。
    const closeAllChips = () => {
        setLangOpen(false);
        setEffectModeOpen(false);
        setPartyVisOpen(false);
    };

    const close = () => {
        closeAllChips();
        setOpen(false);
    };

    // 言語円弧セレクターのトグル。同時に他が開かないよう、他は閉じる。
    const handleLanguageToggle = () => {
        setEffectModeOpen(false);
        setPartyVisOpen(false);
        setLangOpen(prev => !prev);
    };

    // パーティ表示/非表示グリッドのトグル。他のチップと同時に開かないよう閉じる。
    // 言語チップと違い選択しても閉じない(複数メンバーを続けてON/OFFできるようにするため)。
    const handlePartyVisToggle = () => {
        setLangOpen(false);
        setEffectModeOpen(false);
        setPartyVisOpen(prev => !prev);
    };

    // 言語選択実行（選択チップをscale 1.3→吸い込み、他は逆staggerで中心へ）
    const handleLanguageSelect = (lang: ContentLanguage) => {
        const current = i18n.language as ContentLanguage;
        if (lang === current) {
            setLangOpen(false);
            return;
        }
        setSelectedLang(lang);
        // 吸い込みアニメーション完了を待ってからトランジション実行
        const exitDuration = LANG_DISPLAY_ORDER.length * 0.04 + 0.2; // stagger + base
        langTimerRef.current = setTimeout(() => {
            setLangOpen(false);
            setSelectedLang(null);
            close();
            runTransition(() => {
                i18n.changeLanguage(lang);
                setContentLanguage(lang);
            }, 'language');
        }, exitDuration * 1000);
    };

    // テーマ切替
    const handleTheme = () => {
        close();
        onToggleTheme();
    };

    // エフェクトモード選択チップのトグル(言語ボタンと同じ操作感。2026-08-14ユーザー要望=
    // 順送りタップ式だと何度もメニューを開き直す必要があって分かりにくかったため)。
    const handleEffectModeToggle = () => {
        setLangOpen(false);
        setPartyVisOpen(false);
        setEffectModeOpen(prev => !prev);
    };
    const handleEffectModeSelect = (mode: MobileEffectBarMode) => {
        setEffectModeOpen(false);
        close();
        setMobileEffectBarMode(mode);
    };
    const EFFECT_BAR_MODE_LABEL_KEY: Record<MobileEffectBarMode, string> = {
        icon: 'app.fab_effect_mode_icon',
        scroll: 'app.fab_effect_mode_scroll',
        bar: 'app.fab_effect_mode_bar',
    };

    // ナビゲーションアクション
    const handlePhase = () => { close(); onPhaseJump?.(); };
    const handleLabel = () => { close(); onLabelJump?.(); };
    const handleSearch = () => { close(); onMechanicSearch?.(); };

    // FAB items
    const navItems = [
        {
            key: 'expand',
            label: hideEmptyRows ? t('app.fab_expand') : t('app.fab_collapse'),
            icon: hideEmptyRows ? <Rows3 size={20} /> : <AlignJustify size={20} />,
            onClick: () => { close(); onToggleExpand?.(); },
            accent: false,
        },
        {
            key: 'phase',
            label: t('app.fab_phase'),
            icon: <List size={20} />,
            onClick: handlePhase,
            accent: false,
        },
        {
            key: 'label',
            label: t('app.fab_label'),
            icon: <Tag size={20} />,
            onClick: handleLabel,
            accent: false,
        },
        {
            key: 'search',
            label: t('app.fab_search'),
            icon: <Search size={20} />,
            onClick: handleSearch,
            accent: false,
        },
    ];

    const settingsItems = [
        {
            key: 'language',
            label: t('app.fab_language'),
            icon: <Globe size={20} />,
            onClick: handleLanguageToggle,
            accent: false,
        },
        {
            key: 'theme',
            label: t('app.fab_theme'),
            icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />,
            onClick: handleTheme,
            accent: false,
        },
        {
            key: 'effect-bar-mode',
            label: t(EFFECT_BAR_MODE_LABEL_KEY[mobileEffectBarMode]),
            icon: <Sparkles size={20} />,
            onClick: handleEffectModeToggle,
            accent: false,
        },
        {
            key: 'party-visibility',
            label: t('app.fab_party_visibility'),
            icon: <Users size={20} />,
            onClick: handlePartyVisToggle,
            accent: false,
        },
    ];

    // アニメーション: トークン使用
    const itemVariants = {
        hidden: { opacity: 0, y: 16, scale: 0.85 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                ...SPRING.default,
                delay: i * (STAGGER.fab / 1000),
            },
        }),
        exit: (i: number) => ({
            opacity: 0,
            y: 12,
            scale: 0.85,
            transition: {
                ...SPRING.snappy,
                delay: i * 0.025,
            },
        }),
    };

    const allItems = [...navItems, 'divider' as const, ...settingsItems];

    return (
        <div
            className="fixed right-4 z-[300] md:hidden flex flex-col items-end gap-0"
            style={{
                // 内側へ寄せる案は「中途半端な位置でダサい」と不評だったため右端(right-4)に戻す
                // (2026-08-13)。縦位置はボトムナビゲーションにできるだけ近づける
                // (MOBILE_TOKENS.bottomNav.height + 少しの余白)。
                bottom: `calc(${MOBILE_TOKENS.bottomNav.height}px + 0.5rem)`,
            }}
        >

            {/* 背景オーバーレイ */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="fab-overlay"
                        className="fixed inset-0 z-[-1]"
                        style={{ backgroundColor: 'var(--color-fab-overlay)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={close}
                    />
                )}
            </AnimatePresence>

            {/* メニュー項目 */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="fab-menu"
                        ref={menuRef}
                        onScroll={updateScrollState}
                        className="flex flex-col items-end gap-2 mb-3 max-h-[calc(100svh-180px)] overflow-y-auto [&::-webkit-scrollbar]:hidden"
                        style={{
                            scrollbarWidth: 'none',
                            maskImage: menuMaskImage,
                            WebkitMaskImage: menuMaskImage,
                        }}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        {allItems.map((item, idx) => {
                            if (item === 'divider') {
                                return (
                                    <motion.div
                                        key="divider"
                                        custom={idx}
                                        variants={itemVariants}
                                        className="w-28 h-px bg-app-border/60 my-0.5 mr-1"
                                    />
                                );
                            }
                            const isSync = item.key === 'sync';
                            const isLang = item.key === 'language';
                            const isEffectMode = item.key === 'effect-bar-mode';
                            const isPartyVis = item.key === 'party-visibility';
                            const isChipButton = isLang || isEffectMode || isPartyVis;
                            const chipRef = isLang ? langButtonRef : isEffectMode ? effectModeButtonRef : partyVisButtonRef;
                            const chipOpen = isLang ? langOpen : isEffectMode ? effectModeOpen : partyVisOpen;
                            const chipLabelRef = isLang ? langLabelRef : isEffectMode ? effectModeLabelRef : isPartyVis ? partyVisLabelRef : undefined;
                            return (
                                <motion.div
                                    key={item.key}
                                    custom={idx}
                                    variants={itemVariants}
                                    className="flex items-center gap-2.5"
                                    style={isChipButton ? { position: 'relative', zIndex: 50 } : undefined}
                                >
                                    {/* ラベル（ボタンの左） */}
                                    <span
                                        ref={isChipButton ? chipLabelRef : undefined}
                                        className="text-[13px] font-semibold text-white/90 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 select-none whitespace-nowrap shadow-md"
                                    >
                                        {item.label}
                                    </span>

                                    {/* ボタン */}
                                    {isChipButton ? (
                                        <motion.button
                                            ref={chipRef}
                                            onClick={item.onClick}
                                            className={clsx(
                                                "flex items-center justify-center border",
                                                "shadow-xl active:scale-90 transition-transform duration-100",
                                                "text-app-text"
                                            )}
                                            style={{
                                                width: MOBILE_TOKENS.fab.itemSize,
                                                height: MOBILE_TOKENS.fab.itemSize,
                                                borderRadius: MOBILE_TOKENS.fab.radius,
                                                backgroundColor: 'var(--color-fab-bg)',
                                                borderColor: 'var(--color-fab-border)',
                                            }}
                                            animate={chipOpen ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                            whileTap={{ scale: 0.9 }}
                                            transition={{ duration: 0.12 }}
                                        >
                                            {item.icon}
                                        </motion.button>
                                    ) : (
                                        <button
                                            onClick={item.onClick}
                                            disabled={'disabled' in item ? Boolean(item.disabled) : false}
                                            className={clsx(
                                                "flex items-center justify-center border",
                                                "shadow-xl active:scale-90 transition-transform duration-100",
                                                "disabled:pointer-events-none disabled:opacity-40",
                                                isSync
                                                    ? "bg-app-blue/12 border-app-blue/20 text-app-blue"
                                                    : "text-app-text"
                                            )}
                                            style={{
                                                width: MOBILE_TOKENS.fab.itemSize,
                                                height: MOBILE_TOKENS.fab.itemSize,
                                                borderRadius: MOBILE_TOKENS.fab.radius,
                                                ...(!isSync ? {
                                                    backgroundColor: 'var(--color-fab-bg)',
                                                    borderColor: 'var(--color-fab-border)',
                                                } : {}),
                                            }}
                                        >
                                            {item.icon}
                                        </button>
                                    )}

                                </motion.div>
                            );
                        })}

                        {/* スクロール可能ヒント: ↓ アイコン（canScrollDown のみ。sticky bottom でメニュー下端に常駐） */}
                        {canScrollDown && (
                            <div
                                className="sticky bottom-0 self-center pointer-events-none -mt-1"
                                aria-hidden
                            >
                                <ChevronDown size={20} className="text-white drop-shadow-md animate-bounce" />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 言語チップ — Portal で body に出して、メニューの overflow に縛られず左に展開できる */}
            {langButtonRect && createPortal(
                <AnimatePresence>
                    {langOpen && LANG_DISPLAY_ORDER.map((lang: ContentLanguage, i: number) => (
                        <motion.button
                            key={lang}
                            custom={{ i, targetX: fanChipX(i, LANG_DISPLAY_ORDER.length, langLabelWidth), count: LANG_DISPLAY_ORDER.length, isSelected: selectedLang === lang }}
                            variants={fanChipVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            whileTap="tap"
                            onClick={() => handleLanguageSelect(lang)}
                            className={clsx(
                                "fixed flex items-center justify-center rounded-full",
                                "font-semibold text-[13px] shadow-lg select-none",
                                lang === (i18n.language as ContentLanguage)
                                    ? "bg-app-blue text-white shadow-app-blue/30"
                                    : "bg-black/70 text-white/90 backdrop-blur-sm"
                            )}
                            style={{
                                width: FAN_CHIP_SIZE,
                                height: FAN_CHIP_SIZE,
                                left: langButtonRect.left + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                top: langButtonRect.top + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                zIndex: 9999,
                            }}
                        >
                            {LANG_LABELS[lang]}
                        </motion.button>
                    ))}
                </AnimatePresence>,
                document.body
            )}

            {/* エフェクトモードチップ — 言語チップと同じPortalパターン(2026-08-14ユーザー要望)。 */}
            {effectModeButtonRect && createPortal(
                <AnimatePresence>
                    {effectModeOpen && EFFECT_MODE_ORDER.map((mode, i) => (
                        <motion.button
                            key={mode}
                            custom={{ i, targetX: fanChipX(i, EFFECT_MODE_ORDER.length, effectModeLabelWidth), count: EFFECT_MODE_ORDER.length, isSelected: mobileEffectBarMode === mode }}
                            variants={fanChipVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            whileTap="tap"
                            onClick={() => handleEffectModeSelect(mode)}
                            className={clsx(
                                "fixed flex items-center justify-center rounded-full",
                                "font-semibold text-[13px] shadow-lg select-none",
                                mode === mobileEffectBarMode
                                    ? "bg-app-blue text-white shadow-app-blue/30"
                                    : "bg-black/70 text-white/90 backdrop-blur-sm"
                            )}
                            style={{
                                width: FAN_CHIP_SIZE,
                                height: FAN_CHIP_SIZE,
                                left: effectModeButtonRect.left + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                top: effectModeButtonRect.top + (MOBILE_TOKENS.fab.itemSize - FAN_CHIP_SIZE) / 2,
                                zIndex: 9999,
                            }}
                        >
                            {EFFECT_MODE_CHIP_LABELS[mode]}
                        </motion.button>
                    ))}
                </AnimatePresence>,
                document.body
            )}

            {/* パーティ表示/非表示グリッド — 言語/エフェクトモードのfan-outチップと同じ技法
                (ボタン位置から個別にバネで飛び出す・タップ後も閉じない)を2段×4列に適用
                (2026-08-19)。共通の箱には入れず、ジョブアイコン1個ずつが独立したチップ。 */}
            {partyVisButtonRect && createPortal(
                <AnimatePresence>
                    {partyVisOpen && partyVisibilityCells.map((m, i) => {
                        const col = i % 4;
                        const row = Math.floor(i / 4);
                        // グリッド全体(4列×2段)の右端をFABラベル文言の左に実測ぶんの隙間を空けて置く
                        // (fanChipXと同じ gap=10/12 の考え方。固定オフセットだと「表示メンバー」等の
                        // 長いラベルに重なるバグだったため、言語/エフェクトモードと同じくラベル幅実測に揃えた)。
                        const gridW = 4 * 44 + 3 * 6;
                        const gridRight = partyVisButtonRect.left - 10 - partyVisLabelWidth - 12;
                        const anchorLeft = gridRight - gridW;
                        const anchorTop = partyVisButtonRect.top - (2 * 44 + 6 + 16 - MOBILE_TOKENS.fab.itemSize) / 2;
                        const targetX = anchorLeft + col * (44 + 6) - partyVisButtonRect.left;
                        const targetY = anchorTop + row * (44 + 6) - partyVisButtonRect.top;
                        return (
                            <motion.button
                                key={m.id}
                                type="button"
                                custom={{ i, targetX, targetY, count: partyVisibilityCells.length }}
                                variants={partyVisCellVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                onClick={() => toggleHiddenPartyMember(m.id)}
                                // active:scale-90(CSS)は使わない: このボタンはframer-motionが
                                // variants経由でx/y/scaleのtransformを継続制御しており、CSS:activeの
                                // transformと取り合って指を置いた瞬間にアイコンが動こうとするような
                                // 見た目になり、タップ判定が安定しない(メインFABボタンで2026-08-13に
                                // 同じ原因を特定済み・下記769行目付近のコメント参照)。press演出は
                                // whileTapだけに一本化する。
                                whileTap={{ scale: 0.85, transition: { duration: 0.1 } }}
                                className="fixed flex items-center justify-center"
                                style={{
                                    left: partyVisButtonRect.left,
                                    top: partyVisButtonRect.top,
                                    width: 44,
                                    height: 44,
                                    zIndex: 9999,
                                }}
                            >
                                {m.icon && (
                                    <img
                                        src={m.icon}
                                        alt={m.id}
                                        className={clsx(
                                            'w-8 h-8 rounded-md object-cover drop-shadow-lg transition-all duration-150',
                                            m.hidden && 'opacity-30 grayscale scale-90'
                                        )}
                                    />
                                )}
                            </motion.button>
                        );
                    })}
                </AnimatePresence>,
                document.body
            )}

            {/* メインFABボタン。タイムラインをスクロール中(かつメニューが開いていない時)だけ
                縮小+透明化して隠す(親指の邪魔になる実機FB対応)。メニューを開いたまま偶発的に
                スクロールされても本体ごと消えて宙に浮かないよう !open をガードに入れる。
                閉じる時はfan-outチップも道連れに閉じる(2026-08-14実機FB=言語チップが
                「言語を選択するまで消えない」バグの根治=このボタンでもチップを閉じる)。 */}
            <motion.button
                onClick={() => setOpen(prev => {
                    const next = !prev;
                    if (!next) closeAllChips();
                    return next;
                })}
                className="flex items-center justify-center border text-app-text shadow-2xl"
                style={{
                    width: MOBILE_TOKENS.fab.size,
                    height: MOBILE_TOKENS.fab.size,
                    borderRadius: MOBILE_TOKENS.fab.radius,
                    backgroundColor: 'var(--color-fab-bg)',
                    borderColor: 'var(--color-fab-border)',
                    pointerEvents: (isMobileScrolling && !open) ? 'none' : 'auto',
                }}
                // active:scale-90 + transition-all(CSS)を外した: framer-motionのanimate/whileTapと
                // 同じtransformを取り合ってカクつく原因になっていた(2026-08-13実機FB=消える/出現する
                // アニメがぎこちない)。press演出はwhileTapだけに一本化。
                // scroll中の縮小/透明化はバネ(spring)だとopacityとscaleの収束タイミングがズレて
                // ぎこちなく見えるため、両方が同じ速度で揃って動く一定時間のtween+MD3標準イージングに変更。
                animate={{ scale: (isMobileScrolling && !open) ? 0 : 1, opacity: (isMobileScrolling && !open) ? 0 : 1 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                whileTap={{ scale: 0.88, transition: { duration: 0.1 } }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {open ? (
                        <motion.span
                            key="close"
                            initial={{ rotate: -45, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 45, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <X size={22} />
                        </motion.span>
                    ) : (
                        <motion.span
                            key="open"
                            initial={{ rotate: 45, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -45, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <MoreHorizontal size={22} />
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
};
