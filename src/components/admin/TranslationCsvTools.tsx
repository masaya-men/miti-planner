import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import type { TranslationRow } from '../../lib/translationDataLoaders';

interface Props {
  rows: TranslationRow[];
  category: string;
  onImport: (updates: Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>) => void;
}

interface ImportPreview {
  added: { lang: string; count: number }[];
  changed: { lang: string; count: number }[];
  unknownIds: string[];
  updates: Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>;
}

export function TranslationCsvTools({ rows, category, onImport }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // --- Export ---
  const handleExport = () => {
    const header = `ID,${t('admin.translations_csv_header_no_edit')} ja,${t('admin.translations_csv_header_no_edit')} en,zh,ko`;
    const csvRows = rows.map(r =>
      [r.id, csvEscape(r.ja), csvEscape(r.en), csvEscape(r.zh), csvEscape(r.ko)].join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translations_${category}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Import (parse) ---
  const parseCSV = (csvText: string) => {
    const result = Papa.parse<Record<string, string>>(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
    });

    const rowMap = new Map(rows.map(r => [r.id, r]));
    const updates = new Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>();
    const unknownIds: string[] = [];
    let zhAdded = 0, koAdded = 0, jaChanged = 0, enChanged = 0, zhChanged = 0, koChanged = 0;

    for (const parsed of result.data) {
      const id = parsed['ID'] || parsed['id'];
      if (!id) continue;

      const existing = rowMap.get(id);
      if (!existing) {
        unknownIds.push(id);
        continue;
      }

      const update: any = {};
      const jaKey = Object.keys(parsed).find(k => k.includes('ja')) || 'ja';
      const enKey = Object.keys(parsed).find(k => k.includes('en')) || 'en';
      const jaVal = parsed[jaKey]?.trim();
      const enVal = parsed[enKey]?.trim();
      const zhVal = parsed['zh']?.trim();
      const koVal = parsed['ko']?.trim();

      if (jaVal && jaVal !== existing.ja) { update.ja = jaVal; jaChanged++; }
      if (enVal && enVal !== existing.en) { update.en = enVal; enChanged++; }
      if (zhVal && !existing.zh && zhVal) { update.zh = zhVal; zhAdded++; }
      else if (zhVal && zhVal !== existing.zh) { update.zh = zhVal; zhChanged++; }
      if (koVal && !existing.ko && koVal) { update.ko = koVal; koAdded++; }
      else if (koVal && koVal !== existing.ko) { update.ko = koVal; koChanged++; }

      if (Object.keys(update).length > 0) updates.set(id, update);
    }

    setPreview({
      added: [
        { lang: 'zh', count: zhAdded },
        { lang: 'ko', count: koAdded },
      ].filter(a => a.count > 0),
      changed: [
        { lang: 'ja', count: jaChanged },
        { lang: 'en', count: enChanged },
        { lang: 'zh', count: zhChanged },
        { lang: 'ko', count: koChanged },
      ].filter(c => c.count > 0),
      unknownIds,
      updates,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseCSV(reader.result as string);
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handlePasteImport = () => {
    if (pasteText.trim()) parseCSV(pasteText);
  };

  const handleConfirmImport = () => {
    if (preview?.updates) {
      onImport(preview.updates);
      setPreview(null);
      setPasteMode(false);
      setPasteText('');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={handleExport} className="px-3 py-1.5 border border-app-text/20 rounded hover:bg-app-text/5 text-app-base">
          {t('admin.translations_export_csv')}
        </button>
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 border border-app-text/20 rounded hover:bg-app-text/5 text-app-base">
          {t('admin.translations_import_csv')}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />
        <button onClick={() => setPasteMode(!pasteMode)} className="px-3 py-1.5 border border-app-text/20 rounded hover:bg-app-text/5 text-app-base">
          {t('admin.translations_import_paste')}
        </button>
      </div>

      {pasteMode && (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full h-32 p-2 border border-app-text/20 rounded bg-app-bg text-app-base font-mono text-app-sm"
            placeholder="CSV/TSVテキストを貼り付け..."
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <button onClick={handlePasteImport} className="self-start px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-app-base">
            解析
          </button>
        </div>
      )}

      {preview && (
        <div className="border border-app-text/20 rounded p-4 bg-app-text/3">
          <h3 className="font-bold mb-2">{t('admin.translations_import_preview_title')}</h3>

          {preview.added.map(a => (
            <div key={a.lang} className="text-blue-500">
              {t('admin.translations_import_added', { count: a.count })} ({a.lang})
            </div>
          ))}
          {preview.changed.map(c => (
            <div key={c.lang} className={c.lang === 'ja' || c.lang === 'en' ? 'text-yellow-500 font-bold' : 'text-app-text'}>
              {t('admin.translations_import_changed', { count: c.count })} ({c.lang})
              {(c.lang === 'ja' || c.lang === 'en') && ' ⚠️'}
            </div>
          ))}
          {preview.unknownIds.length > 0 && (
            <div className="text-red-500 mt-1">
              {t('admin.translations_import_unknown_ids', { ids: preview.unknownIds.slice(0, 5).join(', ') })}
              {preview.unknownIds.length > 5 && ` (+${preview.unknownIds.length - 5})`}
            </div>
          )}

          {preview.updates.size > 0 && (
            <button onClick={handleConfirmImport} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {t('admin.translations_import_confirm')}
            </button>
          )}
          {preview.updates.size === 0 && (
            <div className="mt-2 text-app-text-muted">{t('admin.translations_no_changes')}</div>
          )}
        </div>
      )}
    </div>
  );
}

function csvEscape(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}
