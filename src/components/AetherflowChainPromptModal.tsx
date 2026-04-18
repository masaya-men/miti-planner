import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { useEscapeClose } from '../hooks/useEscapeClose';

/**
 * エーテルフローを手動で置いたときに出る確認ポップアップ。
 * 「リキャストごとに配置しますか？」 → はい → 60秒毎に最終イベントまで連鎖配置
 * 将来「以降表示しない」チェックボックスを追加できる拡張口を想定。
 */
export const AetherflowChainPromptModal: React.FC = () => {
    const { t } = useTranslation();
    const prompt = useMitigationStore(s => s.aetherflowChainPrompt);
    const confirmAetherflowChain = useMitigationStore(s => s.confirmAetherflowChain);
    const dismissAetherflowChainPrompt = useMitigationStore(s => s.dismissAetherflowChainPrompt);

    const isOpen = prompt !== null;
    useEscapeClose(isOpen, () => dismissAetherflowChainPrompt());

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
            onClick={() => dismissAetherflowChainPrompt()}
        >
            <div
                className="relative w-full max-w-[360px] glass-tier3 rounded-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-5 border-b border-glass-border/30 bg-glass-header/30">
                    <h2 className="text-app-xl font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                        <span className="w-1.5 h-4 bg-app-toggle rounded-full" />
                        {t('mitigation.aetherflow_chain_prompt_title', 'Aetherflow')}
                    </h2>
                </div>

                <div className="p-6">
                    <p className="text-app-md text-app-text text-center">
                        {t('mitigation.aetherflow_chain_prompt_message', 'Place on every recast?')}
                    </p>
                </div>

                <div className="p-4 bg-glass-card/10 border-t border-glass-border/20 flex gap-2">
                    <button
                        onClick={() => dismissAetherflowChainPrompt()}
                        className="flex-1 py-3 rounded-xl text-app-md font-black text-app-text border border-app-border hover:bg-app-surface2 transition-all cursor-pointer uppercase tracking-[0.2em] active:scale-95"
                    >
                        {t('mitigation.aetherflow_chain_prompt_no', 'No')}
                    </button>
                    <button
                        onClick={() => confirmAetherflowChain()}
                        className="flex-1 py-3 rounded-xl text-app-md font-black bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all cursor-pointer uppercase tracking-[0.2em] active:scale-95"
                    >
                        {t('mitigation.aetherflow_chain_prompt_yes', 'Yes')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
