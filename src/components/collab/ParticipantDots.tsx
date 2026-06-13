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
  // ①: 「N人」の根拠は確実な接続数(connectionCount)。名前付き roster はハイバネ復帰で一時的に
  //   揮発し得るので、不足分は無名ドットで埋めて「数字とドット数」を常に一致させる。
  //   collabProvider の自己修復(reannounce)で名前付き roster は数百ms で接続数まで回復する=
  //   無名ドットは収束までの一瞬の保険(未取得 null のときは roster 分のみ)。
  const connectionCount = useCollabPresenceStore((s) => s.connectionCount);

  // 表示名の材料(i18n)。OwnerCollabPanel / CollabViewerCluster と同じパターン。
  const adjectives = React.useMemo(() => t('collab.name_adjectives').split(','), [t]);
  const nouns = React.useMemo(() => t('collab.name_nouns').split(','), [t]);
  const sep = ['ja', 'zh'].includes(i18n.language) ? '' : ' ';

  const deficit = connectionCount != null ? Math.max(0, connectionCount - roster.length) : 0;

  return (
    <>
      {roster.map((m) => (
        // ドット名は LoPo 標準 Tooltip(アプリフォント)で表示。生 title 属性は使わない。
        <Tooltip
          key={m.clientId}
          content={m.isLocal ? t('collab.roster_you') : nameForClient(m.clientId, adjectives, nouns, sep)}
        >
          <span
            data-testid="participant-dot"
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
      {/* 不足分=presence がまだ揃っていない参加者。色/名前が確定するまで中立のドットで在席だけ示す。 */}
      {Array.from({ length: deficit }).map((_, i) => (
        <Tooltip key={`anon-${i}`} content={t('collab.connecting')}>
          <span
            data-testid="participant-dot"
            data-anon=""
            className="rounded-full shrink-0 inline-block bg-app-text-muted/40 border border-app-border"
            style={{ width: size, height: size }}
          />
        </Tooltip>
      ))}
    </>
  );
};
