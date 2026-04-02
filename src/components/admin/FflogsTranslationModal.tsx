/**
 * src/components/admin/FflogsTranslationModal.tsx
 *
 * FFLogsレポートURLから英語技名を取得し、テンプレートの日本語技名と
 * GUIDで突合して jaName→enName のマップを返すモーダル。
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { resolveFight, fetchFightEvents } from '../../api/fflogs';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface FflogsTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 突合結果: jaName → enName */
  onMatched: (matches: Map<string, string>) => void;
}

type Status =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; count: number }
  | { phase: 'no_match' }
  | { phase: 'error' };

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * FFLogs URLまたは裸のレポートコードからレポートコードを抽出する。
 * 例: https://www.fflogs.com/reports/XXXXXXXXXX#fight=1 → XXXXXXXXXX
 * @returns レポートコード文字列、または null（パース失敗時）
 */
function extractReportCode(input: string): string | null {
  const trimmed = input.trim();

  // URLパターン: /reports/XXXXXXXX
  const urlMatch = trimmed.match(/\/reports\/([A-Za-z0-9]{10,20})/);
  if (urlMatch) return urlMatch[1];

  // 裸のコード: 10〜20文字の英数字のみ
  const bareMatch = trimmed.match(/^[A-Za-z0-9]{10,20}$/);
  if (bareMatch) return trimmed;

  return null;
}

// ─────────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────────

export const FflogsTranslationModal: React.FC<FflogsTranslationModalProps> = ({
  isOpen,
  onClose,
  onMatched,
}) => {
  const { t } = useTranslation();
  useEscapeClose(isOpen, onClose);

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  const handleClose = () => {
    setUrl('');
    setStatus({ phase: 'idle' });
    onClose();
  };

  const handleFetch = async () => {
    const reportCode = extractReportCode(url);
    if (!reportCode) {
      setStatus({ phase: 'error' });
      return;
    }

    setStatus({ phase: 'loading' });

    try {
      // 最後のキルファイトを取得
      const fight = await resolveFight(reportCode, 'last');
      if (!fight) {
        setStatus({ phase: 'error' });
        return;
      }

      // 英語・日本語イベントを並行取得
      const [enEvents, jaEvents] = await Promise.all([
        fetchFightEvents(reportCode, fight, true),
        fetchFightEvents(reportCode, fight, false),
      ]);

      // guid → enName マップ（先着優先）
      const guidToEn = new Map<number, string>();
      for (const ev of enEvents) {
        if (ev.ability && !guidToEn.has(ev.ability.guid)) {
          guidToEn.set(ev.ability.guid, ev.ability.name);
        }
      }

      // guid → jaName マップ（先着優先）
      const guidToJa = new Map<number, string>();
      for (const ev of jaEvents) {
        if (ev.ability && !guidToJa.has(ev.ability.guid)) {
          guidToJa.set(ev.ability.guid, ev.ability.name);
        }
      }

      // jaName → enName 突合（jaName === enName は除外）
      const matches = new Map<string, string>();
      for (const [guid, jaName] of guidToJa) {
        const enName = guidToEn.get(guid);
        if (enName && enName !== jaName) {
          matches.set(jaName, enName);
        }
      }

      if (matches.size > 0) {
        onMatched(matches);
        setStatus({ phase: 'success', count: matches.size });
      } else {
        setStatus({ phase: 'no_match' });
      }
    } catch {
      setStatus({ phase: 'error' });
    }
  };

  if (!isOpen) return null;

  const isLoading = status.phase === 'loading';

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* バックドロップ */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

      {/* モーダル本体 */}
      <div className="relative glass-tier3 shadow-sm rounded-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 flex flex-col">

        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-app-border flex items-center justify-between shrink-0">
          <h2 className="text-app-2xl font-bold text-app-text">
            {t('admin.tpl_fflogs_title')}
          </h2>
          <button
            onClick={handleClose}
            className="px-3 py-1 text-app-lg text-app-text-muted border border-app-text/20 rounded hover:bg-app-text/5 transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 flex flex-col gap-4">

          {/* URLラベル */}
          <label className="flex flex-col gap-1.5">
            <span className="text-app-base text-app-text-muted">
              {t('admin.tpl_fflogs_url_label')}
            </span>

            {/* URL入力 + 取得ボタン */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={t('admin.tpl_fflogs_url_placeholder')}
                disabled={isLoading}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !isLoading && url.trim()) {
                    void handleFetch();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void handleFetch()}
                disabled={isLoading || !url.trim()}
                className="shrink-0 px-3 py-1.5 text-app-lg border rounded transition-colors cursor-pointer border-purple-500/40 text-purple-400 hover:bg-purple-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? '...' : t('admin.tpl_fflogs_fetch')}
              </button>
            </div>
          </label>

          {/* ステータスメッセージ */}
          {status.phase === 'error' && (
            <p className="text-app-lg text-red-400">
              {t('admin.tpl_fflogs_error')}
            </p>
          )}
          {status.phase === 'success' && (
            <p className="text-app-lg text-emerald-400">
              {t('admin.tpl_fflogs_matched', { count: status.count })}
            </p>
          )}
          {status.phase === 'no_match' && (
            <p className="text-app-lg text-amber-400">
              {t('admin.tpl_fflogs_no_match')}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
