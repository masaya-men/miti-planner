import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';

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

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={() => dismiss()}
            layer="top"
            className="w-full max-w-[320px]"
        >
            <ModalHeader
                title={t('mitigation.astrologian_draw_chain_prompt_title', 'Draw')}
                onClose={() => dismiss()}
                closeLabel={t('common.close')}
            />

            <div className="p-5">
                <p className="text-app-md text-app-text text-center">
                    {t('mitigation.astrologian_draw_chain_prompt_message', 'Place alternating draws on every recast?')}
                </p>
            </div>

            <ModalFooter>
                <ModalButton variant="primary" onClick={() => confirm()}>
                    {t('mitigation.astrologian_draw_chain_prompt_yes', 'OK')}
                </ModalButton>
            </ModalFooter>
        </ModalShell>
    );
};
