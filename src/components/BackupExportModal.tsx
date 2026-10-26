import React, { useState, useEffect, useMemo } from 'react';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton, INPUT_CLASS } from './ui/ModalParts';
import { useTranslation } from 'react-i18next';
import { Copy, Download, Loader, CheckSquare, Square } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { createBackupJson, downloadBackupFile, shareBackupFile } from '../utils/backupService';
import { isIOS } from '../utils/isIOS';
import type { SavedPlan } from '../types';
import { showToast } from './Toast';

/** これを超える JSON はプレビュー textarea に全文描画しない（スマホ固まり防止）。 */
const LARGE_BACKUP_CHARS = 100_000;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupExportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isOpen) {
      setPlans([]);
      setSelectedIds(new Set());
      setReady(false);
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

      // 3. プラン一覧を取得し、既定で全選択
      const allPlans = usePlanStore.getState().plans;
      setPlans(allPlans);
      setSelectedIds(new Set(allPlans.map((p) => p.id)));
      setReady(true);
    };

    run();
  }, [isOpen, user]);

  // 選択されたプランだけをバックアップ JSON 化
  const json = useMemo(
    () => createBackupJson(plans.filter((p) => selectedIds.has(p.id))),
    [plans, selectedIds]
  );
  const selectedCount = selectedIds.size;
  const allSelected = plans.length > 0 && selectedCount === plans.length;

  if (!isOpen) return null;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(plans.map((p) => p.id)));
  };

  const handleCopy = async () => {
    if (selectedCount === 0) return;
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
    if (selectedCount === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadBackupFile(json, `lopo-backup-${date}.json`);
    showToast(t('backup.download_success'));
  };

  const handleShare = async () => {
    if (selectedCount === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const filename = `lopo-backup-${date}.json`;
    const result = await shareBackupFile(json, filename);
    if (result === 'shared') { showToast(t('backup.share_success')); return; }
    if (result === 'cancelled') return;
    // 非対応 / 失敗 → ダウンロードにフォールバック
    downloadBackupFile(json, filename);
    showToast(t('backup.download_success'));
  };

  const iosShare = isIOS();
  const isLarge = json.length > LARGE_BACKUP_CHARS;

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      className="w-[90vw] max-w-[520px] max-h-[80vh]"
    >
      <ModalHeader title={t('backup.export_title')} onClose={onClose} closeLabel={t('common.close')} />

      {/* 本文 */}
      <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
        <p className="text-app-sm text-app-text-muted">
          {t('backup.export_description')}
        </p>

        {syncing || !ready ? (
          <div className="flex items-center gap-2 py-8 justify-center text-app-text-muted">
            <Loader size={16} className="animate-spin" />
            <span className="text-app-sm">{t('backup.export_syncing')}</span>
          </div>
        ) : (
          <>
            {/* 選択ヘッダー: 件数 + 全選択/全解除 */}
            <div className="flex items-center justify-between">
              <span className="text-app-sm text-app-text-muted font-medium">
                {t('backup.export_plan_count', { count: selectedCount })}
              </span>
              {plans.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-app-xs text-app-text-muted hover:text-app-text transition-colors cursor-pointer underline"
                >
                  {allSelected ? t('backup.deselect_all') : t('backup.select_all')}
                </button>
              )}
            </div>

            {/* プラン チェックリスト */}
            {plans.length > 0 && (
              <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto border border-app-border rounded-lg p-2">
                {plans.map((plan) => {
                  const checked = selectedIds.has(plan.id);
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => toggleOne(plan.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-glass-hover transition-colors cursor-pointer text-left"
                    >
                      {checked ? (
                        <CheckSquare size={16} className="shrink-0 text-app-text" aria-hidden="true" />
                      ) : (
                        <Square size={16} className="shrink-0 text-app-text-muted" aria-hidden="true" />
                      )}
                      <span className="text-app-sm text-app-text truncate">{plan.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {isLarge ? (
              <p className="text-app-xs text-app-text-muted px-1 py-2">
                {t('backup.export_large_notice')}
              </p>
            ) : (
              <textarea
                data-backup-json
                readOnly
                value={json}
                className={`${INPUT_CLASS} h-28 font-mono resize-none`}
              />
            )}
          </>
        )}
      </div>

      {/* フッター */}
      {!syncing && ready && (
        <ModalFooter className="flex-wrap">
          {/* iOS: 共有シートが開くため「ファイルに保存」を選ぶよう注意（黄色＝警告） */}
          {iosShare && (
            <p className="w-full text-app-xs text-app-amber font-bold text-center">
              {t('backup.ios_save_hint')}
            </p>
          )}
          <ModalButton
            variant="secondary"
            onClick={iosShare ? handleShare : handleDownload}
            disabled={selectedCount === 0}
          >
            <Download size={14} />
            {t('backup.download_button')}
          </ModalButton>
          <ModalButton variant="primary" onClick={handleCopy} disabled={selectedCount === 0}>
            <Copy size={14} />
            {t('backup.copy_button')}
          </ModalButton>
        </ModalFooter>
      )}
    </ModalShell>
  );
};
