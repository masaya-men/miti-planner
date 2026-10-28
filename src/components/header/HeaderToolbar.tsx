import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Activity } from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore, useEffectiveTimelineView } from '../../store/useThemeStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useCanPreviewWip } from '../../hooks/useCanPreviewWip';
import { SegmentButton } from '../ui/SegmentButton';
import { useProgressBarVisibility } from '../../store/useProgressBarVisibility';
import { ProgressTrackingHUD } from '../progress/ProgressTrackingHUD';
import { HeaderToolsMenu } from '../HeaderToolsMenu';
import { ImportMenu } from '../ImportMenu';
import { PartyToggleStrip } from '../PartyToggleStrip';
import { useIsMobile } from '../../hooks/useIsMobile';
import { iconBtnBase, iconBtnDefault, pillBtnBase, pillBtnDefault, pillBtnActive } from './headerButtonStyles';

interface HeaderToolbarProps {
    onAutoPlan: () => void;
    onImportLogs: () => void;
    partySortOrder: 'light_party' | 'role';
    setPartySortOrder: (order: 'light_party' | 'role') => void;
    statusOpen: boolean;
    setStatusOpen: (open: boolean) => void;
    readOnly: boolean;
}

// #2b: ネイティブ disabled ボタンはブラウザが cursor 指定を無視するため、禁止カーソルを
// wrapper(span)側で出す。span を hover ターゲットにし、中のボタンは pointer-events-none で透過。
const NotAllowed: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => (
    <span className={clsx('inline-flex', on && 'cursor-not-allowed')}>{children}</span>
);

/** 下段右グループの部品: 10px の小さいラベルをボタンの上・左寄せに置く(横幅を取らない) */
const HeaderLabeled: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col items-start gap-0.5 shrink-0">
        <span className="pl-1 text-app-base leading-[10px] font-black tracking-[0.1em] text-app-text-muted whitespace-nowrap uppercase">{label}</span>
        {children}
    </div>
);

/** Layer B（下段・表に近い）: ツールボタン群 */
export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
    onAutoPlan,
    onImportLogs,
    partySortOrder,
    setPartySortOrder,
    statusOpen,
    setStatusOpen,
    readOnly,
}) => {
    // 進捗HUD表示フラグ（B1ストア購読）
    const progressBarVisible = useProgressBarVisibility(s => s.visible);
    const { t } = useTranslation();

    const timelineEvents = useMitigationStore(state => state.timelineEvents);
    const needsImport = timelineEvents?.length === 0;

    const canPreviewWip = useCanPreviewWip();
    const isMobile = useIsMobile();
    // 点灯は実効値(チュートリアル中などは 'lanes')で。保存値のままだと実際の表と食い違う
    const timelineView = useEffectiveTimelineView();
    const setTimelineView = useThemeStore(s => s.setTimelineView);

    return (
        <div className="h-12 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-1.5">
                {/* Party Comp */}
                <NotAllowed on={readOnly}>
                    <button
                        data-tutorial="party-comp"
                        disabled={readOnly}
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('timeline:party-settings', { detail: { open: true } }));
                            useTutorialStore.getState().completeEvent('party:opened');
                        }}
                        className={clsx(pillBtnBase, pillBtnDefault, readOnly && 'opacity-50 pointer-events-none')}
                    >
                        <Users size={14} className="group-hover:scale-110 transition-transform duration-300 shrink-0" />
                        <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('party.comp_short')}</span>
                    </button>
                </NotAllowed>

                {/* Status */}
                <NotAllowed on={readOnly}>
                    <button
                        disabled={readOnly}
                        onClick={() => {
                            setStatusOpen(!statusOpen);
                            // (チュートリアルイベント削除済み)
                        }}
                        className={clsx(pillBtnBase, statusOpen ? pillBtnActive : pillBtnDefault, readOnly && 'opacity-50 pointer-events-none')}
                    >
                        <Activity size={14} className={clsx("transition-transform duration-300 shrink-0", statusOpen ? "" : "group-hover:scale-110")} />
                        <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('settings.config_short')}</span>
                    </button>
                </NotAllowed>

                {/* Import（汎用DLアイコン1つ・押すと FF Logs / スプレッドシート を選択） */}
                <ImportMenu
                    btnClassName={clsx(
                        iconBtnBase,
                        readOnly
                            ? `${iconBtnDefault} opacity-50 pointer-events-none`
                            : needsImport
                                ? "bg-app-toggle text-app-toggle-text border-app-toggle animate-pulse"
                                : iconBtnDefault
                    )}
                    onImportLogs={onImportLogs}
                    readOnly={readOnly}
                />

                {/* ⋯ その他: あまり使わない操作 (自動組み立て/MYジョブハイライト/進捗バー表示) を集約 */}
                <HeaderToolsMenu
                    btnClassName={clsx(iconBtnBase, iconBtnDefault)}
                    onAutoPlan={onAutoPlan}
                    readOnly={readOnly}
                />
            </div>

            {/* 中央: 進捗HUD（表示フラグON時のみ） */}
            {progressBarVisible && (
                <div className="flex-1 flex items-center justify-center min-w-0 px-3 overflow-visible">
                    <div className="w-full max-w-[640px]">
                        <ProgressTrackingHUD />
                    </div>
                </div>
            )}

            <div className="flex items-end gap-3">
                {/* 表示メンバー(ALL + 8 人): 見た目だけのローカル設定(共同編集の同期対象外・
                    閲覧専用ジョイナーが操作しても部屋のデータには影響しない)ので readOnly でも有効。
                    並びは「並び替え」に関係なくタンク | ヒーラー | DPS の固定順。 */}
                <HeaderLabeled label={t('ui.party_visibility_members')}>
                    <PartyToggleStrip />
                </HeaderLabeled>

                {/* 表の見た目(ふつう / スプシ): PC かつ WIP 公開可のときだけ。どこを押しても切り替わる */}
                {canPreviewWip && !isMobile && (
                    <HeaderLabeled label={t('ui.table_view')}>
                        <SegmentButton
                            className="h-8"
                            options={[
                                { value: 'lanes', label: t('ui.table_view_lanes') },
                                { value: 'sheet', label: t('ui.table_view_sheet') },
                            ]}
                            value={timelineView}
                            onChange={() => setTimelineView(timelineView === 'sheet' ? 'lanes' : 'sheet')}
                            size="sm"
                            pill
                        />
                    </HeaderLabeled>
                )}

                {/* 並び替え: どこを押しても切り替わる */}
                <HeaderLabeled label={t('ui.sort')}>
                    <SegmentButton
                        className="h-8"
                        options={[
                            { value: 'light_party', label: t('ui.sort_light_party') },
                            { value: 'role', label: t('ui.sort_role') },
                        ]}
                        value={partySortOrder}
                        onChange={() => setPartySortOrder(partySortOrder === 'role' ? 'light_party' : 'role')}
                        size="sm"
                        pill
                    />
                </HeaderLabeled>
            </div>
        </div>
    );
};
