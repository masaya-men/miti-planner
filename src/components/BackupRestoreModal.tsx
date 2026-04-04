import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Upload, FileUp, Loader, AlertTriangle } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { parseBackupJson, mergePlans } from '../utils/backupService';
import { showToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmStage = 'input' | 'confirm1' | 'confirm2' | 'restoring';

export const BackupRestoreModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [stage, setStage] = useState<ConfirmStage>('input');
  const [backupCount, setBackupCount] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const currentCount = usePlanStore((s) => s.plans.length);

  const handleClose = () => {
    setText('');
    setStage('input');
    setError('');
    setBackupCount(0);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
      setError('');
    };
    reader.readAsText(file);
    // input をリセットして同じファイルを再選択可能にする
    e.target.value = '';
  };

  const handleStartRestore = () => {
    setError('');
    const backup = parseBackupJson(text);
    if (!backup) {
      setError(t('backup.restore_invalid_json'));
      return;
    }
    setBackupCount(backup.planCount);
    setStage('confirm1');
  };

  const handleExecuteRestore = async () => {
    setStage('restoring');
    try {
      const backup = parseBackupJson(text)!;
      const planStore = usePlanStore.getState();
      const ownerId = user?.uid ?? 'local';
      const displayName = user?.displayName || 'Guest';

      // マージ実行
      const merged = mergePlans(planStore.plans, backup.plans, ownerId, displayName);

      // Zustand store更新
      planStore.setPlans(merged);

      // 全プランをdirtyにマーク（Firestoreに確実に反映させるため）
      for (const plan of backup.plans) {
        planStore.markDirty(plan.id);
      }

      // 現在開いているプランがバックアップで上書きされた場合、再読み込み
      if (planStore.currentPlanId) {
        const updatedPlan = merged.find((p) => p.id === planStore.currentPlanId);
        if (updatedPlan?.data) {
          useMitigationStore.getState().loadSnapshot(updatedPlan.data);
        }
      }

      // ログイン中は即時Firestore同期
      if (user) {
        await planStore.forceSyncAll(user.uid, user.displayName || 'Guest');
      }

      showToast(t('backup.restore_success', { count: backup.planCount }));
      handleClose();
    } catch (err) {
      console.error('復元エラー:', err);
      setError(String(err));
      setStage('input');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[90vw] max-w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-app-lg font-bold text-app-text">
            {t('backup.restore_title')}
          </h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* ステージ: input */}
        {stage === 'input' && (
          <div className="px-5 py-4 flex flex-col gap-3">
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_description')}
            </p>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(''); }}
              placeholder={t('backup.restore_paste_placeholder')}
              className="w-full h-40 bg-app-bg border border-app-border rounded-lg p-3 text-app-xs text-app-text font-mono resize-none focus:outline-none focus:border-app-text-muted transition-colors"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
            >
              <FileUp size={14} />
              {t('backup.restore_file_select')}
            </button>
            {error && (
              <p className="text-app-sm text-red-500">{error}</p>
            )}
          </div>
        )}

        {/* ステージ: confirm1 */}
        {stage === 'confirm1' && (
          <div className="px-5 py-6 flex flex-col gap-4 items-center text-center">
            <AlertTriangle size={32} className="text-yellow-500" />
            <h3 className="text-app-md font-bold text-app-text">
              {t('backup.restore_confirm_1_title')}
            </h3>
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_confirm_1_message')}
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => setStage('confirm2')}
                className="flex-1 py-2 rounded-lg bg-yellow-500 text-black text-app-sm font-bold hover:bg-yellow-400 transition-colors cursor-pointer"
              >
                {t('backup.restore_confirm_1_continue')}
              </button>
            </div>
          </div>
        )}

        {/* ステージ: confirm2 */}
        {stage === 'confirm2' && (
          <div className="px-5 py-6 flex flex-col gap-4 items-center text-center">
            <AlertTriangle size={32} className="text-red-500" />
            <h3 className="text-app-md font-bold text-app-text">
              {t('backup.restore_confirm_2_title')}
            </h3>
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_confirm_2_message', {
                currentCount,
                backupCount,
              })}
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer"
              >
                {t('backup.restore_confirm_2_cancel')}
              </button>
              <button
                onClick={handleExecuteRestore}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-app-sm font-bold hover:bg-red-400 transition-colors cursor-pointer"
              >
                {t('backup.restore_confirm_2_execute')}
              </button>
            </div>
          </div>
        )}

        {/* ステージ: restoring */}
        {stage === 'restoring' && (
          <div className="px-5 py-8 flex flex-col items-center gap-3">
            <Loader size={24} className="animate-spin text-app-text-muted" />
            <p className="text-app-sm text-app-text-muted">
              {t('backup.restore_syncing')}
            </p>
          </div>
        )}

        {/* フッター: inputステージのみ復元ボタン表示 */}
        {stage === 'input' && (
          <div className="px-5 py-4 border-t border-app-border">
            <button
              onClick={handleStartRestore}
              disabled={!text.trim()}
              className={
                text.trim()
                  ? "w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-app-text text-app-bg text-app-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
                  : "w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-app-text/20 text-app-text-muted text-app-sm font-bold cursor-not-allowed"
              }
            >
              <Upload size={14} />
              {t('backup.restore_button_label')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
