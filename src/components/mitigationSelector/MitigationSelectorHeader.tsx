import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Mitigation } from '../../types';
import { CloseButton } from '../ui/ModalParts';

interface MitigationSelectorHeaderProps {
    selectedCopyShieldMit: Mitigation | null;
    selectedSingleTargetMit: Mitigation | null;
    setSelectedCopyShieldMit: (m: Mitigation | null) => void;
    setSelectedSingleTargetMit: (m: Mitigation | null) => void;
    handleClose: () => void;
}

// 窓の見出し行(今の段階の題名・戻るボタン・閉じるボタン)。
export const MitigationSelectorHeader: React.FC<MitigationSelectorHeaderProps> = ({
    selectedCopyShieldMit, selectedSingleTargetMit, setSelectedCopyShieldMit, setSelectedSingleTargetMit, handleClose,
}) => {
    const { t } = useTranslation();
    return (
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
    );
};
