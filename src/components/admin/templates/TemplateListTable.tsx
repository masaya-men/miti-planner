/**
 * 管理画面テンプレート — 登録済みテンプレート一覧テーブル
 */
import { useTranslation } from 'react-i18next';
import type { TemplateItem } from './adminTemplateTypes';

interface TemplateListTableProps {
  templates: TemplateItem[];
  selectedContentId: string;
  onSelect: (contentId: string) => void;
  onToggleLock: (item: TemplateItem) => void;
  onDelete: (item: TemplateItem) => void;
}

export function TemplateListTable({ templates, selectedContentId, onSelect, onToggleLock, onDelete }: TemplateListTableProps) {
  const { t } = useTranslation();

  return (
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-app-lg">
            <thead>
              <tr className="border-b border-app-text/10 text-left text-app-text-muted">
                <th className="pb-2 pr-4">{t('admin.contents_id')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_source')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_events')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_phases')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_locked')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_last_updated')}</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((item) => (
                <tr
                  key={item.contentId}
                  onClick={() => onSelect(item.contentId)}
                  className={`border-b border-app-text/5 hover:bg-app-text/5 transition-colors cursor-pointer ${
                    item.contentId === selectedContentId ? 'bg-blue-500/[0.06]' : ''
                  }`}
                >
                  <td className="py-2 pr-4 font-mono">{item.contentId}</td>
                  <td className="py-2 pr-4">{item.source}</td>
                  <td className="py-2 pr-4">{item.eventCount}</td>
                  <td className="py-2 pr-4">{item.phaseCount}</td>
                  <td className="py-2 pr-4">
                    <span className="text-app-text-muted">
                      {item.lockedAt
                        ? t('admin.template_locked')
                        : t('admin.template_discovery')}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-app-text-muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2 text-right flex items-center gap-2 justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleLock(item); }}
                      className="text-app-text-muted hover:text-app-text transition-colors"
                    >
                      {item.lockedAt ? t('admin.template_unlock') : t('admin.template_lock')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                      className="text-app-text-muted hover:text-app-text transition-colors"
                    >
                      {t('admin.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
  );
}
