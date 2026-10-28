/**
 * サーバー管理画面 — DC タブ(DC 一覧とサーバーのエイリアス編集)
 */
import { useTranslation } from 'react-i18next';
import type { MasterServers } from '../../../types';
import { inputClass, labelClass, toCommaSeparated, fromCommaSeparated } from './serversFormHelpers';

interface ServersDcTabProps {
  data: MasterServers;
  selectedDc: string | null;
  setSelectedDc: (dcKey: string) => void;
  expandedServer: string | null;
  setExpandedServer: (serverKey: string | null) => void;
  updateDcAliases: (dcKey: string, aliases: string[]) => void;
  updateServerAliases: (dcKey: string, serverKey: string, aliases: string[]) => void;
}

export function ServersDcTab({ data, selectedDc, setSelectedDc, expandedServer, setExpandedServer, updateDcAliases, updateServerAliases }: ServersDcTabProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full min-h-0 flex gap-4">
      {/* 左パネル: DC一覧 */}
      <div className="w-48 shrink-0 border border-app-text/10 rounded flex flex-col min-h-0">
        <div className="shrink-0 p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
          {t('admin.servers_dc')}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {Object.entries(data.datacenters).map(([dcKey, dc]) => {
            const count = Object.keys(dc.servers).length;
            return (
              <button
                key={dcKey}
                onClick={() => {
                  setSelectedDc(dcKey);
                  setExpandedServer(null);
                }}
                className={`w-full text-left px-3 py-2 text-app-lg border-b border-app-text/5 transition-colors ${
                  selectedDc === dcKey
                    ? 'bg-app-text/10 font-bold'
                    : 'hover:bg-app-text/5'
                }`}
              >
                <span>{dcKey}</span>
                <span className="ml-1 text-app-text-muted">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 右パネル: 選択DCのサーバー一覧 */}
      <div className="flex-1 min-h-0 border border-app-text/10 rounded flex flex-col">
        <div className="shrink-0 p-2 border-b border-app-text/10 text-app-base text-app-text-muted font-bold">
          {selectedDc
            ? `${selectedDc} (${Object.keys(data.datacenters[selectedDc]?.servers ?? {}).length})`
            : 'DCを選択してください'}
        </div>

        {selectedDc && data.datacenters[selectedDc] && (
          <>
            {/* DCエイリアス */}
            <div className="shrink-0 px-3 py-2 border-b border-app-text/10">
              <label className={labelClass}>
                DC {t('admin.servers_aliases')}
              </label>
              <input
                className={inputClass}
                value={toCommaSeparated(data.datacenters[selectedDc].aliases)}
                onChange={(e) =>
                  updateDcAliases(selectedDc, fromCommaSeparated(e.target.value))
                }
                placeholder="alias1, alias2"
              />
            </div>

            {/* サーバーリスト */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {Object.entries(data.datacenters[selectedDc].servers).length === 0 && (
                <p className="p-4 text-app-lg text-app-text-muted">
                  {t('admin.no_data')}
                </p>
              )}
              {Object.entries(data.datacenters[selectedDc].servers).map(
                ([serverKey, aliases]) => (
                  <div key={serverKey} className="border-b border-app-text/5">
                    <button
                      onClick={() =>
                        setExpandedServer(
                          expandedServer === serverKey ? null : serverKey,
                        )
                      }
                      className="w-full text-left px-3 py-2 text-app-lg hover:bg-app-text/5 transition-colors flex items-center gap-3"
                    >
                      <span className="flex-1">{serverKey}</span>
                      <span className="text-app-text-muted text-app-base">
                        {t('admin.servers_aliases')}: {aliases.length}
                      </span>
                      <span className="text-app-text-muted text-app-base">
                        {expandedServer === serverKey ? '▲' : '▼'}
                      </span>
                    </button>

                    {expandedServer === serverKey && (
                      <div className="px-3 pb-3 pt-1 bg-app-text/5">
                        <label className={labelClass}>
                          {t('admin.servers_aliases')}
                        </label>
                        <input
                          className={inputClass}
                          value={toCommaSeparated(aliases)}
                          onChange={(e) =>
                            updateServerAliases(
                              selectedDc,
                              serverKey,
                              fromCommaSeparated(e.target.value),
                            )
                          }
                          placeholder="alias1, alias2"
                        />
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
