import { useTranslation } from 'react-i18next';

export interface MilspecRailProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/** サイドバーと本体の間の細い縦の列(レール)。サイドバー開閉の取っ手を持つ。
 *  サイドバーを畳んでも(列幅 0)この取っ手は残るので、必ず開き直せる。 */
export function MilspecRail({ isSidebarOpen, onToggleSidebar }: MilspecRailProps) {
  const { t } = useTranslation();
  const label = t(isSidebarOpen ? 'sidebar.close_menu' : 'sidebar.open_menu');
  return (
    <div className="milspec-rail">
      <button
        type="button"
        className="milspec-rail-handle"
        title={label}
        aria-label={label}
        aria-expanded={isSidebarOpen}
        onClick={onToggleSidebar}
      >
        {isSidebarOpen ? '‹' : '›'}
      </button>
    </div>
  );
}
