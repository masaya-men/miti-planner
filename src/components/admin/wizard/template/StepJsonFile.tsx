import { useRef } from 'react';
import type { ParsedTemplate, StepTProps } from './templateTypes';

// Branch C Step 1: JSONファイルアップロード
export interface StepJsonFileProps {
  parsedTemplate: ParsedTemplate | null;
  jsonError: string | null;
  onParsed: (result: ParsedTemplate) => void;
  onError: (msg: string) => void;
  t: StepTProps['t'];
}

export function StepJsonFile({ parsedTemplate, jsonError, onParsed, onError, t }: StepJsonFileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!Array.isArray(parsed.timelineEvents)) {
          onError('JSONに timelineEvents 配列が見つかりません');
          return;
        }
        onParsed({
          timelineEvents: parsed.timelineEvents as unknown[],
          phases: Array.isArray(parsed.phases)
            ? (parsed.phases as unknown[])
            : [],
        });
      } catch {
        onError('JSONのパースに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-app-2xl text-[var(--app-text-muted)]">
        {t('admin.template_wiz_select_file')}
      </p>

      {/* ファイル選択ボタン */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="border border-dashed border-[var(--app-text)]/40 p-6 text-center hover:border-[var(--app-text)]/70 transition-colors"
      >
        <span className="text-app-2xl text-[var(--app-text-muted)]">
          {parsedTemplate
            ? '✓ ファイル読み込み完了（クリックで変更）'
            : 'クリックしてJSONファイルを選択'}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* エラー */}
      {jsonError && (
        <p className="text-app-lg text-[var(--app-text)] opacity-60">✗ {jsonError}</p>
      )}

      {/* 成功 */}
      {parsedTemplate && !jsonError && (
        <div className="text-app-lg text-[var(--app-text)] flex flex-col gap-1">
          <span>
            ✓ {t('admin.template_wiz_events_found', {
              count: parsedTemplate.timelineEvents.length,
            })}
          </span>
          <span>
            {t('admin.template_wiz_phases_found', {
              count: (parsedTemplate.phases ?? []).length,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
