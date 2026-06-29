// src/components/StrategyBoardPastePage.tsx
// PS5 ストラテジーボード貼り付けアシスト（スマホ専用・1画面フロー型・ログイン/サーバー不要）。
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Copy, Check, RotateCcw, ChevronDown } from 'lucide-react';
import { showToast } from './Toast';
import {
  splitStrategyCode,
  DEFAULT_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
} from '../lib/strategyCode';

/** 初回案内を畳んだことを覚える localStorage キー。 */
const BG_STREAM_ACK_KEY = 'stgy_bgstream_ack';

/** 断片プレビュー（長い時だけ先頭8 + … + 末尾6 に省略）。 */
function preview(chunk: string): string {
  if (chunk.length <= 16) return chunk;
  return `${chunk.slice(0, 8)}…${chunk.slice(-6)}`;
}

export default function StrategyBoardPastePage() {
  const { t, i18n } = useTranslation();
  const [raw, setRaw] = useState('');
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [copied, setCopied] = useState<Set<number>>(new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(BG_STREAM_ACK_KEY) !== '1'; } catch { return true; }
  });

  const chunks = useMemo(() => splitStrategyCode(raw, chunkSize), [raw, chunkSize]);

  // raw / chunkSize が変わったらコピー済みをリセット
  useEffect(() => { setCopied(new Set()); }, [raw, chunkSize]);

  // ページタイトル
  useEffect(() => { document.title = t('stgy.page_title'); }, [t, i18n.language]);

  const ackPrep = () => {
    setPrepOpen(false);
    try { localStorage.setItem(BG_STREAM_ACK_KEY, '1'); } catch { /* noop */ }
  };

  const handleCopy = async (index: number, chunk: string) => {
    try {
      await navigator.clipboard.writeText(chunk);
      setCopied(prev => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      showToast(t('stgy.copied_toast'));
    } catch {
      showToast(t('stgy.copy_failed'), 'error');
    }
  };

  const allDone = chunks.length > 0 && copied.size === chunks.length;

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <div className="mx-auto w-full max-w-[480px] px-4 py-6 flex flex-col gap-5">
        {/* 見出し */}
        <header className="flex flex-col gap-1">
          <h1 className="text-app-2xl font-bold">{t('stgy.heading')}</h1>
          <p className="text-app-base text-app-text-muted leading-relaxed">{t('stgy.intro')}</p>
        </header>

        {/* ① 準備（折りたたみ） */}
        <section className="rounded-lg border border-app-border bg-app-surface2/40">
          <button
            type="button"
            onClick={() => setPrepOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer"
          >
            <span className="text-app-lg font-bold">① {t('stgy.prep_title')}</span>
            <ChevronDown size={16} className={clsx('transition-transform duration-200', prepOpen && 'rotate-180')} />
          </button>
          {prepOpen && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              <p className="text-app-base text-app-text-muted leading-relaxed whitespace-pre-line">
                {t('stgy.prep_body')}
              </p>
              <button
                type="button"
                onClick={ackPrep}
                className="self-start px-3 py-1.5 rounded-md text-app-md font-bold bg-app-toggle text-app-toggle-text hover:opacity-80 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                {t('stgy.prep_ack')}
              </button>
            </div>
          )}
        </section>

        {/* ② コードを貼る */}
        <section className="flex flex-col gap-2">
          <label className="text-app-lg font-bold">② {t('stgy.paste_label')}</label>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={t('stgy.paste_placeholder')}
            rows={4}
            className="w-full rounded-lg border border-app-border bg-app-surface2/40 px-3 py-2 text-app-base text-app-text placeholder:text-app-text-muted resize-y focus:outline-none focus:border-app-text/40"
          />
        </section>

        {/* ③ 順にコピー */}
        {chunks.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-app-lg font-bold">③ {t('stgy.chunks_heading')}</span>
              <button
                type="button"
                onClick={() => setCopied(new Set())}
                className="flex items-center gap-1 text-app-md text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                {t('stgy.reset')}
              </button>
            </div>

            <ol className="flex flex-col gap-2">
              {chunks.map((chunk, i) => {
                const done = copied.has(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleCopy(i, chunk)}
                      className={clsx(
                        'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.99] cursor-pointer',
                        done
                          ? 'border-app-border bg-app-surface2/30 text-app-text-muted'
                          : 'border-app-border bg-app-surface2/50 text-app-text hover:bg-app-text/5'
                      )}
                    >
                      <span className={clsx(
                        'shrink-0 flex items-center justify-center w-5 h-5 rounded-full border',
                        done ? 'border-[#22c55e] text-[#22c55e]' : 'border-app-text/30 text-app-text-muted'
                      )}>
                        {done ? <Check size={12} /> : <span className="text-app-xs font-bold">{i + 1}</span>}
                      </span>
                      <span className="flex-1 min-w-0 truncate font-mono text-app-md text-app-text-muted">
                        {preview(chunk)}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-app-md font-bold">
                        <Copy size={13} />
                        {done ? t('stgy.copied') : t('stgy.copy_nth', { n: i + 1 })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* 進捗バー */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-app-surface2 overflow-hidden">
                <div
                  className="h-full bg-app-text transition-all duration-300"
                  style={{ width: `${(copied.size / chunks.length) * 100}%` }}
                />
              </div>
              <span className="text-app-md text-app-text-muted shrink-0">
                {t('stgy.progress', { done: copied.size, total: chunks.length })}
              </span>
            </div>
            {allDone && (
              <p className="text-center text-app-lg font-bold text-[#22c55e]">{t('stgy.done')}</p>
            )}

            {/* 詳細設定（折りたたみ） */}
            <div>
              <button
                type="button"
                onClick={() => setAdvancedOpen(o => !o)}
                className="flex items-center gap-1 text-app-md text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
              >
                <ChevronDown size={12} className={clsx('transition-transform duration-200', advancedOpen && 'rotate-180')} />
                {t('stgy.advanced')}
              </button>
              {advancedOpen && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-app-md text-app-text-muted shrink-0">{t('stgy.chunk_size_label')}</span>
                  <input
                    type="range"
                    min={MIN_CHUNK_SIZE}
                    max={MAX_CHUNK_SIZE}
                    value={chunkSize}
                    onChange={e => setChunkSize(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-app-md font-bold w-10 text-right">{chunkSize}</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
