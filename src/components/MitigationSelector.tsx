import { backdropClose } from '../utils/backdropClose';
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { CloseButton } from './ui/ModalParts';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useMitigations, useJobs, getMitigationPriority } from '../hooks/useSkillsData';
import type { Mitigation, AppliedMitigation } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { resolveSeraphismMitigation, matchesCopiesShieldSource } from '../utils/scholarShieldRules';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
import { MitigationSkillButton } from './mitigationSelector/MitigationSkillButton';
import { MitigationTargetPicker } from './mitigationSelector/MitigationTargetPicker';
import { MitigationShieldPicker } from './mitigationSelector/MitigationShieldPicker';

interface MitigationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mitigation: Mitigation & { _targetId?: string; _linkedMitigationId?: string }) => void;
    onRemove?: (mitigationId: string) => void; // 👈 追加：削除用コールバック
    ownerId?: string | null; // 👈 追加：使用者自身（自己対象不可の判定用）
    jobId: string | null;
    position: { x: number; y: number };
    activeMitigations?: AppliedMitigation[];
    selectedTime?: number;
    isCentered?: boolean; // 👈 追加：中央表示モードのフラグ
}

export const MitigationSelector: React.FC<MitigationSelectorProps> = ({
    isOpen, onClose, onSelect, onRemove, ownerId, jobId, position, activeMitigations = [], selectedTime = 0,
    isCentered = false // 👈 デフォルトはfalse（今まで通り）
}) => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();

    const panelRef = React.useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = React.useState(position);

    const [selectedSingleTargetMit, setSelectedSingleTargetMit] = React.useState<Mitigation | null>(null);
    const [selectedCopyShieldMit, setSelectedCopyShieldMit] = React.useState<Mitigation | null>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    useSmoothWheelScroll(scrollContainerRef);
    const { partyMembers, currentLevel, timelineMitigations } = useMitigationStore();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();
    const [isMobile, setIsMobile] = React.useState(false);

    // Escape: 対象選択中→スキル一覧に戻る、スキル一覧→モーダルを閉じる
    useEscapeClose(isOpen, () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else if (selectedCopyShieldMit) {
            setSelectedCopyShieldMit(null);
        } else {
            onClose();
        }
    });

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ビューポート内に収めるための計算
    React.useLayoutEffect(() => {
        if (!isOpen || !panelRef.current || isCentered || isMobile) {
            return;
        }

        const rect = panelRef.current.getBoundingClientRect();
        // タイムライン scroll container を基準に「タイムライン内に確実に収まる」位置を計算
        // (フッター高さ等を window.innerHeight から差し引かなくても、 タイムライン rect の
        // bottom がそのまま「フッター上端 = モーダルが置ける限界」になる)
        const timelineEl = document.querySelector('.timeline-scroll-container') as HTMLElement | null;
        const timelineRect = timelineEl?.getBoundingClientRect();
        const xMin = (timelineRect ? timelineRect.left : 0) + 12;
        const xMax = (timelineRect ? timelineRect.right : window.innerWidth) - 12;
        const yMin = (timelineRect ? timelineRect.top : 0) + 12;
        const yMax = (timelineRect ? timelineRect.bottom : window.innerHeight) - 12;

        let nx = position.x;
        let ny = position.y;

        // 右端チェック
        if (nx + rect.width > xMax) {
            nx = Math.max(xMin, xMax - rect.width);
        }
        // 下端チェック
        if (ny + rect.height > yMax) {
            ny = Math.max(yMin, yMax - rect.height);
        }

        // 差分がある場合のみ更新
        if (Math.abs(nx - adjustedPos.x) > 1 || Math.abs(ny - adjustedPos.y) > 1) {
            setAdjustedPos({ x: nx, y: ny });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adjustedPos は差分判定の読み取り専用。依存に入れると自分の setAdjustedPos で再実行されるため、開閉・位置・モバイル・中央表示が変わった時だけ走らせる
    }, [isOpen, position.x, position.y, isMobile, isCentered]);

    React.useEffect(() => {
        if (!isOpen) {
            setSelectedSingleTargetMit(null);
            setSelectedCopyShieldMit(null);
            return;
        }
    }, [isOpen]);

    React.useEffect(() => {
        if (isOpen && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const allJobMitigations = jobId ? MITIGATIONS.filter(m => m.jobId === jobId) : [];

    const getResourceStatus = (m: Mitigation) => {
        return validateMitigationPlacement(m, selectedTime, activeMitigations, t);
    };

    const isSeraphActive = jobId === 'sch' && activeMitigations.some(am =>
        am.mitigationId === 'summon_seraph' &&
        selectedTime >= am.time &&
        selectedTime < am.time + am.duration
    );

    const isSeraphismActive = jobId === 'sch' && activeMitigations.some(am =>
        am.mitigationId === 'seraphism' &&
        selectedTime >= am.time &&
        selectedTime < am.time + am.duration
    );

    const availableMitigations = allJobMitigations
        .filter((m: Mitigation) => {
            // Level sync filtering
            if (m.minLevel !== undefined && currentLevel < m.minLevel) return false;
            if (m.maxLevel !== undefined && currentLevel > m.maxLevel) return false;

            // Filter out hidden skills (e.g., Adloquium)
            if (m.hidden) return false;

            if (!m.requires) return true;

            // AST カード専用: 最新のドローが対応する種別か (手札は次のドローまで保持される仕様)
            if (m.requires === 'astral_draw' || m.requires === 'umbral_draw') {
                const drawsBeforeNow = activeMitigations
                    .filter(am => am.mitigationId === 'astral_draw' || am.mitigationId === 'umbral_draw')
                    .filter(am => am.time <= selectedTime)
                    .sort((a, b) => b.time - a.time);
                if (drawsBeforeNow.length === 0) return false;
                return drawsBeforeNow[0].mitigationId === m.requires;
            }

            return activeMitigations.some(am => {
                const isNeutSect = am.mitigationId === 'neutral_sect';
                const isHoroscope = am.mitigationId === 'horoscope';
                // requiresWindow がある場合はそちらを使用（例: 金剛周天は30秒窓）
                const window = m.requiresWindow ?? am.duration;
                const isActive = selectedTime >= am.time && selectedTime < am.time + window;
                if (!isActive) return false;

                // Special handling for Astrologian conditional skills
                if (m.requires === 'neutral_sect') {
                    // Sun Sign MUST have Neutral Sect active
                    if (m.id === 'sun_sign') {
                        return isNeutSect;
                    }
                    // Helios-based skills can use either Neutral Sect or Horoscope
                    return isNeutSect || isHoroscope;
                }

                return am.mitigationId === m.requires;
            });
        })
        // ソートは「すり替え前」の id で行う。すり替え後の id でソートすると、セラフィズムの
        // 発動/終了のたびに一覧内の表示位置が飛んでしまうため。
        .sort((a: Mitigation, b: Mitigation) => getMitigationPriority(a.id) - getMitigationPriority(b.id))
        .map((m: Mitigation) => {
            // セラフィズム中: 鼓舞激励の策→マニフェステーション、意気軒高の策→アクセッション
            const seraphismResolved = isSeraphismActive
                ? resolveSeraphismMitigation(m, selectedTime, activeMitigations, MITIGATIONS)
                : m;
            if (seraphismResolved !== m) return seraphismResolved;

            // Scholar Seraph dynamic changes (サモン・セラフィム中の名称のみ変更)
            if (isSeraphActive) {
                if (m.id === 'whispering_dawn') {
                    return { ...m, name: { ...m.name, ja: '光輝の囁き', en: 'Angel\'s Whisper' }, icon: '/icons/Angel\'s_Whisper.png' };
                }
                if (m.id === 'fey_illumination') {
                    return { ...m, name: { ...m.name, ja: 'セラフィックイルミネーション', en: 'Seraphic Illumination' }, icon: '/icons/Seraphic_Illumination.png' };
                }
            }
            return m;
        });

    const handleMitigationClick = (mitigation: Mitigation) => {
        const existingInstance = activeMitigations.find(am => am.mitigationId === mitigation.id && am.time === selectedTime);
        if (existingInstance && onRemove) {
            onRemove(existingInstance.id);
            return;
        }

        // copiesShield: 展開戦術 → 有効な鼓舞を検索してUI分岐
        if (mitigation.copiesShield) {
            const availableShields = timelineMitigations.filter(l =>
                matchesCopiesShieldSource(l.mitigationId, mitigation.copiesShield!) &&
                l.time <= selectedTime &&
                l.time + l.duration > selectedTime
            );

            if (availableShields.length === 1) {
                // 自動選択: 1つだけなら直接onSelect
                onSelect({ ...mitigation, _linkedMitigationId: availableShields[0].id });
                return;
            }

            // 0個 or 2+個: 選択UIを表示（0個でも配置は許可、バリア値0警告）
            setSelectedCopyShieldMit(mitigation);
            setTimeout(() => {
                const el = document.getElementById(`miti-btn-${mitigation.id}`);
                const container = scrollContainerRef.current;
                if (el && container) {
                    const topPos = el.offsetTop - 4;
                    container.scrollTo({ top: topPos, behavior: 'smooth' });
                }
            }, 50);
            return;
        }

        if (mitigation.scope === 'target') {
            setSelectedSingleTargetMit(mitigation);
            setTimeout(() => {
                const el = document.getElementById(`miti-btn-${mitigation.id}`);
                const container = scrollContainerRef.current;
                if (el && container) {
                    const topPos = el.offsetTop - 4;
                    container.scrollTo({
                        top: topPos,
                        behavior: 'smooth'
                    });
                }
            }, 50);
        } else {
            onSelect(mitigation);
        }
    };

    const handleTargetSelect = (targetId: string) => {
        if (selectedSingleTargetMit) {
            onSelect({ ...selectedSingleTargetMit, _targetId: targetId });
        }
    };

    const handleShieldSelect = (linkedMitigationId?: string) => {
        if (selectedCopyShieldMit) {
            onSelect({ ...selectedCopyShieldMit, _linkedMitigationId: linkedMitigationId });
        }
    };

    // 背景クリックで閉じる(チュートリアル中は閉じない)
    const handleBackdropClose = () => {
        if (useTutorialStore.getState().isActive) return;
        onClose();
    };

    const handleClose = () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else if (selectedCopyShieldMit) {
            setSelectedCopyShieldMit(null);
        } else {
            onClose();
        }
    };

    return (
        // 👇 修正：isCenteredがtrueなら、画面全体を覆うオーバーレイにしてド真ん中に配置！
        <div
            className={clsx(
                "fixed z-[9999] pointer-events-none",
                isCentered ? "inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-auto" : ""
            )}
            style={!isCentered ? { top: 0, left: 0 } : {}}
            {...(isCentered ? backdropClose(handleBackdropClose) : {})} // 背景クリックで閉じる(押し始めも離しも外側のときだけ)
        >
            {/* 非センター表示: 透明な全画面の背景がクリック・ホバーを受け止め、下の要素へは一切届かせない */}
            {!isCentered && (
                <div
                    className="fixed inset-0 pointer-events-auto cursor-default"
                    {...backdropClose(handleBackdropClose)}
                />
            )}
            <div
                key="mitigation-modal-content" // アニメーション等のために全体コンテナにも念のため付与
                ref={panelRef}
                data-tutorial-modal
                data-lenis-prevent
                onClick={e => e.stopPropagation()} // 中身のクリックで閉じないように
                className={clsx(
                    "pointer-events-auto shadow-sm p-2 flex flex-col glass-tier3",
                    isMobile && !isCentered
                        ? "fixed bottom-0 left-0 right-0 w-full rounded-t-2xl rounded-b-none border-b-0 translate-y-0"
                        : "rounded-xl w-64",
                    !isCentered && !isMobile ? "fixed" : "relative"
                )}
                style={isMobile && !isCentered
                    ? { maxHeight: '75vh' }
                    // PC は他の窓と同じ地(ライトで白)
                    : {
                        ...({ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties),
                        ...(!isCentered ? { left: adjustedPos.x || position.x, top: adjustedPos.y || position.y, maxHeight: '50vh' } : { maxHeight: '60vh' }),
                    }}
            >
                {isMobile && !isCentered && <div className="w-12 h-1 bg-app-border rounded-full mx-auto mb-3 shrink-0" />}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-app-border px-1 shrink-0 relative z-[101]">
                    <div className="flex items-center pl-1">
                        <div className="flex flex-col justify-center min-w-0">
                            {selectedCopyShieldMit ? (
                                <button
                                    onClick={() => setSelectedCopyShieldMit(null)}
                                    className="group flex items-center gap-1 text-app-base font-black text-app-text-sec uppercase tracking-tighter leading-none hover:text-app-text transition-colors cursor-pointer text-left"
                                >
                                    <ChevronLeft
                                        size={12}
                                        className="transition-transform duration-200 group-hover:-translate-x-0.5"
                                    />
                                    <span>{t('mitigation.select_shield', '展開する鼓舞を選択')}</span>
                                </button>
                            ) : selectedSingleTargetMit ? (
                                <button
                                    onClick={() => setSelectedSingleTargetMit(null)}
                                    className="group flex items-center gap-1 text-app-base font-black text-app-text-sec uppercase tracking-tighter leading-none hover:text-app-text transition-colors cursor-pointer text-left"
                                >
                                    <ChevronLeft
                                        size={12}
                                        className="transition-transform duration-200 group-hover:-translate-x-0.5"
                                    />
                                    <span>{t('mitigation.select_target', '対象を選択')}</span>
                                </button>
                            ) : (
                                <span className="text-app-base font-black text-app-text-sec uppercase tracking-tighter leading-none">
                                    {t('mitigation.select')}
                                </span>
                            )}
                        </div>
                    </div>
                    <CloseButton onClick={handleClose} label={t('common.close')} />
                </div>

                <div className="relative h-[280px] sm:h-[320px] overflow-hidden rounded-lg">
                    {/* 背景のスキルリスト */}
                    <div
                        className={clsx(
                            "absolute inset-0 flex flex-col transition-all duration-300 pr-1 custom-scrollbar space-y-1",
                            selectedSingleTargetMit ? "pointer-events-none overflow-hidden pb-[140px]" : "overflow-y-auto opacity-100 blur-0 pb-1"
                        )}
                        ref={scrollContainerRef}
                    >
                        {availableMitigations.length === 0 ? (
                            <div className="text-app-lg text-app-text-sec p-4 text-center">{t('mitigation.no_mitigations')}</div>
                        ) : (
                            availableMitigations.map(mitigation => {
                                const status = getResourceStatus(mitigation);
                                const isAlreadyPlaced = activeMitigations.some(am => am.mitigationId === mitigation.id && am.time === selectedTime);

                                const isClickable = (status.available || status.conflictOverride || isAlreadyPlaced);
                                const isSelectedTargetMit = selectedSingleTargetMit?.id === mitigation.id;
                                const isSelectedShieldMit = selectedCopyShieldMit?.id === mitigation.id;
                                const isBlurred = (selectedSingleTargetMit !== null && !isSelectedTargetMit) ||
                                                  (selectedCopyShieldMit !== null && !isSelectedShieldMit);

                                return (
                                    <React.Fragment key={mitigation.id}>
                                    <MitigationSkillButton
                                        mitigation={mitigation}
                                        status={status}
                                        contentLanguage={contentLanguage}
                                        isClickable={isClickable}
                                        isAlreadyPlaced={isAlreadyPlaced}
                                        isSelectedTargetMit={isSelectedTargetMit}
                                        isSelectedShieldMit={isSelectedShieldMit}
                                        isBlurred={isBlurred}
                                        selectedCopyShieldMit={selectedCopyShieldMit}
                                        onClick={() => isClickable && handleMitigationClick(mitigation)}
                                    />

                                    {/* 💥 修正：選択されたスキルの直下にインラインでパネルを展開する */}
                                    {isSelectedTargetMit && (
                                        <MitigationTargetPicker
                                            partyMembers={partyMembers}
                                            JOBS={JOBS}
                                            selectedSingleTargetMit={selectedSingleTargetMit}
                                            ownerId={ownerId}
                                            onSelect={handleTargetSelect}
                                        />
                                    )}

                                    {/* copiesShield: 鼓舞選択パネル */}
                                    {selectedCopyShieldMit?.id === mitigation.id && (
                                        <MitigationShieldPicker
                                            mitigation={mitigation}
                                            selectedTime={selectedTime}
                                            timelineMitigations={timelineMitigations}
                                            partyMembers={partyMembers}
                                            JOBS={JOBS}
                                            MITIGATIONS={MITIGATIONS}
                                            onSelect={handleShieldSelect}
                                        />
                                    )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};