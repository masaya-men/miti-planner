// Task4: 共同編集中クラスタ — ジョイナーヘッダー用。
// 参加者ドット(ホバー名) + PresenceControls + 抜けるボタン。
// usePlanStore / 永続化 import は一切行わない。
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { nameForClient } from '../../lib/collab/presence';
import { PresenceControls } from './PresenceControls';

export const CollabViewerCluster: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const roster = useCollabPresenceStore((s) => s.roster);

  // 表示名の材料(i18n)。OwnerCollabPanel と同じパターン。
  const adjectives = React.useMemo(() => t('collab.name_adjectives').split(','), [t]);
  const nouns = React.useMemo(() => t('collab.name_nouns').split(','), [t]);
  const sep = ['ja', 'zh'].includes(i18n.language) ? '' : ' ';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 共同編集中ラベル + 参加者ドット */}
      <div className="glass-tier2 flex items-center gap-2 px-3 py-1.5 rounded-full border border-app-border">
        <span className="text-app-xs font-bold text-app-text whitespace-nowrap">
          {roster.length > 0
            ? t('collab.chip_active_count', { count: roster.length })
            : t('collab.chip_active')}
        </span>

        {/* 参加者ドット */}
        {roster.map((m) => (
          <span
            key={m.clientId}
            className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
            style={{
              backgroundColor: m.color,
              boxShadow: `0 0 6px ${m.color}`,
            }}
            title={m.isLocal ? t('collab.roster_you') : nameForClient(m.clientId, adjectives, nouns, sep)}
          />
        ))}
      </div>

      {/* カーソル + ジョブ操作 */}
      <PresenceControls />

      {/* 共同編集を抜けるボタン */}
      <button
        onClick={() => navigate('/')}
        className="px-3 py-1.5 rounded-full text-app-xs font-bold border border-app-border bg-app-surface2/60 text-app-text cursor-pointer active:scale-95 transition-all duration-200 whitespace-nowrap hover:bg-app-toggle hover:text-app-toggle-text"
      >
        {t('collab.leave')}
      </button>
    </div>
  );
};
