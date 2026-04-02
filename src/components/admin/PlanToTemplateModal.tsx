/**
 * PlanToTemplateModal
 *
 * 共有URLからプランデータを取得し、テンプレートに変換するモーダル。
 * AdminTemplates / TemplateEditorToolbar などから呼び出す。
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { apiFetch } from '../../lib/apiClient';
import { convertPlanToTemplate } from '../../utils/templateConversions';
import type { TimelineEvent, Phase } from '../../types';
import type { TemplateData } from '../../data/templateLoader';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface PlanToTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  hasExistingTemplate: boolean;
  onImport: (events: TimelineEvent[], phases: TemplateData['phases']) => void;
}

// ─────────────────────────────────────────────
// プレビューデータの型
// ─────────────────────────────────────────────

interface PlanPreview {
  title: string;
  eventCount: number;
  phaseCount: number;
  timelineEvents: TimelineEvent[];
  phases: Phase[];
}

// ─────────────────────────────────────────────
// ヘルパー: 共有URLからIDを抽出
// ─────────────────────────────────────────────

/**
 * 共有URLまたは裸のIDから共有IDを返す。
 * URL例: https://lopoly.app/share/AbCdEfGh → AbCdEfGh
 * 裸のID例: AbCdEfGh（英数字 6〜20文字）
 */
function extractShareId(input: string): string | null {
  const trimmed = input.trim();

  // URL形式: /share/ の後ろを取得
  const urlMatch = trimmed.match(/\/share\/([A-Za-z0-9]{6,20})/);
  if (urlMatch) return urlMatch[1];

  // 裸のID（英数字のみ、6〜20文字）
  const bareMatch = trimmed.match(/^[A-Za-z0-9]{6,20}$/);
  if (bareMatch) return trimmed;

  return null;
}

// ─────────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────────

export function PlanToTemplateModal({
  isOpen,
  onClose,
  contentId,
  hasExistingTemplate,
  onImport,
}: PlanToTemplateModalProps) {
  const { t } = useTranslation();

  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PlanPreview | null>(null);

  useEscapeClose(isOpen, onClose);

  if (!isOpen) return null;

  // ─── プレビュー取得 ───────────────────────

  const handlePreview = async () => {
    setError('');
    setPreview(null);

    const shareId = extractShareId(urlInput);
    if (!shareId) {
      setError(t('admin.tpl_promote_error'));
      return;
    }

    try {
      setFetching(true);
      const res = await apiFetch(
        `/api/admin?resource=templates&subtype=plan&planId=${shareId}`,
      );
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      const timelineEvents: TimelineEvent[] = data.timelineEvents ?? [];
      const phases: Phase[] = data.phases ?? [];
      const title: string = data.title ?? shareId;

      setPreview({
        title,
        eventCount: timelineEvents.length,
        phaseCount: phases.length,
        timelineEvents,
        phases,
      });
    } catch {
      setError(t('admin.tpl_promote_error'));
    } finally {
      setFetching(false);
    }
  };

  // ─── 確定（テンプレート化） ───────────────

  const handleConfirm = () => {
    if (!preview) return;

    if (hasExistingTemplate) {
      const ok = window.confirm(t('admin.tpl_promote_replace_confirm'));
      if (!ok) return;
    }

    const result = convertPlanToTemplate(
      { timelineEvents: preview.timelineEvents, phases: preview.phases },
      contentId,
    );
    onImport(result.timelineEvents, result.phases);
    onClose();
  };

  // ─── レンダリング ─────────────────────────

  const btnBase = 'px-3 py-1.5 text-app-lg rounded cursor-pointer transition-colors border';
  const btnBlue = `${btnBase} border-blue-500/40 text-blue-400 hover:bg-blue-500/10`;
  const btnMuted = `${btnBase} border-app-text/20 text-app-text-muted hover:bg-app-text/5`;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* タイトル */}
        <p className="text-app-2xl font-bold">{t('admin.tpl_promote_title')}</p>

        {/* URL入力 */}
        <div>
          <label className="block text-app-base text-app-text-muted mb-1">
            {t('admin.tpl_promote_url_label')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setError('');
                setPreview(null);
              }}
              placeholder={t('admin.tpl_promote_url_placeholder')}
              className="flex-1 px-2 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
            />
            <button
              onClick={handlePreview}
              disabled={fetching || !urlInput.trim()}
              className={`${btnBlue} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {fetching
                ? t('admin.tpl_promote_fetching')
                : t('admin.tpl_promote_preview')}
            </button>
          </div>
        </div>

        {/* エラー */}
        {error && <p className="text-app-lg text-red-400">{error}</p>}

        {/* プレビュー */}
        {preview && (
          <div className="border border-app-text/10 rounded p-3 space-y-1 text-app-lg">
            <div className="flex gap-2">
              <span className="text-app-text-muted">{t('admin.tpl_promote_plan_name')}:</span>
              <span className="text-app-text truncate">{preview.title}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-app-text-muted">
                {t('admin.tpl_promote_events')}:{' '}
                <span className="text-app-text">{preview.eventCount}</span>
              </span>
              <span className="text-app-text-muted">
                {t('admin.tpl_promote_phases')}:{' '}
                <span className="text-app-text">{preview.phaseCount}</span>
              </span>
            </div>
          </div>
        )}

        {/* ボタン行 */}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={btnMuted}>
            {t('admin.cancel')}
          </button>
          {preview && (
            <button
              onClick={handleConfirm}
              className={btnBlue}
            >
              {t('admin.tpl_promote_confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
