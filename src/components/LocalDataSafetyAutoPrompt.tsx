import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { useLocalSafetySeenStore } from '../store/useLocalSafetySeenStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { isIOS } from '../utils/isIOS';
import { shouldAutoPromptLocalSafety } from '../utils/localSafetyAutoPrompt';
import { LocalDataSafetyModal } from './LocalDataSafetyModal';
import { BackupExportModal } from './BackupExportModal';

/**
 * iOS 非ログインユーザーへローカルデータ安全性の警告を確実に届けるための
 * 常時マウント型プロンプト。サイドバー/メニューに依存せず Layout 最上位で動く。
 * 条件成立で1回だけモーダルを自動表示し、即 markSeen() で再表示を止める。
 */
export const LocalDataSafetyAutoPrompt: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const planCount = usePlanStore((s) => s.plans.length);
  const seen = useLocalSafetySeenStore((s) => s.seen);
  const markSeen = useLocalSafetySeenStore((s) => s.markSeen);
  const tutorialActive = useTutorialStore((s) => s.isActive);
  const [modalOpen, setModalOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  useEffect(() => {
    if (
      shouldAutoPromptLocalSafety({
        isIOS: isIOS(),
        isLoggedIn: user !== null,
        planCount,
        seen,
        tutorialActive,
      })
    ) {
      setModalOpen(true);
      markSeen();
    }
  }, [user, planCount, seen, tutorialActive, markSeen]);

  return (
    <>
      <LocalDataSafetyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpenBackup={() => {
          setModalOpen(false);
          setBackupOpen(true);
        }}
      />
      <BackupExportModal isOpen={backupOpen} onClose={() => setBackupOpen(false)} />
    </>
  );
};
