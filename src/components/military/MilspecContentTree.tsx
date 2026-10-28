import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../../store/usePlanStore';
import { useThemeStore } from '../../store/useThemeStore';
import { getAllUltimates } from '../../data/contentRegistry';
import { getPhaseName } from '../../types';
import { NewPlanModal } from '../NewPlanModal';
import '../../i18n';
import type { MilspecTreeTab } from './milspecContentTreeModel';
import { MilspecContentGroup } from './tree/MilspecContentGroup';
import { SavageTree } from './tree/MilspecSavageTree';
import { OtherTree } from './tree/MilspecOtherTree';
import { ArchiveList } from './tree/MilspecArchiveList';
import type { MilspecTreeSelect } from './tree/milspecTreeTypes';
import './MilspecContentTree.css';

type Tab = MilspecTreeTab;

/**
 * サイドバー中央 = コンテンツツリー(MIL-SPEC v11 見本の .tree)。
 * 外枠の data-ms-tree は fx の energy() が「ツリー内の行か」を見分けて幹線から光を流すための目印。
 *
 * データを触る処理(プラン選択の保存→解凍→切替、作成、削除)は標準の実績コードと同じ手順:
 *  - 選択: 標準 Sidebar.tsx / ContentTreeItem と同じ「保存→再圧縮判定→await 解凍→書き戻し→切替」
 *  - 作成: NewPlanModal(共同編集切断・clearAllMitigations・commitNewPlan の安全な順序を持つ)
 *  - 削除: usePlanStore.deleteFromFirestore / deletePlan
 */
export const MilspecContentTree: React.FC<{ tab: Tab; select?: MilspecTreeSelect }> = ({ tab, select }) => {
  const contentLanguage = useThemeStore((s) => s.contentLanguage);
  const { plans, currentPlanId } = usePlanStore(
    useShallow((s) => ({ plans: s.plans, currentPlanId: s.currentPlanId })),
  );
  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;
  const currentContentId = currentPlan?.contentId ?? null;

  const [newPlanContentId, setNewPlanContentId] = React.useState<string | null | undefined>(undefined);
  const openNewPlan = (contentId?: string | null) => setNewPlanContentId(contentId ?? null);

  // CONTENT パネルの NEW ボタン(MilspecSidebar)からの合図でコンテンツ未指定の新規作成モーダルを開く。
  React.useEffect(() => {
    const h = () => setNewPlanContentId(null);
    window.addEventListener('milspec:new-plan', h);
    return () => window.removeEventListener('milspec:new-plan', h);
  }, []);

  return (
    <div className="milspec-tr" data-ms-tree>
      {tab === 'savage' && <SavageTree lang={contentLanguage} currentContentId={currentContentId} onAdd={openNewPlan} select={select} />}
      {tab === 'ultimate' && getAllUltimates().map((c, i) => (
        <MilspecContentGroup
          key={c.id}
          content={c}
          index={i}
          displayName={getPhaseName(c.name, contentLanguage)}
          currentContentId={currentContentId}
          onAdd={openNewPlan}
          select={select}
        />
      ))}
      {tab === 'other' && <OtherTree lang={contentLanguage} currentContentId={currentContentId} onAdd={openNewPlan} select={select} />}
      {tab === 'archive' && <ArchiveList select={select} />}

      <NewPlanModal
        isOpen={newPlanContentId !== undefined}
        initialContentId={newPlanContentId ?? null}
        onClose={() => setNewPlanContentId(undefined)}
      />
    </div>
  );
};
