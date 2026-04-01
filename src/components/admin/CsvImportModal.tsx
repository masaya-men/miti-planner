/**
 * src/components/admin/CsvImportModal.tsx
 *
 * スプレッドシート（TSV）データをテンプレートエディターにインポートするモーダル。
 * Step 1: 貼り付け → Step 2: 列対応付け → インポート実行
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import {
  parseTsv,
  guessColumnType,
  convertCsvToEvents,
  type ColumnType,
  type ColumnMapping,
  type ParsedRow,
} from '../../utils/templateConversions';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (events: TimelineEvent[], phases: TemplateData['phases']) => void;
}

type Step = 'paste' | 'mapping';

const COLUMN_TYPES: ColumnType[] = ['time', 'name', 'damage', 'type', 'target', 'phase', 'skip'];

// ─────────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────────

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const { t } = useTranslation();
  useEscapeClose(isOpen, onClose);

  const [step, setStep] = useState<Step>('paste');
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ステップ1 → ステップ2へ進む
  const handleNext = () => {
    setError(null);
    const parsed = parseTsv(rawText);
    if (parsed.length < 2) {
      setError(t('admin.tpl_csv_error'));
      return;
    }
    const headerRow = parsed[0];
    const initialMappings: ColumnMapping[] = headerRow.cells.map((header, index) => ({
      index,
      type: guessColumnType(header),
    }));
    setRows(parsed);
    setMappings(initialMappings);
    setStep('mapping');
  };

  // 列対応付けを変更
  const handleMappingChange = (colIndex: number, type: ColumnType) => {
    setMappings(prev =>
      prev.map(m => (m.index === colIndex ? { ...m, type } : m)),
    );
  };

  // インポート実行
  const handleImport = () => {
    setError(null);
    // ヘッダー行を除いたデータ行でイベントを生成
    const dataRows = rows.slice(1);
    const { events, phases } = convertCsvToEvents(dataRows, mappings);
    if (events.length === 0) {
      setError(t('admin.tpl_csv_error'));
      return;
    }
    onImport(events, phases);
    handleClose();
  };

  // 閉じる・状態リセット
  const handleClose = () => {
    setStep('paste');
    setRawText('');
    setRows([]);
    setMappings([]);
    setError(null);
    onClose();
  };

  const handleBack = () => {
    setError(null);
    setStep('paste');
  };

  if (!isOpen) return null;

  // プレビュー: ヘッダー + 最大5データ行
  const previewRows = rows.slice(0, 6);
  const headerCells = rows[0]?.cells ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* バックドロップ */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

      {/* モーダル本体 */}
      <div className="relative glass-tier3 shadow-sm rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col">

        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-app-border flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-app-text">
            {t('admin.tpl_csv_title')}
          </h2>
          <button
            onClick={handleClose}
            className="px-3 py-1 text-xs text-app-text-muted border border-app-text/20 rounded hover:bg-app-text/5 transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 flex flex-col gap-4 flex-1">

          {/* ─── Step 1: 貼り付け ─── */}
          {step === 'paste' && (
            <>
              <p className="text-xs text-app-text-muted leading-relaxed">
                {t('admin.tpl_csv_paste_label')}
              </p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={10}
                placeholder={"時間\t技名\tダメージ\n0:13\tルーイン\t50000\n0:25\tディアスタシス\t80000"}
                spellCheck={false}
                className="w-full px-3 py-2 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text font-mono resize-y"
              />
              {error && (
                <p className="text-xs text-red-400">{t('admin.tpl_csv_error')}</p>
              )}
            </>
          )}

          {/* ─── Step 2: 列対応付け ─── */}
          {step === 'mapping' && (
            <>
              <p className="text-xs text-app-text-muted leading-relaxed">
                {t('admin.tpl_csv_column_label')}
              </p>

              {/* ドロップダウン付きプレビューテーブル */}
              <div className="overflow-x-auto border border-app-text/10 rounded">
                <table className="text-[10px] text-app-text w-full">
                  {/* ドロップダウンヘッダー行 */}
                  <thead>
                    <tr className="bg-app-text/5">
                      {headerCells.map((_header, colIndex) => (
                        <th key={colIndex} className="px-1 py-1.5 border-r border-app-text/10 last:border-r-0">
                          <select
                            value={mappings[colIndex]?.type ?? 'skip'}
                            onChange={e => handleMappingChange(colIndex, e.target.value as ColumnType)}
                            className="w-full px-1 py-0.5 text-[10px] bg-app-bg border border-app-text/20 rounded text-app-text [&>option]:bg-app-bg cursor-pointer"
                          >
                            {COLUMN_TYPES.map(ct => (
                              <option key={ct} value={ct}>
                                {t(`admin.tpl_csv_column_${ct}`)}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={rowIndex === 0 ? 'bg-app-text/10 font-bold' : 'hover:bg-app-text/5'}
                      >
                        {row.cells.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-2 py-1 whitespace-nowrap border-r border-app-text/10 last:border-r-0"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <p className="text-xs text-red-400">{t('admin.tpl_csv_error')}</p>
              )}
            </>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-app-border flex justify-end gap-2 shrink-0">
          {step === 'paste' && (
            <button
              onClick={handleNext}
              disabled={!rawText.trim()}
              className="px-4 py-1.5 text-xs font-bold border rounded transition-colors cursor-pointer border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('admin.wizard_next')}
            </button>
          )}
          {step === 'mapping' && (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-1.5 text-xs font-medium border rounded transition-colors cursor-pointer border-app-text/20 text-app-text-muted hover:bg-app-text/5"
              >
                {t('admin.wizard_back')}
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-1.5 text-xs font-bold border rounded transition-colors cursor-pointer border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                {t('admin.tpl_csv_import')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
