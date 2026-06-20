/**
 * src/components/admin/FflogsTimelineImportModal.tsx
 *
 * FFLogs レポート URL からタイムライン（イベント＋フェーズ）を取得し、
 * テンプレートエディターへ「置き換え／追記」で取り込む管理画面モーダル。
 * 取得は共通の fetchAndMapFflogs を使う（ユーザー側 FFLogsImportModal と共用）。
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { parseFflogsUrl } from '../../lib/fflogs/parseFflogsUrl';
import { fetchAndMapFflogs } from '../../lib/fflogs/fetchAndMapFflogs';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';
import type { MapperResult } from '../../utils/fflogsMapper';

type ImportMode = 'replace_all' | 'append';

interface FflogsTimelineImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasEvents: boolean;
  onImport: (events: TimelineEvent[], phases: TemplateData['phases'], mode: ImportMode) => void;
}

type Status =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'preview'; fightName: string; durationSec: number; mapped: MapperResult }
  | { phase: 'error'; message: string };

export function FflogsTimelineImportModal({
  isOpen,
  onClose,
  hasEvents,
  onImport,
}: FflogsTimelineImportModalProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>({ phase: 'idle' });
  const [mode, setMode] = useState<ImportMode>('replace_all');

  useEscapeClose(isOpen, onClose);

  if (!isOpen) return null;

  const handleClose = () => {
    setUrl('');
    setStatus({ phase: 'idle' });
    setMode('replace_all');
    onClose();
  };

  const handleFetch = async () => {
    const parsed = parseFflogsUrl(url);
    if (!parsed) {
      setStatus({ phase: 'error', message: t('admin.tpl_fflogs_import_invalid_url') });
      return;
    }
    try {
      setStatus({ phase: 'loading' });
      const { fight, mapped } = await fetchAndMapFflogs(parsed.reportId, parsed.fightId);
      setStatus({
        phase: 'preview',
        fightName: fight.name,
        durationSec: Math.floor((fight.endTime - fight.startTime) / 1000),
        mapped,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ phase: 'error', message });
    }
  };

  const handleConfirm = () => {
    if (status.phase !== 'preview') return;
    onImport(status.mapped.events, status.mapped.phases, hasEvents ? mode : 'replace_all');
    handleClose();
  };

  const btnBase = 'px-3 py-1.5 text-app-lg rounded cursor-pointer transition-colors border';
  const btnBlue = `${btnBase} border-blue-500/40 text-blue-400 hover:bg-blue-500/10`;
  const btnMuted = `${btnBase} border-app-text/20 text-app-text-muted hover:bg-app-text/5`;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-app-2xl font-bold">{t('admin.tpl_fflogs_import_title')}</p>

        {/* URL 入力 */}
        <div>
          <label className="block text-app-base text-app-text-muted mb-1">
            {t('admin.tpl_fflogs_import_url_label')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setStatus({ phase: 'idle' }); }}
              placeholder={t('admin.tpl_fflogs_import_url_placeholder')}
              className="flex-1 px-2 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
            />
            <button
              onClick={handleFetch}
              disabled={status.phase === 'loading' || !url.trim()}
              className={`${btnBlue} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {status.phase === 'loading'
                ? t('admin.tpl_fflogs_import_fetching')
                : t('admin.tpl_fflogs_import_fetch')}
            </button>
          </div>
        </div>

        {/* 空テンプレ時の説明 */}
        {!hasEvents && (
          <p className="text-app-base text-app-text-muted">{t('admin.tpl_fflogs_import_empty_hint')}</p>
        )}

        {/* エラー */}
        {status.phase === 'error' && (
          <p className="text-app-lg text-red-400 whitespace-pre-wrap">{status.message}</p>
        )}

        {/* プレビュー */}
        {status.phase === 'preview' && (
          <div className="border border-app-text/10 rounded p-3 space-y-1 text-app-lg">
            <div className="flex gap-2">
              <span className="text-app-text-muted">{t('admin.tpl_fflogs_import_fight')}:</span>
              <span className="text-app-text truncate">{status.fightName}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-app-text-muted">
                {t('admin.tpl_fflogs_import_events')}:{' '}
                <span className="text-app-text">{status.mapped.events.length}</span>
              </span>
              <span className="text-app-text-muted">
                {t('admin.tpl_fflogs_import_duration')}:{' '}
                <span className="text-app-text">
                  {Math.floor(status.durationSec / 60)}m {status.durationSec % 60}s
                </span>
              </span>
            </div>
            {status.mapped.stats.isEnglishOnly && (
              <p className="text-app-base text-amber-400">{t('admin.tpl_fflogs_import_english_only')}</p>
            )}

            {/* モード選択（既存タイムラインがある時のみ） */}
            {hasEvents && (
              <div className="pt-2 space-y-1">
                <span className="text-app-base text-app-text-muted">{t('admin.tpl_fflogs_import_mode_label')}</span>
                {(['replace_all', 'append'] as ImportMode[]).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer text-app-lg">
                    <input
                      type="radio"
                      name="fflogs-tpl-import-mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="accent-app-text"
                    />
                    <span>{t(`admin.tpl_fflogs_import_mode_${m}`)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ボタン行 */}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={handleClose} className={btnMuted}>{t('admin.cancel')}</button>
          {status.phase === 'preview' && (
            <button onClick={handleConfirm} className={btnBlue}>
              {t('admin.tpl_fflogs_import_confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
