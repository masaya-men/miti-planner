import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MultiSelectState } from '../../types/sidebarTypes';
import { HardDrive, Download } from 'lucide-react';
import { SystemNotificationBar } from '../SystemNotificationBar';
import { LocalDataSafetyBar } from '../LocalDataSafetyBar';
import './SidebarFooterBars.css';

interface SidebarFooterBarsProps {
    multiSelect: MultiSelectState;
    isOpen: boolean;
    setBackupExportOpen: (open: boolean) => void;
    setBackupRestoreOpen: (open: boolean) => void;
}

export const SidebarFooterBars: React.FC<SidebarFooterBarsProps> = ({ multiSelect, isOpen, setBackupExportOpen, setBackupRestoreOpen }) => {
    const { t } = useTranslation();
    return (
<>
                    {/* 運営からの通知 Bar (未読 0 で枠ごと消える) */}
                    {!multiSelect.isEnabled && (
                        <div className="shrink-0">
                            <SystemNotificationBar isCollapsed={!isOpen} />
                        </div>
                    )}

                    {/* ローカル保存のみユーザーへの安全性案内 (非ログイン且つ表あり時のみ) */}
                    {!multiSelect.isEnabled && (
                        <div className="shrink-0">
                            <LocalDataSafetyBar
                                isCollapsed={!isOpen}
                                onOpenBackup={() => setBackupExportOpen(true)}
                            />
                        </div>
                    )}

                    {/* バックアップ/復元ボタン
                        サイドバー最下部になるので、下に余白を取る。 */}
                    {!multiSelect.isEnabled && (
                        <div className={'shrink-0 px-3 pt-1 pb-3'}>
                            <div className="border-t border-glass-border w-full mb-1" />
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setBackupExportOpen(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <HardDrive size={11} />
                                    {isOpen ? t('backup.backup_button') : null}
                                </button>
                                <button
                                    onClick={() => setBackupRestoreOpen(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <Download size={11} />
                                    {isOpen ? t('backup.restore_button') : null}
                                </button>
                            </div>
                        </div>
                    )}
</>
    );
};
