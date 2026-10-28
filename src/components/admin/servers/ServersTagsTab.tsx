/**
 * サーバー管理画面 — タグ タブ
 */
import { useTranslation } from 'react-i18next';
import type { MasterServers } from '../../../types';
import { inputClass, labelClass, toCommaSeparated, fromCommaSeparated } from './serversFormHelpers';

interface ServersTagsTabProps {
  data: MasterServers;
  updateTags: (category: string, tags: string[]) => void;
}

export function ServersTagsTab({ data, updateTags }: ServersTagsTabProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full min-h-0 border border-app-text/10 rounded flex flex-col">
      <div className="shrink-0 p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
        {t('admin.servers_tags')} ({Object.keys(data.tags).length})
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {Object.entries(data.tags).map(([category, tagList]) => (
          <div
            key={category}
            className="px-3 py-3 border-b border-app-text/5"
          >
            <div className="text-app-lg font-bold mb-2">{category}</div>
            <div>
              <label className={labelClass}>{t('admin.servers_tags')}</label>
              <input
                className={inputClass}
                value={toCommaSeparated(tagList)}
                onChange={(e) =>
                  updateTags(category, fromCommaSeparated(e.target.value))
                }
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
