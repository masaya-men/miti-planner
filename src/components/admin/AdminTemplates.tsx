/**
 * テンプレート管理画面
 * スプレッドシート型エディター + テンプレート一覧 + 昇格候補
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';
import { useTemplateEditor } from '../../hooks/useTemplateEditor';
import { TemplateEditor } from './TemplateEditor';
import { TemplateEditorToolbar } from './TemplateEditorToolbar';
import { PlanToTemplateModal } from './PlanToTemplateModal';
import { CsvImportModal } from './CsvImportModal';
import { FflogsTranslationModal } from './FflogsTranslationModal';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';

interface TemplateItem {
  contentId: string;
  source: string;
  eventCount: number;
  phaseCount: number;
  lockedAt: string | null;
  updatedAt: string;
}

interface ContentItem {
  id: string;
  nameJa?: string;
  name?: { ja?: string; en?: string };
}

interface PromotionCandidate {
  shareId: string;
  contentId: string;
  title: string;
  copyCount: number;
}

export function AdminTemplates() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // エディター用ステート
  const [selectedContentId, setSelectedContentId] = useState('');
  const [showUntranslatedOnly, setShowUntranslatedOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  // モーダル表示フラグ
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showFflogsModal, setShowFflogsModal] = useState(false);

  // データソース追跡（保存時に使用）
  const [dataSource, setDataSource] = useState<string>('admin_editor');

  const editor = useTemplateEditor();

  /** コンテンツ一覧を取得（ドロップダウン用） */
  const fetchContents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin?resource=contents');
      if (res.ok) {
        const data = await res.json();
        setContents(data.items ?? []);
      }
    } catch { /* コンテンツ取得失敗はテンプレート画面としては致命的でない */ }
  }, [user]);

  /** テンプレート一覧を取得 */
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=templates');
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setTemplates(
        (data.templates ?? []).map((item: any) => ({
          ...item,
          lockedAt: item.lockedAt ?? null,
          updatedAt: item.lastUpdatedAt ?? null,
        })),
      );
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  /** 昇格候補を取得 */
  const fetchCandidates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/template?action=promote&candidates=true');
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates ?? []);
      }
    } catch { /* 昇格候補取得失敗は致命的でない */ }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
    fetchContents();
    fetchCandidates();
  }, [fetchTemplates, fetchContents, fetchCandidates]);

  /** コンテンツを選択してテンプレートをロード */
  const handleContentChange = useCallback(async (contentId: string) => {
    if (editor.hasChanges) {
      const ok = window.confirm(t('admin.tpl_editor_unsaved'));
      if (!ok) return;
    }
    setSelectedContentId(contentId);
    setShowUntranslatedOnly(false);
    setDataSource('admin_editor');

    if (!contentId) return;

    try {
      const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
      if (res.ok) {
        const data = await res.json();
        editor.loadEvents(data.timelineEvents ?? [], data.phases ?? []);
      } else if (res.status === 404) {
        editor.loadEvents([], []);
      } else {
        showToast(t('admin.error_load'), 'error');
      }
    } catch {
      showToast(t('admin.error_load'), 'error');
    }
  }, [editor, t]);

  /** 保存 */
  const handleSave = async () => {
    if (editor.untranslatedCount > 0) {
      const ok = window.confirm(t('admin.tpl_editor_save_confirm_untranslated', { count: editor.untranslatedCount }));
      if (!ok) return;
    }

    try {
      setSaving(true);
      const { events, phases } = editor.getSaveData();
      const res = await apiFetch('/api/admin?resource=templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: selectedContentId,
          timelineEvents: events,
          phases,
          source: dataSource,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);

      showToast(t('admin.tpl_editor_saved'));
      // 保存後にテンプレートをリロードしてエディターを更新
      const reloadRes = await apiFetch(`/api/admin?resource=templates&id=${selectedContentId}`);
      if (reloadRes.ok) {
        const data = await reloadRes.json();
        editor.loadEvents(data.timelineEvents ?? [], data.phases ?? []);
      }
      await fetchTemplates();
    } catch {
      showToast(t('admin.tpl_editor_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  /** テンプレートを削除 */
  const handleDelete = async (item: TemplateItem) => {
    const ok = window.confirm(
      t('admin.templates_delete_confirm', { name: item.contentId }),
    );
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/admin?resource=templates&contentId=${item.contentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.templates_deleted'));
      if (selectedContentId === item.contentId) {
        setSelectedContentId('');
        editor.loadEvents([], []);
      }
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'), 'error');
    }
  };

  /** テンプレートのロック/アンロック */
  const handleToggleLock = async (item: TemplateItem) => {
    const newLock = !item.lockedAt;
    try {
      const res = await apiFetch('/api/admin?resource=templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId: item.contentId, lock: newLock }),
      });
      if (!res.ok) throw new Error(res.statusText);
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'), 'error');
    }
  };

  /** 昇格候補の承認/却下 */
  const handlePromotion = async (candidate: PromotionCandidate, action: 'approve' | 'reject') => {
    try {
      const res = await apiFetch('/api/template?action=promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareId: candidate.shareId,
          contentId: candidate.contentId,
          action,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      await fetchCandidates();
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'), 'error');
    }
  };

  // モーダルコールバック
  const handlePromoteImport = (events: TimelineEvent[], phases: TemplateData['phases']) => {
    editor.replaceAll(events, phases);
    setDataSource('plan_promote');
  };
  const handleCsvImport = (events: TimelineEvent[], phases: TemplateData['phases']) => {
    editor.replaceAll(events, phases);
    setDataSource('csv_import');
  };
  const handleFflogsMatched = (matches: Map<string, string>) => {
    editor.autoFillEnNames(matches);
  };

  const hasExistingTemplate = templates.some((t) => t.contentId === selectedContentId);
  const hasEvents = editor.visibleEvents.length > 0;

  const inputClass =
    'px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">{t('admin.templates_title')}</h1>

      {/* コンテンツ選択ドロップダウン */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className={`${inputClass} bg-app-bg [&>option]:bg-app-bg [&>option]:text-app-text`}
          value={selectedContentId}
          onChange={(e) => handleContentChange(e.target.value)}
        >
          <option value="">{t('admin.tpl_editor_no_content')}</option>
          {contents.map((c) => {
            const name = c.nameJa || c.name?.ja || c.id;
            return (
              <option key={c.id} value={c.id}>
                {c.id.toUpperCase()} — {name}
              </option>
            );
          })}
        </select>

        {selectedContentId && (
          <span className="text-xs text-app-text-muted">
            {t('admin.tpl_editor_content_summary', {
              events: editor.visibleEvents.length,
              phases: editor.state.currentPhases.length,
            })}
          </span>
        )}
      </div>

      {/* ツールバー（コンテンツ選択時のみ） */}
      {selectedContentId && (
        <div className="mb-3">
          <TemplateEditorToolbar
            untranslatedCount={editor.untranslatedCount}
            showUntranslatedOnly={showUntranslatedOnly}
            onToggleUntranslatedOnly={() => setShowUntranslatedOnly((v) => !v)}
            onOpenPromote={() => setShowPromoteModal(true)}
            onOpenCsvImport={() => setShowCsvModal(true)}
            onOpenFflogsTranslation={() => setShowFflogsModal(true)}
            hasEvents={hasEvents}
          />
        </div>
      )}

      {/* エディター（コンテンツ選択 + イベントあり） */}
      {selectedContentId && hasEvents && (
        <div className="mb-3">
          <TemplateEditor
            events={editor.visibleEvents}
            phases={editor.state.currentPhases}
            editState={editor.state}
            showUntranslatedOnly={showUntranslatedOnly}
            onUpdateCell={editor.updateCell}
            onDeleteEvent={editor.deleteEvent}
          />
        </div>
      )}

      {/* 空状態（コンテンツ選択済みだがイベントなし） */}
      {selectedContentId && !hasEvents && (
        <p className="text-xs text-app-text-muted mb-3">{t('admin.tpl_editor_empty')}</p>
      )}

      {/* フッター: 元に戻す + 保存（イベントあり時のみ） */}
      {selectedContentId && hasEvents && (
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={editor.undo}
            disabled={!editor.hasChanges}
            className="text-xs px-3 py-1.5 rounded border border-app-text/20 text-app-text-muted hover:bg-app-text/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('admin.tpl_editor_undo')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '...' : t('admin.tpl_editor_save')}
          </button>
        </div>
      )}

      {/* エラー */}
      {error && (
        <p className="text-xs text-app-text-muted mb-4">{error}</p>
      )}

      {/* ローディング */}
      {loading && (
        <p className="text-xs text-app-text-muted">...</p>
      )}

      {/* テンプレート一覧テーブル */}
      {!loading && templates.length === 0 && (
        <p className="text-xs text-app-text-muted">{t('admin.no_data')}</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-app-text/10 text-left text-app-text-muted">
                <th className="pb-2 pr-4">{t('admin.contents_id')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_source')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_events')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_phases')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_locked')}</th>
                <th className="pb-2 pr-4">{t('admin.templates_last_updated')}</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((item) => (
                <tr
                  key={item.contentId}
                  onClick={() => handleContentChange(item.contentId)}
                  className={`border-b border-app-text/5 hover:bg-app-text/5 transition-colors cursor-pointer ${
                    item.contentId === selectedContentId ? 'bg-blue-500/[0.06]' : ''
                  }`}
                >
                  <td className="py-2 pr-4 font-mono">{item.contentId}</td>
                  <td className="py-2 pr-4">{item.source}</td>
                  <td className="py-2 pr-4">{item.eventCount}</td>
                  <td className="py-2 pr-4">{item.phaseCount}</td>
                  <td className="py-2 pr-4">
                    <span className="text-app-text-muted">
                      {item.lockedAt
                        ? t('admin.template_locked')
                        : t('admin.template_discovery')}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-app-text-muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2 text-right flex items-center gap-2 justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleLock(item); }}
                      className="text-app-text-muted hover:text-app-text transition-colors"
                    >
                      {item.lockedAt ? t('admin.template_unlock') : t('admin.template_lock')}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                      className="text-app-text-muted hover:text-app-text transition-colors"
                    >
                      {t('admin.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 昇格候補セクション */}
      <div className="mt-8">
        <h2 className="text-sm font-bold mb-3">{t('admin.promotion_candidates')}</h2>
        {candidates.length === 0 ? (
          <p className="text-xs text-app-text-muted">{t('admin.promotion_empty')}</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.shareId}
                className="flex items-center gap-3 p-3 border border-app-text/10 rounded text-xs"
              >
                <span className="font-mono">{c.contentId}</span>
                <span className="flex-1 truncate">{c.title}</span>
                <span className="text-app-text-muted">
                  {t('admin.promotion_copy_count')}: {c.copyCount}
                </span>
                <button
                  onClick={() => handlePromotion(c, 'approve')}
                  className="px-2 py-1 border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                >
                  {t('admin.promotion_approve')}
                </button>
                <button
                  onClick={() => handlePromotion(c, 'reject')}
                  className="px-2 py-1 border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                >
                  {t('admin.promotion_reject')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* モーダル群 */}
      <PlanToTemplateModal
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        contentId={selectedContentId}
        hasExistingTemplate={hasExistingTemplate}
        onImport={handlePromoteImport}
      />
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onImport={handleCsvImport}
      />
      <FflogsTranslationModal
        isOpen={showFflogsModal}
        onClose={() => setShowFflogsModal(false)}
        onMatched={handleFflogsMatched}
      />
    </div>
  );
}
