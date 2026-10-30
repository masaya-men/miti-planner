import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Mitigation } from '../../types';
import { getPhaseName } from '../../types';
import { validateMitigationPlacement } from '../../utils/resourceTracker';

type PlacementStatus = ReturnType<typeof validateMitigationPlacement>;

interface MitigationSkillButtonProps {
    mitigation: Mitigation;
    status: PlacementStatus;
    contentLanguage: string;
    isClickable: boolean;
    isAlreadyPlaced: boolean;
    isSelectedTargetMit: boolean;
    isSelectedShieldMit: boolean;
    isBlurred: boolean;
    selectedCopyShieldMit: Mitigation | null;
    onClick: () => void;
}

// スキル一覧の 1 行(アイコン・名前・状態メッセージ)。
export const MitigationSkillButton: React.FC<MitigationSkillButtonProps> = ({
    mitigation, status, contentLanguage, isClickable, isAlreadyPlaced,
    isSelectedTargetMit, isSelectedShieldMit, isBlurred, selectedCopyShieldMit, onClick,
}) => {
    const { t } = useTranslation();
    return (
                                    <button
                                        id={`miti-btn-${mitigation.id}`}
                                        {...(mitigation.name.en === 'Reprisal' ? { 'data-tutorial': 'tutorial-skill-reprisal' } : {})}
                                        onClick={onClick}
                                        disabled={!isClickable}
                                        className={clsx(
                                            "w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-300 text-left group border text-app-text",
                                            isBlurred ? "opacity-30 blur-[2px] grayscale" : "",
                                            (isSelectedTargetMit || isSelectedShieldMit) ? "z-10 shadow-md bg-app-surface2 border-app-border" :
                                            isAlreadyPlaced
                                                ? ("bg-app-red-dim border-app-red-border hover:bg-app-red-border")
                                                : !status.available
                                                    ? ("border-app-red-border bg-app-red-dim opacity-50 dark:opacity-70")
                                                    : status.warning
                                                        ? ("hover:bg-app-amber-dim border-app-amber-border")
                                                        : ("hover:bg-app-surface2 border-transparent hover:border-app-border"),
                                            isClickable ? "cursor-pointer" : "cursor-not-allowed"
                                        )}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img referrerPolicy="no-referrer"
                                                src={mitigation.icon}
                                                alt={getPhaseName(mitigation.name, contentLanguage)}
                                                className={clsx(
                                                    "w-8 h-8 object-contain rounded border transition-opacity",
                                                    !status.available
                                                        ? ("bg-app-red-dim border-app-red-border")
                                                        : status.warning
                                                            ? ("bg-app-amber-dim border-app-amber-border")
                                                            : ("bg-app-surface2 border-app-border")
                                                )}
                                            />
                                            {status.badge && (
                                                <span className={`absolute -top-1.5 -right-1.5 text-app-xs font-black leading-none px-1 py-0.5 rounded-full shadow-lg ring-1 ${status.badgeColor === 'red'
                                                    ? 'bg-app-red text-red-100 ring-red-400/50'
                                                    : status.badgeColor === 'amber'
                                                        ? 'bg-app-amber text-amber-100 ring-amber-400/50'
                                                        : 'bg-cyan-600/90 text-cyan-100 ring-cyan-400/50'
                                                    }`}>
                                                    {status.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className={`text-app-lg font-black transition-colors truncate ${!status.available
                                                ? 'text-app-red'
                                                : status.warning
                                                    ? 'text-app-amber'
                                                    : 'text-app-text'
                                                }`}>
                                                {getPhaseName(mitigation.name, contentLanguage)}
                                                {isAlreadyPlaced && <span className="ml-2 text-app-xs bg-app-red text-white px-1 rounded uppercase tracking-tighter shrink-0">{t('mitigation.remove')}</span>}
                                                {mitigation.scope === 'target' && !isAlreadyPlaced && (
                                                    <span className="ml-2 text-app-base text-app-text-sec transition-transform group-hover:translate-x-0.5 inline-block shrink-0">
                                                        {isSelectedTargetMit ? '▼' : '▶'}
                                                    </span>
                                                )}
                                                {mitigation.copiesShield && !isAlreadyPlaced && (
                                                    <span className="ml-2 text-app-base text-app-text-sec transition-transform group-hover:translate-x-0.5 inline-block shrink-0">
                                                        {selectedCopyShieldMit?.id === mitigation.id ? '▼' : '▶'}
                                                    </span>
                                                )}
                                            </div>
                                            {!status.available ? (
                                                <div className="text-app-base text-app-red font-bold">
                                                    {status.message}
                                                </div>
                                            ) : status.warning ? (
                                                <div className="text-app-base text-app-amber font-bold">
                                                    ⚠ {status.message}
                                                </div>
                                            ) : status.recastInfo ? (
                                                // チャージ技で配置可だが回復中: 次チャージまでの秒数を中立色で併記
                                                // (使用可能なので赤/警告にはしない)
                                                <div className="text-app-base text-app-text-sec font-bold">
                                                    {status.recastInfo}
                                                </div>
                                            ) : null}
                                        </div>
                                    </button>
    );
};
