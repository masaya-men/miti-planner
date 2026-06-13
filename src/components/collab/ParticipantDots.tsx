// 共同編集の参加者ドット(色つき・ホバーで自動生成名)。
// ジョイナーの CollabViewerCluster とオーナーの共有チップ(ShareButtons)で共用。
// usePlanStore / 永続化 import は一切行わない(presence store のみ)。
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { nameForClient } from '../../lib/collab/presence';
import { Tooltip } from '../ui/Tooltip';

/** size = ドット直径(px)。チップは小さめ(8)、ヘッダークラスタは標準(10)。 */
export const ParticipantDots: React.FC<{ size?: number }> = ({ size = 10 }) => {
  const { t, i18n } = useTranslation();
  const roster = useCollabPresenceStore((s) => s.roster);

  // 表示名の材料(i18n)。OwnerCollabPanel / CollabViewerCluster と同じパターン。
  const adjectives = React.useMemo(() => t('collab.name_adjectives').split(','), [t]);
  const nouns = React.useMemo(() => t('collab.name_nouns').split(','), [t]);
  const sep = ['ja', 'zh'].includes(i18n.language) ? '' : ' ';

  return (
    <>
      {roster.map((m) => (
        // ドット名は LoPo 標準 Tooltip(アプリフォント)で表示。生 title 属性は使わない。
        <Tooltip
          key={m.clientId}
          content={m.isLocal ? t('collab.roster_you') : nameForClient(m.clientId, adjectives, nouns, sep)}
        >
          <span
            className="rounded-full shrink-0 inline-block"
            style={{
              width: size,
              height: size,
              backgroundColor: m.color,
              boxShadow: `0 0 6px ${m.color}`,
            }}
          />
        </Tooltip>
      ))}
    </>
  );
};
