import React, { useState, useCallback } from 'react';
import type { TranslationRow } from '../../lib/translationDataLoaders';

interface Props {
  rows: TranslationRow[];
  originalRows: TranslationRow[];
  onChange: (rowIndex: number, field: 'ja' | 'en' | 'zh' | 'ko', value: string) => void;
}

export function TranslationTable({ rows, originalRows, onChange }: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  const isChanged = useCallback((rowIdx: number, field: 'ja' | 'en' | 'zh' | 'ko') => {
    const orig = originalRows[rowIdx];
    if (!orig) return false;
    return rows[rowIdx][field] !== orig[field];
  }, [rows, originalRows]);

  const isEmpty = useCallback((value: string) => !value.trim(), []);

  const isJaEnChanged = useCallback((rowIdx: number, field: string) => {
    return (field === 'ja' || field === 'en') && isChanged(rowIdx, field as 'ja' | 'en');
  }, [isChanged]);

  return (
    <div className="overflow-x-auto border border-app-text/10 rounded">
      <table className="w-full text-app-base">
        <thead>
          <tr className="bg-app-text/5 border-b border-app-text/10">
            <th className="px-3 py-2 text-left font-medium w-48">ID</th>
            <th className="px-3 py-2 text-left font-medium">日本語</th>
            <th className="px-3 py-2 text-left font-medium">English</th>
            <th className="px-3 py-2 text-left font-medium">中文</th>
            <th className="px-3 py-2 text-left font-medium">한국어</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className="border-b border-app-text/5 hover:bg-app-text/3">
              <td className="px-3 py-1.5 text-app-text-muted text-app-sm font-mono truncate max-w-48">
                {row.id}
              </td>
              {(['ja', 'en', 'zh', 'ko'] as const).map(field => {
                const editing = editingCell?.row === idx && editingCell?.field === field;
                const changed = isChanged(idx, field);
                const empty = isEmpty(row[field]);
                const jaEnWarn = isJaEnChanged(idx, field);

                return (
                  <td
                    key={field}
                    className={`px-1 py-0.5 cursor-text ${
                      jaEnWarn ? 'bg-yellow-500/15 ring-1 ring-yellow-500/40' :
                      changed ? 'bg-blue-500/10' :
                      empty ? 'bg-red-500/5' : ''
                    }`}
                    onClick={() => setEditingCell({ row: idx, field })}
                  >
                    {editing ? (
                      <input
                        autoFocus
                        className="w-full px-2 py-1 bg-app-bg border border-app-text/20 rounded text-app-base outline-none focus:border-blue-500"
                        value={row[field]}
                        onChange={e => onChange(idx, field, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const fields = ['ja', 'en', 'zh', 'ko'] as const;
                            const nextField = fields[(fields.indexOf(field) + 1) % fields.length];
                            const nextRow = nextField === 'ja' ? idx + 1 : idx;
                            if (nextRow < rows.length) setEditingCell({ row: nextRow, field: nextField });
                          }
                        }}
                      />
                    ) : (
                      <div className="px-2 py-1 min-h-[28px]">
                        {row[field] || <span className="text-app-text-muted/40 italic">—</span>}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
