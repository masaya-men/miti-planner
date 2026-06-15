// スマホ: ボトムナビ「共有」タブの中身。
// 専用 UI は作らず、PC と同じ共有フロー(useShareFlow)を起動して既存モーダルを開く。
// hideCursor=true でオーナーパネルのカーソル共有UIだけ省く(マウス前提のため)。
import React from 'react';
import { useShareFlow } from './useShareFlow';
import { usePlanStore } from '../../store/usePlanStore';
import { useThemeStore } from '../../store/useThemeStore';
import { getCurrentContentLabel } from '../../lib/getContentLabel';

interface MobileShareControllerProps {
  /** ナビ「共有」タブが押されたら true。 */
  isOpen: boolean;
  /** フロー(全モーダル)が閉じきったら呼ぶ(ナビの点灯解除)。 */
  onClose: () => void;
}

export const MobileShareController: React.FC<MobileShareControllerProps> = ({ isOpen, onClose }) => {
  const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
  const contentLanguage = useThemeStore(s => s.contentLanguage);
  const contentLabel = getCurrentContentLabel(currentPlan, contentLanguage);
  const { view, openShareUI, modals } = useShareFlow({ contentLabel, currentPlan, hideCursor: true });

  // この開く周期で openShareUI を呼んだか。
  const startedRef = React.useRef(false);
  // この周期で view が一度でも非 none になったか(= モーダルが出た)。
  const sawViewRef = React.useRef(false);

  // isOpen の立ち上がりエッジでのみ起動(多重起動防止)。閉じたらリセット。
  React.useEffect(() => {
    if (isOpen && !startedRef.current) {
      startedRef.current = true;
      sawViewRef.current = false;
      openShareUI();
    }
    if (!isOpen) {
      startedRef.current = false;
      sawViewRef.current = false;
    }
  }, [isOpen, openShareUI]);

  // 一度モーダルが開いた後に view が none へ戻ったら、親へ閉じたことを通知。
  // (openShareUI 直後はまだ none のままなので「開いた実績」を見てから閉じる)
  React.useEffect(() => {
    if (!isOpen || !startedRef.current) return;
    if (view !== 'none') { sawViewRef.current = true; return; }
    if (sawViewRef.current) onClose();
  }, [isOpen, view, onClose]);

  return <>{modals}</>;
};
