/**
 * 管理画面ダッシュボード
 * Phase 0: 管理画面が動作していることの確認用
 * Phase 1以降: 統計情報やクイックアクションを追加
 */
import { useTranslation } from 'react-i18next';

export function AdminDashboard() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">{t('admin.dashboard')}</h1>
      <p className="text-sm text-app-text-muted">
        {t('admin.dashboard_placeholder')}
      </p>
    </div>
  );
}
