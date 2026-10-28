/**
 * サーバー管理画面 — ハウジングエリア タブ
 */
import { useTranslation } from 'react-i18next';
import type { MasterServers } from '../../../types';
import { inputClass, labelClass, toCommaSeparated, fromCommaSeparated } from './serversFormHelpers';

interface ServersHousingTabProps {
  data: MasterServers;
  updateHousingAreaLocalized: (
    areaKey: string,
    field: 'name' | 'apartment_name',
    lang: 'ja' | 'en' | 'ko' | 'zh',
    value: string,
  ) => void;
  updateHousingAreaAliases: (areaKey: string, aliases: string[]) => void;
}

export function ServersHousingTab({ data, updateHousingAreaLocalized, updateHousingAreaAliases }: ServersHousingTabProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full min-h-0 border border-app-text/10 rounded flex flex-col">
      <div className="shrink-0 p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
        {t('admin.servers_housing')} ({Object.keys(data.housingAreas).length})
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {Object.entries(data.housingAreas).map(([areaKey, area]) => (
          <div
            key={areaKey}
            className="px-3 py-3 border-b border-app-text/5"
          >
            <div className="text-app-lg font-bold mb-2">{areaKey}</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
              {(['ja', 'en', 'ko', 'zh'] as const).map((lang) => (
                <div key={`name-${lang}`}>
                  <label className={labelClass}>name ({lang})</label>
                  <input
                    className={inputClass}
                    value={area.name[lang]}
                    onChange={(e) =>
                      updateHousingAreaLocalized(areaKey, 'name', lang, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
              {(['ja', 'en', 'ko', 'zh'] as const).map((lang) => (
                <div key={`apt-${lang}`}>
                  <label className={labelClass}>apartment_name ({lang})</label>
                  <input
                    className={inputClass}
                    value={area.apartment_name[lang]}
                    onChange={(e) =>
                      updateHousingAreaLocalized(areaKey, 'apartment_name', lang, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
            <div>
              <label className={labelClass}>{t('admin.servers_aliases')}</label>
              <input
                className={inputClass}
                value={toCommaSeparated(area.aliases)}
                onChange={(e) =>
                  updateHousingAreaAliases(areaKey, fromCommaSeparated(e.target.value))
                }
                placeholder="alias1, alias2"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
