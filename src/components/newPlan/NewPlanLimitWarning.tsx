import React from 'react';
import { useTranslation } from 'react-i18next';
import { PLAN_LIMITS } from '../../types/firebase';
import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface NewPlanLimitWarningProps {
    isBlocked: boolean;
    isArchiveWarning: boolean;
    isTotalLimitReached: boolean;
    isContentLimitReached: boolean;
}

/** 新規作成モーダルの件数制限の警告。 */
export const NewPlanLimitWarning: React.FC<NewPlanLimitWarningProps> = ({ isBlocked, isArchiveWarning, isTotalLimitReached, isContentLimitReached }) => {
    const { t } = useTranslation();
    return (<>
                    {/* 件数制限の警告 */}
                    {(isBlocked || isArchiveWarning) && (
                        <div className="px-6 pb-2">
                            <div className={clsx(
                                "flex items-start gap-2 p-3 rounded-xl text-app-md border",
                                isBlocked
                                    ? "bg-app-red-dim border-app-red-border text-app-red"
                                    : "bg-app-amber-dim border-app-amber-border text-app-amber"
                            )}>
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <div>
                                    {isTotalLimitReached && (
                                        <p>{t('new_plan.plan_limit_total', { max: PLAN_LIMITS.MAX_TOTAL_PLANS })}</p>
                                    )}
                                    {isContentLimitReached && !isTotalLimitReached && (
                                        <p>{t('new_plan.plan_limit_per_content', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT })}</p>
                                    )}
                                    {isArchiveWarning && !isBlocked && (
                                        <p>{t('new_plan.plan_archive_warning', { threshold: PLAN_LIMITS.ARCHIVE_WARNING_THRESHOLD })}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
    </>);
};
