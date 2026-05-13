import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useMitigationStore } from '../store/useMitigationStore';
import { useEscapeClose } from '../hooks/useEscapeClose';

/**
 * 占星ドロー (Astral/Umbral) を手動で置いたときに出る確認ポップアップ。
 * 「以降 60 秒毎に交互配置しますか?」 → OK で最終イベントまで連鎖配置。
 * 閉じる手段は× / Esc / 背景クリック。
 */
export const AstrologianDrawChainPromptModal: React.FC = () => {
    const { t } = useTranslation();
    const prompt = useMitigationStore(s => s.astrologianDrawChainPrompt);
    const confirm = useMitigationStore(s => s.confirmAstrologianDrawChain);
    const dismiss = useMitigationStore(s => s.dismissAstrologianDrawChainPrompt);

    const isOpen = prompt !== null;
    useEscapeClose(isOpen, () => dismiss());

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
            onClick={() => dismiss()}
        >
            <div
                className="relative w-full max-w-[320px] glass-tier3 rounded-2xl overflow-hidden"
                style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                    <h2 className="text-app-lg font-bold text-app-text tracking-wider flex items-center gap-2 uppercase">
                        <span className="w-1 h-3.5 bg-app-toggle rounded-full" />
                        {t('mitigation.astrologian_draw_chain_prompt_title', 'Draw')}
                    </h2>
                    <button
                        onClick={() => dismiss()}
                        className="p-1.5 rounded-full text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5">
                    <p className="text-app-md text-app-text text-center">
                        {t('mitigation.astrologian_draw_chain_prompt_message', 'Place alternating draws on every recast?')}
                    </p>
                </div>

                <div className="p-4 bg-glass-card/10 border-t border-glass-border/20">
                    <button
                        onClick={() => confirm()}
                        className="w-full py-2.5 rounded-xl text-app-md font-bold bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all cursor-pointer uppercase tracking-wider active:scale-95"
                    >
                        {t('mitigation.astrologian_draw_chain_prompt_yes', 'OK')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
