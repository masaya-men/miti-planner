// src/components/StrategyBoardPastePage.tsx
// PS5 ストラテジーボード貼り付けアシスト。
// デザインは Apple iOS 純正アプリ風の単一ライトテーマ（src/styles/stgy.css）で、
// LoPo 本体のトークン・ダーク/ライトテーマからは独立させている。
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Copy, Check, X, RotateCcw, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  splitStrategyCode,
  DEFAULT_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
} from '../lib/strategyCode';
import '../styles/stgy.css';

/** 初回案内を畳んだことを覚える localStorage キー。 */
const BG_STREAM_ACK_KEY = 'stgy_bgstream_ack';

/** 断片プレビュー（長い時だけ先頭8 + … + 末尾6 に省略）。 */
function preview(chunk: string): string {
  if (chunk.length <= 16) return chunk;
  return `${chunk.slice(0, 8)}…${chunk.slice(-6)}`;
}

export default function StrategyBoardPastePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [raw, setRaw] = useState('');
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [copied, setCopied] = useState<Set<number>>(new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(BG_STREAM_ACK_KEY) !== '1'; } catch { return true; }
  });
  // iOS 風トースト（自前）。{msg, ok, leaving}
  const [toast, setToast] = useState<{ msg: string; ok: boolean; leaving: boolean } | null>(null);
  const toastTimers = useRef<number[]>([]);

  const chunks = useMemo(() => splitStrategyCode(raw, chunkSize), [raw, chunkSize]);

  // raw / chunkSize が変わったらコピー済みをリセット
  useEffect(() => { setCopied(new Set()); }, [raw, chunkSize]);

  // ページタイトル
  useEffect(() => { document.title = t('stgy.page_title'); }, [t, i18n.language]);

  // 表示中だけ、このページを「普通のアプリ」のように振る舞わせる:
  //  - 本体の body は overflow:hidden 既定なので、ここでは普通の縦スクロールを解禁
  //    （固定高さ内部スクロールをやめたので、ページ全体が自然にスクロールする）。
  //  - html/body の背景も iOS ライト色にし、キーボード開閉時に背後の暗い本体が
  //    黒帯/段差として見えないようにする。
  // アンマウントで全て元に戻す。
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      bodyOverflow: body.style.overflow,
      bodyOverflowX: body.style.overflowX,
    };
    html.style.background = '#f2f2f7';
    body.style.background = '#f2f2f7';
    body.style.overflow = 'auto';
    body.style.overflowX = 'hidden';
    return () => {
      html.style.background = prev.htmlBg;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
      body.style.overflowX = prev.bodyOverflowX;
    };
  }, []);

  // トースト後始末
  useEffect(() => () => { toastTimers.current.forEach(clearTimeout); }, []);

  const showToastLocal = (msg: string, ok: boolean) => {
    toastTimers.current.forEach(clearTimeout);
    toastTimers.current = [];
    setToast({ msg, ok, leaving: false });
    toastTimers.current.push(window.setTimeout(() => setToast(p => (p ? { ...p, leaving: true } : p)), 1200));
    toastTimers.current.push(window.setTimeout(() => setToast(null), 1440));
  };

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
      showToastLocal(t('stgy.copied_toast'), true);
    } catch {
      showToastLocal(t('stgy.copy_failed'), false);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const allDone = chunks.length > 0 && copied.size === chunks.length;

  return (
    <div data-testid="stgy-scroll" className="stgy-page">
      {/* iOS 風ナビバー */}
      <div className="stgy-nav">
        <button type="button" className="stgy-nav-back" onClick={goBack}>
          <ChevronLeft size={22} strokeWidth={2.4} />
          {t('stgy.back')}
        </button>
        <span className="stgy-nav-title">{t('stgy.nav_title')}</span>
      </div>

      <div className="stgy-container">
        <h1 className="stgy-title">{t('stgy.heading')}</h1>
        <p className="stgy-intro">{t('stgy.intro')}</p>

        {/* ① 準備（折りたたみ） */}
        <div className="stgy-group">
          <button
            type="button"
            className="stgy-disclosure"
            onClick={() => setPrepOpen(o => !o)}
          >
            <span className="stgy-grow">① {t('stgy.prep_title')}</span>
            <ChevronRight size={18} className={clsx('stgy-chevron', prepOpen && 'is-open')} />
          </button>
          {prepOpen && (
            <div className="stgy-disclosure-body">
              <p className="stgy-prep-text">{t('stgy.prep_body')}</p>
              <button type="button" className="stgy-btn-primary" onClick={ackPrep}>
                {t('stgy.prep_ack')}
              </button>
            </div>
          )}
        </div>

        {/* ② コードを貼る */}
        <div className="stgy-field-label">② {t('stgy.paste_label')}</div>
        <textarea
          className="stgy-textarea"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          placeholder={t('stgy.paste_placeholder')}
          rows={4}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />

        {/* ③ 順にコピー */}
        {chunks.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div className="stgy-list-header">
              <span className="stgy-section">③ {t('stgy.chunks_heading')}</span>
              <button type="button" className="stgy-reset" onClick={() => setCopied(new Set())}>
                <RotateCcw size={13} />
                {t('stgy.reset')}
              </button>
            </div>

            <ol className="stgy-group stgy-list">
              {chunks.map((chunk, i) => {
                const done = copied.has(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={clsx('stgy-copy-row', done && 'is-done')}
                      onClick={() => handleCopy(i, chunk)}
                    >
                      <span className="stgy-copy-index">
                        {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="stgy-copy-preview">{preview(chunk)}</span>
                      <span className="stgy-copy-action">
                        <Copy size={15} />
                        {done ? t('stgy.copied') : t('stgy.copy_nth', { n: i + 1 })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* 進捗 */}
            <div className="stgy-progress">
              <div className="stgy-progress-track">
                <div className="stgy-progress-fill" style={{ width: `${(copied.size / chunks.length) * 100}%` }} />
              </div>
              <span className="stgy-progress-label">
                {t('stgy.progress', { done: copied.size, total: chunks.length })}
              </span>
            </div>
            {allDone && (
              <div className="stgy-done">
                <Check size={18} strokeWidth={3} />
                {t('stgy.done')}
              </div>
            )}

            {/* 詳細設定（文字数スライダー） */}
            <button
              type="button"
              className="stgy-advanced-toggle"
              onClick={() => setAdvancedOpen(o => !o)}
            >
              <ChevronRight size={14} className={clsx('stgy-chevron', advancedOpen && 'is-open')} />
              {t('stgy.advanced')}
            </button>
            {advancedOpen && (
              <div className="stgy-group stgy-slider-card">
                <div className="stgy-slider-row">
                  <span className="stgy-slider-label">{t('stgy.chunk_size_label')}</span>
                  <input
                    type="range"
                    className="stgy-range"
                    min={MIN_CHUNK_SIZE}
                    max={MAX_CHUNK_SIZE}
                    value={chunkSize}
                    onChange={e => setChunkSize(Number(e.target.value))}
                  />
                  <span className="stgy-slider-value">{chunkSize}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* iOS 風トースト */}
      {toast && (
        <div className={clsx('stgy-toast', toast.leaving && 'is-leaving')} role="status">
          {toast.ok
            ? <Check size={15} strokeWidth={3} className="stgy-toast-ok" />
            : <X size={15} strokeWidth={3} className="stgy-toast-ng" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
