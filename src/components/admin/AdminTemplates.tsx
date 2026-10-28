/**
 * テンプレート管理画面
 * スプレッドシート型エディター + テンプレート一覧 + 昇格候補
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../toastBus';
import { useTemplateEditor } from '../../hooks/useTemplateEditor';
import type { TranslationMatchResult } from '../../hooks/useTemplateEditor';
import { TemplateEditor } from './TemplateEditor';
import { TemplateEditorToolbar } from './TemplateEditorToolbar';
import { PlanToTemplateModal } from './PlanToTemplateModal';
import { CsvImportModal } from './CsvImportModal';
import { FflogsTranslationModal } from './FflogsTranslationModal';
import { FflogsTimelineImportModal } from './FflogsTimelineImportModal';
import { SheetTargetMatchModal } from './SheetTargetMatchModal';
import { BulkEditPopover } from './BulkEditPopover';
import { resolveImportEvents } from '../../utils/importModes';
import { resolveTemplatePhaseAppend } from '../../utils/templateImportPhases';
import { AdminPage } from './AdminPage';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../types/template';
import type { TemplateItem, ContentItem, PromotionCandidate } from './templates/adminTemplateTypes';
import { TemplateListTable } from './templates/TemplateListTable';
import { PromotionCandidatesSection } from './templates/PromotionCandidatesSection';


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
  const [showFflogsImportModal, setShowFflogsImportModal] = useState(false);
  const [showSheetMatchModal, setShowSheetMatchModal] = useState(false);

  // 一括編集用ステート
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAaOnly, setShowAaOnly] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user が変わった時にコールバックを作り直し、呼び出し側の effect で再取得させる
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
        (data.templates ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 管理 API の JSON 応答に型が無いため
          (item: any) => ({
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user が変わった時にコールバックを作り直し、呼び出し側の effect で再取得させる
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user が変わった時にコールバックを作り直し、呼び出し側の effect で再取得させる
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
    setSelectedIds(new Set());
    setShowAaOnly(false);
    setShowBulkEdit(false);
    setDataSource('admin_editor');

    if (!contentId) return;

    try {
      const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
      if (res.ok) {
        const data = await res.json();
        editor.loadEvents(data.timelineEvents ?? [], data.phases ?? [], data.labels);
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
      const { events, phases, labels } = editor.getSaveData();
      const res = await apiFetch('/api/admin?resource=templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: selectedContentId,
          timelineEvents: events,
          phases,
          labels,
          source: dataSource,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);

      showToast(t('admin.tpl_editor_saved'));
      // 保存後にテンプレートをリロードしてエディターを更新
      const reloadRes = await apiFetch(`/api/admin?resource=templates&id=${selectedContentId}`);
      if (reloadRes.ok) {
        const data = await reloadRes.json();
        editor.loadEvents(data.timelineEvents ?? [], data.phases ?? [], data.labels);
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

  // チェックボックスのトグル
  const handleToggleSelect = useCallback((eventId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  // 全選択/全解除（表示中のイベントのみ対象）
  const handleToggleSelectAll = useCallback(() => {
    const filtered = showAaOnly
      ? editor.visibleEvents.filter((ev) => ev.name.ja === 'AA' && ev.name.en === 'AA')
      : showUntranslatedOnly
        ? editor.visibleEvents.filter((ev) => !ev.name.en.trim())
        : editor.visibleEvents;
    setSelectedIds((prev) => {
      const allSelected = filtered.every((ev) => prev.has(ev.id));
      if (allSelected) return new Set();
      return new Set(filtered.map((ev) => ev.id));
    });
  }, [editor.visibleEvents, showAaOnly, showUntranslatedOnly]);

  // 一括変更の適用
  const handleBulkApply = useCallback((changes: Record<string, unknown>) => {
    editor.bulkUpdate(selectedIds, changes);
    setSelectedIds(new Set());
    setShowBulkEdit(false);
  }, [editor, selectedIds]);

  // モーダルコールバック
  const handlePromoteImport = (events: TimelineEvent[], phases: TemplateData['phases']) => {
    editor.replaceAll(events, phases);
    setDataSource('plan_promote');
  };
  const handleCsvImport = (events: TimelineEvent[], phases: TemplateData['phases'], labels?: TemplateData['labels']) => {
    editor.replaceAll(events, phases, labels);
    setDataSource('csv_import');
  };
  const handleFflogsMatched = (result: TranslationMatchResult) => {
    editor.applyTranslation(result);
  };
  const handleFflogsTimelineImport = (
    events: TimelineEvent[],
    phases: TemplateData['phases'],
    mode: 'replace_all' | 'append',
  ) => {
    if (mode === 'replace_all') {
      editor.replaceAll(events, phases);
    } else {
      const resolution = resolveImportEvents(editor.visibleEvents, events, 'append');
      const mergedPhases = resolveTemplatePhaseAppend(
        editor.state.currentPhases,
        phases,
        'append',
        resolution.appendFromTime,
      );
      editor.replaceAll(resolution.events, mergedPhases, [...editor.state.currentLabels]);
    }
    setDataSource('fflogs_timeline_import');
  };

  const hasExistingTemplate = templates.some((t) => t.contentId === selectedContentId);
  const hasEvents = editor.visibleEvents.length > 0;

  // AAフィルタを適用したイベント
  const filteredVisibleEvents = showAaOnly
    ? editor.visibleEvents.filter((ev) => ev.name.ja === 'AA' && ev.name.en === 'AA')
    : editor.visibleEvents;

  const inputClass =
    'px-2 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';

  return (
    <AdminPage
      title={t('admin.templates_title')}
      meta={!loading && templates.length > 0 ? templates.length : undefined}
      actions={
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
      }
    >
      {/* 選択中コンテンツの要約 */}
      {selectedContentId && (
        <div className="mb-4">
          <span className="text-app-lg text-app-text-muted">
            {t('admin.tpl_editor_content_summary', {
              events: editor.visibleEvents.length,
              phases: editor.state.currentPhases.length,
            })}
          </span>
        </div>
      )}

      {/* ツールバー（コンテンツ選択時のみ）。本文スクロール領域の上端に sticky 固定し、
          表を下にスクロールしても操作・保存が常に届くようにする（-mx-6/px-6 で端まで敷き、
          bg-app-bg で下を流れる行をマスク・border で区切り）。 */}
      {selectedContentId && (
        <div className="sticky top-0 z-20 -mx-6 px-6 py-2 mb-3 bg-app-bg border-b border-app-text/10 relative">
          <TemplateEditorToolbar
            untranslatedCount={editor.untranslatedCount}
            showUntranslatedOnly={showUntranslatedOnly}
            onToggleUntranslatedOnly={() => setShowUntranslatedOnly((v) => !v)}
            onOpenPromote={() => setShowPromoteModal(true)}
            onOpenCsvImport={() => setShowCsvModal(true)}
            onOpenFflogsTranslation={() => setShowFflogsModal(true)}
            onOpenFflogsTimelineImport={() => setShowFflogsImportModal(true)}
            hasEvents={hasEvents}
            autoPropagate={editor.autoPropagate}
            onToggleAutoPropagate={() => editor.setAutoPropagate((v) => !v)}
            showAaOnly={showAaOnly}
            onToggleAaOnly={() => { setShowAaOnly((v) => !v); setSelectedIds(new Set()); }}
            selectedCount={selectedIds.size}
            onOpenBulkEdit={() => setShowBulkEdit(true)}
            onOpenSheetMatch={() => setShowSheetMatchModal(true)}
            hasChanges={editor.hasChanges}
            saving={saving}
            onSave={handleSave}
            onUndo={editor.undo}
          />
          {showBulkEdit && selectedIds.size > 0 && (
            <BulkEditPopover
              selectedCount={selectedIds.size}
              onApply={handleBulkApply}
              onClose={() => setShowBulkEdit(false)}
            />
          )}
        </div>
      )}

      {/* エディター（コンテンツ選択 + イベントあり） */}
      {selectedContentId && hasEvents && (
        <div className="mb-3">
          <TemplateEditor
            events={filteredVisibleEvents}
            phases={editor.state.currentPhases}
            labels={editor.state.currentLabels}
            editState={editor.state}
            showUntranslatedOnly={showUntranslatedOnly}
            onUpdateCell={editor.updateCell}
            onDeleteEvent={editor.deleteEvent}
            onSetLabelAtTime={editor.setLabelAtTime}
            onUpdatePhaseName={editor.updatePhaseName}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
        </div>
      )}

      {/* 空状態（コンテンツ選択済みだがイベントなし） */}
      {selectedContentId && !hasEvents && (
        <p className="text-app-lg text-app-text-muted mb-3">{t('admin.tpl_editor_empty')}</p>
      )}

      {/* エラー */}
      {error && (
        <p className="text-app-lg text-app-text-muted mb-4">{error}</p>
      )}

      {/* ローディング */}
      {loading && (
        <p className="text-app-lg text-app-text-muted">...</p>
      )}

      {/* テンプレート一覧テーブル */}
      {!loading && templates.length === 0 && (
        <p className="text-app-lg text-app-text-muted">{t('admin.no_data')}</p>
      )}

      {!loading && templates.length > 0 && (
        <TemplateListTable
          templates={templates}
          selectedContentId={selectedContentId}
          onSelect={handleContentChange}
          onToggleLock={handleToggleLock}
          onDelete={handleDelete}
        />
      )}

      {/* 昇格候補セクション */}
      <PromotionCandidatesSection candidates={candidates} onPromotion={handlePromotion} />

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
        events={editor.visibleEvents}
      />
      <FflogsTimelineImportModal
        isOpen={showFflogsImportModal}
        onClose={() => setShowFflogsImportModal(false)}
        hasEvents={hasEvents}
        onImport={handleFflogsTimelineImport}
      />
      <SheetTargetMatchModal
        isOpen={showSheetMatchModal}
        onClose={() => setShowSheetMatchModal(false)}
        templateEvents={editor.visibleEvents}
      />
    </AdminPage>
  );
}
