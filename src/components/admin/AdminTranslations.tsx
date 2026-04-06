import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TranslationTable } from './TranslationTable';
import { TranslationCsvTools } from './TranslationCsvTools';
import {
  TranslationCategory, TranslationRow, TranslationDataSet,
  loadSkillTranslations, loadContentTranslations,
  loadAttackTranslations, loadPhaseTranslations,
  loadOtherTranslations, loadTemplateList,
  saveSkillTranslations, saveContentTranslations,
  saveAttackTranslations, savePhaseTranslations,
  saveOtherTranslations,
} from '../../lib/translationDataLoaders';

const CATEGORIES: { key: TranslationCategory; labelKey: string }[] = [
  { key: 'skills', labelKey: 'admin.translations_category_skills' },
  { key: 'contents', labelKey: 'admin.translations_category_contents' },
  { key: 'attacks', labelKey: 'admin.translations_category_attacks' },
  { key: 'phases', labelKey: 'admin.translations_category_phases' },
  { key: 'others', labelKey: 'admin.translations_category_others' },
];

export function AdminTranslations() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<TranslationCategory>('skills');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [originalRows, setOriginalRows] = useState<TranslationRow[]>([]);
  const [groups, setGroups] = useState<{ value: string; label: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [templateList, setTemplateList] = useState<{ value: string; label: string }[]>([]);
  const [selectedContent, setSelectedContent] = useState('');

  // Data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      let result: TranslationDataSet;

      if (category === 'skills') {
        result = await loadSkillTranslations();
      } else if (category === 'contents') {
        result = await loadContentTranslations();
      } else if (category === 'attacks') {
        if (!selectedContent) {
          const list = await loadTemplateList();
          setTemplateList(list);
          setRows([]);
          setOriginalRows([]);
          setLoading(false);
          return;
        }
        result = await loadAttackTranslations(selectedContent);
      } else if (category === 'phases') {
        if (!selectedContent) {
          const list = await loadTemplateList();
          setTemplateList(list);
          setRows([]);
          setOriginalRows([]);
          setLoading(false);
          return;
        }
        result = await loadPhaseTranslations(selectedContent);
      } else {
        result = await loadOtherTranslations();
      }

      setRows(result.rows);
      setOriginalRows(result.rows.map(r => ({ ...r })));
      setGroups(result.groups);
      setSelectedGroup('');
    } catch (err) {
      setMessage('読み込みエラー');
      console.error(err);
    }
    setLoading(false);
  }, [category, selectedContent]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load template list when switching to attacks/phases
  useEffect(() => {
    if (category === 'attacks' || category === 'phases') {
      loadTemplateList().then(setTemplateList);
      setSelectedContent('');
    }
  }, [category]);

  // Cell change handler
  const handleCellChange = useCallback((rowIndex: number, field: 'ja' | 'en' | 'zh' | 'ko', value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }, []);

  // CSV import handler
  const handleImport = useCallback((updates: Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>) => {
    setRows(prev => prev.map(r => {
      const update = updates.get(r.id);
      if (!update) return r;
      return { ...r, ...update };
    }));
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    const jaEnChanges = rows.filter((r, i) => {
      const o = originalRows[i];
      return o && (r.ja !== o.ja || r.en !== o.en);
    }).length;

    if (jaEnChanges > 0) {
      const confirmed = window.confirm(
        t('admin.translations_save_confirm_jaen', { count: jaEnChanges })
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setMessage('');
    try {
      if (category === 'skills') await saveSkillTranslations(rows, originalRows);
      else if (category === 'contents') await saveContentTranslations(rows, originalRows);
      else if (category === 'attacks') await saveAttackTranslations(selectedContent, rows, originalRows);
      else if (category === 'phases') await savePhaseTranslations(selectedContent, rows, originalRows);
      else if (category === 'others') await saveOtherTranslations(rows, originalRows);

      setOriginalRows(rows.map(r => ({ ...r })));
      setMessage(t('admin.translations_saved'));
    } catch (err) {
      setMessage('保存エラー');
      console.error(err);
    }
    setSaving(false);
  }, [category, rows, originalRows, selectedContent, t]);

  // Has changes
  const hasChanges = rows.some((r, i) => {
    const o = originalRows[i];
    return o && (r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.ko !== o.ko);
  });

  // Filtered rows
  const filteredIndices = rows.reduce<number[]>((acc, r, i) => {
    if (selectedGroup && r.group !== selectedGroup) return acc;
    if (untranslatedOnly && r.zh && r.ko) return acc;
    acc.push(i);
    return acc;
  }, []);
  const filteredRows = filteredIndices.map(i => rows[i]);

  // Progress
  const zhDone = rows.filter(r => r.zh.trim()).length;
  const koDone = rows.filter(r => r.ko.trim()).length;
  const total = rows.length;
  const zhPercent = total ? Math.round((zhDone / total) * 100) : 0;
  const koPercent = total ? Math.round((koDone / total) * 100) : 0;

  return (
    <div className="max-w-[1200px]">
      <h1 className="text-app-2xl font-bold mb-4">{t('admin.translations_title')}</h1>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 border-b border-app-text/10 pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`px-4 py-2 rounded-t text-app-base transition-colors ${
              category === cat.key
                ? 'bg-app-text/10 font-bold border-b-2 border-app-text'
                : 'hover:bg-app-text/5'
            }`}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {/* Content selector for attacks/phases */}
      {(category === 'attacks' || category === 'phases') && (
        <div className="mb-4">
          <select
            value={selectedContent}
            onChange={e => setSelectedContent(e.target.value)}
            className="px-3 py-2 border border-app-text/20 rounded bg-app-bg text-app-base"
          >
            <option value="">{t('admin.translations_filter_content')}...</option>
            {templateList.map(tpl => (
              <option key={tpl.value} value={tpl.value}>{tpl.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-3 items-center mb-3 flex-wrap">
        {groups.length > 0 && (
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 border border-app-text/20 rounded bg-app-bg text-app-base"
          >
            <option value="">{t('admin.translations_filter_all')}</option>
            {groups.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-app-base cursor-pointer">
          <input
            type="checkbox"
            checked={untranslatedOnly}
            onChange={e => setUntranslatedOnly(e.target.checked)}
          />
          {t('admin.translations_filter_untranslated')}
        </label>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="flex gap-4 mb-3 text-app-sm text-app-text-muted">
          <span>zh: {zhDone}/{total} ({zhPercent}%)</span>
          <span>ko: {koDone}/{total} ({koPercent}%)</span>
        </div>
      )}

      {/* CSV tools */}
      <TranslationCsvTools rows={rows} category={category} onImport={handleImport} />

      {/* Table */}
      <div className="mt-4">
        {loading ? (
          <div className="text-app-text-muted py-8 text-center">読み込み中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-app-text-muted py-8 text-center">
            {(category === 'attacks' || category === 'phases') && !selectedContent
              ? 'コンテンツを選択してください'
              : 'データがありません'}
          </div>
        ) : (
          <TranslationTable
            rows={filteredRows}
            originalRows={filteredIndices.map(i => originalRows[i])}
            onChange={(filteredIdx, field, value) => {
              const realIdx = filteredIndices[filteredIdx];
              handleCellChange(realIdx, field, value);
            }}
          />
        )}
      </div>

      {/* Save button + message */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-6 py-2 rounded text-app-base font-bold transition-colors ${
            hasChanges && !saving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-app-text/10 text-app-text-muted cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : t('admin.translations_save')}
        </button>
        {message && (
          <span className={message.includes('エラー') ? 'text-red-500' : 'text-green-600'}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
