/**
 * サーバー管理画面 — サイズ タブ
 */
import { useTranslation } from 'react-i18next';
import type { MasterServers } from '../../../types';
import { inputClass, labelClass, toCommaSeparated, fromCommaSeparated } from './serversFormHelpers';

interface ServersSizesTabProps {
  data: MasterServers;
  updateHousingSize: (index: number, field: 'label' | 'aliases', value: string | string[]) => void;
}

export function ServersSizesTab({ data, updateHousingSize }: ServersSizesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full min-h-0 border border-app-text/10 rounded flex flex-col">
      <div className="shrink-0 p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
        {t('admin.servers_sizes')} ({data.housingSizes.length})
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {data.housingSizes.map((size, index) => (
          <div
            key={size.id}
            className="px-3 py-3 border-b border-app-text/5"
          >
            <div className="text-app-lg font-bold mb-2 font-mono text-app-text-muted">
              {size.id}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>label</label>
                <input
                  className={inputClass}
                  value={size.label}
                  onChange={(e) =>
                    updateHousingSize(index, 'label', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>{t('admin.servers_aliases')}</label>
                <input
                  className={inputClass}
                  value={toCommaSeparated(size.aliases)}
                  onChange={(e) =>
                    updateHousingSize(
                      index,
                      'aliases',
                      fromCommaSeparated(e.target.value),
                    )
                  }
                  placeholder="alias1, alias2"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
