import { useTranslation } from 'react-i18next';

/** タブ一覧(ラベルは i18n)。MilspecSidebar 側のタブバーと共有。 */
export function useMilspecTreeTabs(): { id: Tab; label: string }[] {
  const { t } = useTranslation();
  return [
    { id: 'savage', label: t('sidebar.tab_savage') },
    { id: 'ultimate', label: t('sidebar.tab_ultimate') },
    { id: 'other', label: t('sidebar.tab_other') },
    { id: 'archive', label: t('sidebar.tab_archive') },
  ];
}

/** プランのコンテンツ種別からタブを決める(標準 Sidebar と同じ)。 */
export function tabForPlanCategory(cat: string | null | undefined): Tab {
  if (cat === 'ultimate') return 'ultimate';
  if (cat === 'savage') return 'savage';
  if (cat) return 'other';
  return 'savage';
}

export type MilspecTreeTab = 'savage' | 'ultimate' | 'other' | 'archive';
type Tab = MilspecTreeTab;
