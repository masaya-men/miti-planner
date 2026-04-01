/**
 * テンプレートエディター ツールバー
 * プランからの昇格、CSV読み込み、FFLogs翻訳、未翻訳フィルターなどの操作ボタン群
 */
import { useTranslation } from 'react-i18next';

interface TemplateEditorToolbarProps {
  untranslatedCount: number;
  showUntranslatedOnly: boolean;
  onToggleUntranslatedOnly: () => void;
  onOpenPromote: () => void;
  onOpenCsvImport: () => void;
  onOpenFflogsTranslation: () => void;
  hasEvents: boolean;
  autoPropagate: boolean;
  onToggleAutoPropagate: () => void;
}

const baseButtonClass =
  'text-xs px-3 py-1.5 rounded border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export function TemplateEditorToolbar({
  untranslatedCount,
  showUntranslatedOnly,
  onToggleUntranslatedOnly,
  onOpenPromote,
  onOpenCsvImport,
  onOpenFflogsTranslation,
  hasEvents,
  autoPropagate,
  onToggleAutoPropagate,
}: TemplateEditorToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 左側: 操作ボタン群 */}
      <button
        type="button"
        onClick={onOpenPromote}
        className={`${baseButtonClass} border-blue-500/40 text-blue-400 hover:bg-blue-500/10`}
      >
        {t('admin.tpl_promote_btn')}
      </button>

      <button
        type="button"
        onClick={onOpenCsvImport}
        className={`${baseButtonClass} border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10`}
      >
        {t('admin.tpl_csv_btn')}
      </button>

      <button
        type="button"
        onClick={onOpenFflogsTranslation}
        disabled={!hasEvents}
        className={`${baseButtonClass} border-purple-500/40 text-purple-400 hover:bg-purple-500/10`}
      >
        {t('admin.tpl_fflogs_btn')}
      </button>

      <button
        type="button"
        onClick={onToggleAutoPropagate}
        className={`${baseButtonClass} ${
          autoPropagate
            ? 'border-blue-500/60 bg-blue-500/15 text-blue-400'
            : 'border-app-text/20 text-app-text-muted hover:bg-app-text/10'
        }`}
      >
        {t('admin.tpl_editor_auto_propagate')}
      </button>

      {/* スペーサー */}
      <div className="flex-1" />

      {/* 右側: 未翻訳カウンター + フィルタートグル */}
      {untranslatedCount > 0 ? (
        <span className="text-xs text-amber-400">
          {t('admin.tpl_editor_untranslated', { count: untranslatedCount })}
        </span>
      ) : (
        <span className="text-xs text-emerald-400">
          {t('admin.tpl_editor_translated')}
        </span>
      )}

      <button
        type="button"
        onClick={onToggleUntranslatedOnly}
        className={`${baseButtonClass} ${
          showUntranslatedOnly
            ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
            : 'border-app-text/20 text-app-text-muted hover:bg-app-text/10'
        }`}
      >
        {t('admin.tpl_editor_untranslated_only')}
      </button>
    </div>
  );
}
