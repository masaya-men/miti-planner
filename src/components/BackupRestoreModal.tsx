import React, { useState, useRef } from 'react';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton, INPUT_CLASS } from './ui/ModalParts';
import { useTranslation } from 'react-i18next';
import { Upload, FileUp, Loader, AlertTriangle } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { parseBackupJson, mergeBackupPlans } from '../utils/backupService';
import { showToast } from './toastBus';

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
      const displayName = useAuthStore.getState().profileDisplayName || 'User';

      // マージ実行
      const merged = mergeBackupPlans(planStore.plans, backup.plans, ownerId, displayName);

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
          // 根治(I-2): 現在プランを再ロード → 持ち主IDも明示
          useMitigationStore.getState().loadSnapshot(updatedPlan.data, planStore.currentPlanId);
        }
      }

      // ログイン中は即時Firestore同期
      if (user) {
        await planStore.forceSyncAll(user.uid, useAuthStore.getState().profileDisplayName || 'User');
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

  return (
    <ModalShell
      isOpen
      onClose={handleClose}
      locked={stage === 'restoring'}
      className="w-[90vw] max-w-[520px] max-h-[80vh]"
    >
      <ModalHeader title={t('backup.restore_title')} onClose={handleClose} closeLabel={t('common.close')} closeDisabled={stage === 'restoring'} />

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
            className={`${INPUT_CLASS} h-40 font-mono resize-none`}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <ModalButton variant="secondary" onClick={() => fileRef.current?.click()}>
            <FileUp size={14} />
            {t('backup.restore_file_select')}
          </ModalButton>
          {error && (
            <p className="text-app-sm text-app-red">{error}</p>
          )}
        </div>
      )}

      {/* ステージ: confirm1 */}
      {stage === 'confirm1' && (
        <>
        <div className="px-5 py-6 flex flex-col gap-4 items-center text-center">
          <AlertTriangle size={32} className="text-app-amber" />
          <h3 className="text-app-md font-bold text-app-text">
            {t('backup.restore_confirm_1_title')}
          </h3>
          <p className="text-app-sm text-app-text-muted">
            {t('backup.restore_confirm_1_message')}
          </p>
        </div>
        <ModalFooter>
          <ModalButton variant="secondary" onClick={handleClose}>{t('common.cancel')}</ModalButton>
          <ModalButton variant="warning" onClick={() => setStage('confirm2')}>{t('backup.restore_confirm_1_continue')}</ModalButton>
        </ModalFooter>
        </>
      )}

      {/* ステージ: confirm2 */}
      {stage === 'confirm2' && (
        <>
        <div className="px-5 py-6 flex flex-col gap-4 items-center text-center">
          <AlertTriangle size={32} className="text-app-red" />
          <h3 className="text-app-md font-bold text-app-text">
            {t('backup.restore_confirm_2_title')}
          </h3>
          <p className="text-app-sm text-app-text-muted">
            {t('backup.restore_confirm_2_message', {
              currentCount,
              backupCount,
            })}
          </p>
        </div>
        <ModalFooter>
          <ModalButton variant="secondary" onClick={handleClose}>{t('backup.restore_confirm_2_cancel')}</ModalButton>
          <ModalButton variant="danger" onClick={handleExecuteRestore}>{t('backup.restore_confirm_2_execute')}</ModalButton>
        </ModalFooter>
        </>
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
        <ModalFooter>
          <ModalButton variant="primary" onClick={handleStartRestore} disabled={!text.trim()}>
            <Upload size={14} />
            {t('backup.restore_button_label')}
          </ModalButton>
        </ModalFooter>
      )}
    </ModalShell>
  );
};
