import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { MobileBottomNav } from '../MobileBottomNav';
import { MobileBottomSheet } from '../MobileBottomSheet';
import { MobileShareController } from '../collab/MobileShareController';
import { LoginModal } from '../LoginModal';
import { RenderPendingIndicator } from '../RenderPendingIndicator';
import { MobileFAB } from '../MobileFab';
import { MobileAccountMenu } from '../party/MobileAccountMenu';
import { AetherflowChainPromptModal } from '../AetherflowChainPromptModal';
import { AstrologianDrawChainPromptModal } from '../AstrologianDrawChainPromptModal';
import { LocalImportDialog } from '../LocalImportDialog';
import { ShareImportSheet } from '../ShareImportSheet';
import { LimitResolutionSheet } from '../LimitResolutionSheet';
import { LocalDataSafetyAutoPrompt } from '../LocalDataSafetyAutoPrompt';
import { MilspecTunePanel } from '../dev/MilspecTunePanel';
import type { MobileSheets } from './useMobileSheets';
import type { LocalImportProps } from './useLoginMigration';

const PipView = React.lazy(() => import('../PipView'));

interface LayoutOverlaysProps {
    isMobile: boolean;
    isTutorialActive: boolean;
    theme: string;
    onToggleTheme: () => void;
    sheets: MobileSheets;
    localImport: LocalImportProps;
}

/** 標準シェルの上に重なる窓・シート・スマホの操作部品(並び順は重なり順に影響するので変えない) */
export const LayoutOverlays: React.FC<LayoutOverlaysProps> = ({ isMobile, isTutorialActive, theme, onToggleTheme, sheets, localImport }) => {
    const { t } = useTranslation();
    const hideEmptyRows = useMitigationStore(s => s.hideEmptyRows);
    const {
        mobileLoginModalOpen, setMobileLoginModalOpen,
        mobileAccountOpen, setMobileAccountOpen,
        mobileShareOpen, setMobileShareOpen,
        mobileCueSheet, setMobileCueSheet,
        navHandlers,
    } = sheets;
    return (
        <>
            {/* エーテルフロー連鎖配置プロンプト（SCH が手動で aetherflow を置いたとき） */}
            <AetherflowChainPromptModal />

            {/* 占星ドロー交互配置プロンプト（AST が手動で astral_draw / umbral_draw を置いたとき） */}
            <AstrologianDrawChainPromptModal />

            {/* Mobile FAB — テーマ/同期/言語/ナビ（チュートリアル中は非表示） */}
            {!isTutorialActive && isMobile && (
                <MobileFAB
                    onToggleTheme={onToggleTheme}
                    theme={theme}
                    onPhaseJump={() => window.dispatchEvent(new Event('mobile:phase-jump'))}
                    onLabelJump={() => window.dispatchEvent(new Event('mobile:label-jump'))}
                    onMechanicSearch={() => window.dispatchEvent(new Event('mobile:mechanic-search'))}
                    onToggleExpand={() => {
                        const store = useMitigationStore.getState();
                        store.setHideEmptyRows(!store.hideEmptyRows);
                    }}
                    hideEmptyRows={hideEmptyRows}
                />
            )}

            {/* Mobile Bottom Nav — 排他制御付きトグル（チュートリアル中は非表示） */}
            {!isTutorialActive && <MobileBottomNav {...navHandlers} />}

            {/* Mobile: ログインモーダル（未ログイン時） */}
            <LoginModal isOpen={mobileLoginModalOpen} onClose={() => setMobileLoginModalOpen(false)} />

            {/* 重い再描画中インジケーター(表示メンバー絞り込みトグル用・2026-08-19) */}
            <RenderPendingIndicator />

            {/* Mobile: アカウントシート（ログイン済み時） */}
            <MobileBottomSheet
                isOpen={mobileAccountOpen}
                onClose={() => setMobileAccountOpen(false)}
                title={t('nav.account')}
                height="auto"
                swipeArea="handle"
            >
                <MobileAccountMenu onClose={() => setMobileAccountOpen(false)} />
            </MobileBottomSheet>

            {/* Mobile: 共有タブ = PC と同じ共有フローを起動(コピー/共同編集2択・オーナーパネル)。
                 専用シートは作らず既存モーダルを開く。カーソル共有UIはスマホでは隠す。 */}
            <MobileShareController
                isOpen={mobileShareOpen}
                onClose={() => setMobileShareOpen(false)}
            />

            {/* スマホ用カンペビュー（フルスクリーン） */}
            {mobileCueSheet && (
                <div className="fixed inset-0 z-[9999] bg-app-bg md:hidden">
                    <React.Suspense fallback={null}>
                        <PipView mode="fullscreen" onClose={() => setMobileCueSheet(false)} />
                    </React.Suspense>
                </div>
            )}

            {/* B-1 Revision 3: ローカル取り込みダイアログ */}
            <LocalImportDialog
                isOpen={localImport.isOpen}
                plans={localImport.plans}
                onImport={localImport.onImport}
                onClose={localImport.onClose}
            />

            {/* Phase B-1.5 Task 17: 共有 URL 自動取り込みシート。
                useShareImportFlow.status !== 'idle' のときだけ自前で描画する self-rendering 設計。
                /share/:shareId 経由で SharePage が start() を叩くと自動的に表示される。 */}
            <ShareImportSheet />
            <LocalDataSafetyAutoPrompt />
            {/* 上限解消シートはグローバル単一マウント（共有取込・スプシ取込の両方が setLimitContext で呼ぶ） */}
            <LimitResolutionSheet />
            <MilspecTunePanel />
        </>
    );
};
