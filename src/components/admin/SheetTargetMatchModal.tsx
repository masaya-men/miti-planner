/**
 * 「対象マッチ確認」モーダル。標準スプシを貼り付けると、各攻撃名がテンプレのどの技に
 * 当たり、どの対象(MT/ST/AoE)が引き継がれるかを一覧表示する。照合は取込時と同一関数。
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { parseMitigationSheet } from '../../lib/sheetImport/parseMitigationSheet';
import { buildSheetMatchReport, type SheetMatchRow } from '../../lib/sheetImport/carryOverTargets';
import type { TimelineEvent } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templateEvents: TimelineEvent[];
}

export function SheetTargetMatchModal({ isOpen, onClose, templateEvents }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [report, setReport] = useState<SheetMatchRow[] | null>(null);
  const [parseError, setParseError] = useState(false);

  useEscapeClose(isOpen, onClose);
  if (!isOpen) return null;

  const handleClose = () => {
    setText('');
    setReport(null);
    setParseError(false);
    onClose();
  };

  const handleCheck = () => {
    const parsed = parseMitigationSheet(text);
    if (!parsed) {
      setParseError(true);
      setReport(null);
      return;
    }
    setParseError(false);
    const rows = parsed.rows.map((r) => ({ action: r.action, time: r.totalTimeSec }));
    setReport(buildSheetMatchReport(rows, templateEvents));
  };

  const counts = report
    ? {
        carried: report.filter((r) => r.status === 'carried').length,
        noTarget: report.filter((r) => r.status === 'matched_no_target').length,
        unmatched: report.filter((r) => r.status === 'unmatched').length,
      }
    : null;

  const btnBase = 'px-3 py-1.5 text-app-lg rounded cursor-pointer transition-colors border';
  const btnBlue = `${btnBase} border-blue-500/40 text-blue-400 hover:bg-blue-500/10`;
  const btnMuted = `${btnBase} border-app-text/20 text-app-text-muted hover:bg-app-text/5`;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-lg max-h-[85vh] flex flex-col space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-app-2xl font-bold">{t('admin.tpl_sheet_match_title')}</p>
        <p className="text-app-base text-app-text-muted">{t('admin.tpl_sheet_match_hint')}</p>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setParseError(false); }}
          placeholder={t('admin.tpl_sheet_match_placeholder')}
          className="w-full h-28 bg-transparent border border-app-text/20 rounded p-2 text-app-lg font-mono text-app-text focus:outline-none focus:border-app-text/50 resize-none"
          spellCheck={false}
        />

        {parseError && (
          <p className="text-app-lg text-red-400">{t('admin.tpl_sheet_match_parse_failed')}</p>
        )}

        {counts && (
          <p className="text-app-base text-app-text-muted">
            {t('admin.tpl_sheet_match_summary', counts)}
          </p>
        )}

        {report && (
          <div className="overflow-y-auto border border-app-text/10 rounded">
            <table className="w-full text-app-lg border-collapse">
              <tbody>
                {report.map((r) => (
                  <tr key={r.action} className="border-b border-app-text/5">
                    <td className="py-1 px-2 text-app-text">{r.action}</td>
                    <td className="py-1 px-2 text-right whitespace-nowrap">
                      {r.status === 'carried' && (
                        <span className="text-emerald-400">✓ {r.templateName} / {r.target}</span>
                      )}
                      {r.status === 'matched_no_target' && (
                        <span className="text-amber-400">△ {r.templateName} / {t('admin.tpl_sheet_match_no_target')}</span>
                      )}
                      {r.status === 'unmatched' && (
                        <span className="text-app-text-muted">✗ {t('admin.tpl_sheet_match_unmatched')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={handleClose} className={btnMuted}>{t('admin.cancel')}</button>
          <button onClick={handleCheck} disabled={!text.trim()} className={`${btnBlue} disabled:opacity-40 disabled:cursor-not-allowed`}>
            {t('admin.tpl_sheet_match_check')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
