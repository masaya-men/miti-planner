import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    List, Tag, Search,
    Globe, Sun, Moon,
    Rows3, AlignJustify,
    Sparkles, Users,
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import type { ContentLanguage, MobileEffectBarMode } from '../store/useThemeStore';
import { useTransitionOverlay } from './ui/transitionOverlayContext';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { PARTY_MEMBER_IDS } from '../constants/party';
import { LANG_DISPLAY_ORDER } from './fab/mobileFabChips';
import { useFabChipAnchors } from './fab/useFabChipAnchors';
import { useFabMenuScroll } from './fab/useFabMenuScroll';
import { FabLanguageChips } from './fab/FabLanguageChips';
import { FabEffectModeChips } from './fab/FabEffectModeChips';
import { FabPartyVisGrid } from './fab/FabPartyVisGrid';
import { FabMainButton } from './fab/FabMainButton';
import { FabMenu } from './fab/FabMenu';

interface MobileFABProps {
    onToggleTheme: () => void;
    theme: string;
    onPhaseJump?: () => void;
    onLabelJump?: () => void;
    onMechanicSearch?: () => void;
    onToggleExpand?: () => void;
    hideEmptyRows?: boolean;
}


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
    const { menuRef, canScrollDown, updateScrollState, menuMaskImage } = useFabMenuScroll(open);

    // 言語/エフェクトモード/パーティ表示ボタンの位置とラベル幅の実測(チップを Portal で body に出すため)
    const {
        langButtonRef, langLabelRef, langButtonRect, langLabelWidth,
        partyVisButtonRef, partyVisLabelRef, partyVisButtonRect, partyVisLabelWidth,
        effectModeButtonRef, effectModeLabelRef, effectModeButtonRect, effectModeLabelWidth,
    } = useFabChipAnchors({ langOpen, effectModeOpen, partyVisOpen });


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

            <FabMenu
                open={open}
                menuRef={menuRef}
                updateScrollState={updateScrollState}
                menuMaskImage={menuMaskImage}
                canScrollDown={canScrollDown}
                allItems={allItems}
                langOpen={langOpen}
                effectModeOpen={effectModeOpen}
                partyVisOpen={partyVisOpen}
                langButtonRef={langButtonRef}
                effectModeButtonRef={effectModeButtonRef}
                partyVisButtonRef={partyVisButtonRef}
                langLabelRef={langLabelRef}
                effectModeLabelRef={effectModeLabelRef}
                partyVisLabelRef={partyVisLabelRef}
            />

            <FabLanguageChips
                langButtonRect={langButtonRect}
                langOpen={langOpen}
                langLabelWidth={langLabelWidth}
                selectedLang={selectedLang}
                handleLanguageSelect={handleLanguageSelect}
            />

            <FabEffectModeChips
                effectModeButtonRect={effectModeButtonRect}
                effectModeOpen={effectModeOpen}
                effectModeLabelWidth={effectModeLabelWidth}
                mobileEffectBarMode={mobileEffectBarMode}
                handleEffectModeSelect={handleEffectModeSelect}
            />

            <FabPartyVisGrid
                partyVisButtonRect={partyVisButtonRect}
                partyVisOpen={partyVisOpen}
                partyVisLabelWidth={partyVisLabelWidth}
                partyVisibilityCells={partyVisibilityCells}
                toggleHiddenPartyMember={toggleHiddenPartyMember}
            />

            <FabMainButton open={open} isMobileScrolling={isMobileScrolling} setOpen={setOpen} closeAllChips={closeAllChips} />
        </div>
    );
};
