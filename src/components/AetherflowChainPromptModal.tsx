import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';

/**
 * エーテルフローを手動で置いたときに出る確認ポップアップ。
 * 「リキャストごとに配置しますか？」 → OK で 60秒毎に最終イベントまで連鎖配置。
 * 閉じる手段は× / Esc / 背景クリック。
 */
export const AetherflowChainPromptModal: React.FC = () => {
    const { t } = useTranslation();
    const prompt = useMitigationStore(s => s.aetherflowChainPrompt);
    const confirmAetherflowChain = useMitigationStore(s => s.confirmAetherflowChain);
    const dismissAetherflowChainPrompt = useMitigationStore(s => s.dismissAetherflowChainPrompt);

    const isOpen = prompt !== null;

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={() => dismissAetherflowChainPrompt()}
            layer="top"
            className="w-full max-w-[320px]"
        >
            <ModalHeader
                title={t('mitigation.aetherflow_chain_prompt_title', 'Aetherflow')}
                onClose={() => dismissAetherflowChainPrompt()}
                closeLabel={t('common.close')}
            />

            <div className="p-5">
                <p className="text-app-md text-app-text text-center">
                    {t('mitigation.aetherflow_chain_prompt_message', 'Place on every recast?')}
                </p>
            </div>

            <ModalFooter>
                <ModalButton variant="primary" onClick={() => confirmAetherflowChain()}>
                    {t('mitigation.aetherflow_chain_prompt_yes', 'OK')}
                </ModalButton>
            </ModalFooter>
        </ModalShell>
    );
};
