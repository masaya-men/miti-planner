import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Copy, Download, Loader } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { createBackupJson, downloadBackupFile } from '../utils/backupService';
import { showToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupExportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [json, setJson] = useState('');
  const [syncing, setSyncing] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isOpen) {
      setJson('');
      return;
    }

    const run = async () => {
      const planStore = usePlanStore.getState();

      // 1. 編集中のプランをフラッシュ
      if (planStore.currentPlanId) {
        planStore.updatePlan(planStore.currentPlanId, {
          data: useMitigationStore.getState().getSnapshot(),
        });
        planStore.markDirty(planStore.currentPlanId);
      }

      // 2. ログイン中ならPUSH→PULLで全デバイスのデータを最新化
      if (user) {
        setSyncing(true);
        try {
          const profileName = useAuthStore.getState().profileDisplayName || 'User';
          await planStore.manualSync(user.uid, profileName);
        } catch (err) {
          console.error('バックアップ前の同期エラー:', err);
        }
        setSyncing(false);
      }

      // 3. JSON生成
      const plans = usePlanStore.getState().plans;
      setJson(createBackupJson(plans));
    };

    run();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const planCount = json ? JSON.parse(json).planCount : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      showToast(t('backup.copy_success'));
    } catch {
      // fallback: テキストエリアを選択
      const textarea = document.querySelector<HTMLTextAreaElement>('[data-backup-json]');
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        showToast(t('backup.copy_success'));
      }
    }
  };

  const handleDownload = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadBackupFile(json, `lopo-backup-${date}.json`);
    showToast(t('backup.download_success'));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[90vw] max-w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-app-lg font-bold text-app-text">
            {t('backup.export_title')}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <p className="text-app-sm text-app-text-muted">
            {t('backup.export_description')}
          </p>

          {syncing ? (
            <div className="flex items-center gap-2 py-8 justify-center text-app-text-muted">
              <Loader size={16} className="animate-spin" />
              <span className="text-app-sm">{t('backup.export_syncing')}</span>
            </div>
          ) : (
            <>
              <div className="text-app-sm text-app-text-muted font-medium">
                {t('backup.export_plan_count', { count: planCount })}
              </div>
              <textarea
                data-backup-json
                readOnly
                value={json}
                className="w-full h-40 bg-app-bg border border-app-border rounded-lg p-3 text-[16px] md:text-app-xs text-app-text-muted font-mono resize-none focus:outline-none"
              />
            </>
          )}
        </div>

        {/* フッター */}
        {!syncing && json && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-app-border">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-app-toggle text-app-toggle-text text-app-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Copy size={14} />
              {t('backup.copy_button')}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
            >
              <Download size={14} />
              {t('backup.download_button')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
