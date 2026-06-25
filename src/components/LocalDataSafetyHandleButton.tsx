import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { useLocalSafetySeenStore } from '../store/useLocalSafetySeenStore';
import { LocalDataSafetyModal } from './LocalDataSafetyModal';

interface Props {
  /** 説明モーダルから既存バックアップ書き出しモーダルを開く */
  onOpenBackup: () => void;
}

/**
 * サイドバー折りたたみ時、ハンドル領域に出すローカルデータ安全性アイコン。
 * - 通知ベル (SystemNotificationHandleButton) と同じく「要確認の赤バッジがある時のみ」表示。
 *   = 非ログイン且つ表1件以上 且つ 未読 (一度も説明を開いていない)。一度開けば消える。
 * - クリックでサイドバーを開かずに説明モーダルを直接開く。
 * - 親 (ハンドル div) が relative なので absolute で重ねる。通知ベル (bottom-[78px]) の
 *   少し下に置いて重ならないようにする。トグル (z-50) より上に出すため z-[60] +
 *   stopPropagation でトグル誤作動を防ぐ。
 */
export const LocalDataSafetyHandleButton: React.FC<Props> = ({ onOpenBackup }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const planCount = usePlanStore((s) => s.plans.length);
  const seen = useLocalSafetySeenStore((s) => s.seen);
  const markSeen = useLocalSafetySeenStore((s) => s.markSeen);
  const [open, setOpen] = useState(false);

  // 要確認 (赤バッジ) があるときのみ = 非ログイン且つ表あり且つ未読
  if (user || planCount === 0 || seen) return null;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation(); // ハンドルの開閉トグルを誤発火させない
    setOpen(true);
    markSeen();
  };

  const handleBackup = () => {
    setOpen(false);
    onOpenBackup();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('local_safety.bar.aria')}
        className="absolute bottom-[48px] left-0 right-0 mx-auto z-[60] flex items-center justify-center w-6 h-6 text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
      >
        <span className="relative flex">
          <ShieldAlert size={14} aria-hidden="true" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-app-bg" aria-hidden="true" />
        </span>
      </button>
      <LocalDataSafetyModal isOpen={open} onClose={() => setOpen(false)} onOpenBackup={handleBackup} />
    </>
  );
};
