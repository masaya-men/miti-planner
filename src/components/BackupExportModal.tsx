import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Copy, Download, Share2, Loader, CheckSquare, Square } from 'lucide-react';
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
                  className="w-full h-28 bg-app-bg border border-app-border rounded-lg p-3 text-[16px] md:text-app-xs text-app-text-muted font-mono resize-none focus:outline-none"
                />
              )}
            </>
          )}
        </div>

        {/* フッター */}
        {!syncing && ready && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-app-border">
            <button
              onClick={handleCopy}
              disabled={selectedCount === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-app-toggle text-app-toggle-text text-app-sm font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy size={14} />
              {t('backup.copy_button')}
            </button>
            {iosShare ? (
              <button
                onClick={handleShare}
                disabled={selectedCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Share2 size={14} />
                {t('backup.share_button')}
              </button>
            ) : (
              <button
                onClick={handleDownload}
                disabled={selectedCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                {t('backup.download_button')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
