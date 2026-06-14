// Task4: 共同編集中クラスタ — ジョイナーヘッダー用。
// 参加者ドット(ホバー名) + PresenceControls + 抜けるボタン。
// usePlanStore / 永続化 import は一切行わない。
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { ParticipantDots } from './ParticipantDots';
import { PresenceControls } from './PresenceControls';

export const CollabViewerCluster: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // #3d: 「N人」は確実な接続数(connectionCount)優先・未取得は roster.length にフォールバック。
  const liveCount = useCollabPresenceStore((s) => s.connectionCount ?? s.roster.length);

  return (
    // #2c: flex-wrap を外し 1 行固定(折り返しでヘッダーが縦に伸び縦スクロールが出るのを防ぐ)。
    <div className="flex items-center gap-2">
      {/* 共同編集中ラベル + 参加者ドット */}
      <div className="glass-tier2 flex items-center gap-2 px-3 py-1.5 rounded-full border border-app-border">
        <span className="text-app-xs font-bold text-app-text whitespace-nowrap">
          {liveCount > 0
            ? t('collab.chip_active_count', { count: liveCount })
            : t('collab.chip_active')}
        </span>

        {/* 参加者ドット(共有コンポーネント) */}
        <ParticipantDots size={10} />
      </div>

      {/* カーソル + ジョブ操作(ヘッダー用コンパクト 1 行版)。
          スマホはマウスカーソルが無く共有しても無意味なので隠す(md: 以上で表示)。
          md:contents でラップは透過し PC のレイアウトは現状と完全一致。 */}
      <div className="hidden md:contents">
        <PresenceControls compact />
      </div>

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
