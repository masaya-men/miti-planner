/**
 * src/components/admin/FflogsTranslationModal.tsx
 *
 * FFLogsレポートURLから技名を取得し、テンプレートのイベントと
 * GUIDで突合して翻訳マップを返すモーダル。
 * en / zh / ko の3言語に対応。
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { resolveFight, fetchFightEvents } from '../../api/fflogs';
import type { TimelineEvent } from '../../types';
import type { TranslationMatchResult } from '../../hooks/useTemplateEditor';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface FflogsTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatched: (result: TranslationMatchResult) => void;
  events: TimelineEvent[];
}

type TargetLang = 'en' | 'zh' | 'ko';

type Status =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; count: number }
  | { phase: 'no_match' }
  | { phase: 'error' };

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * FFLogs URLまたは裸のレポートコードからレポートコードを抽出する。
 * 例: https://www.fflogs.com/reports/XXXXXXXXXX#fight=1 → XXXXXXXXXX
 * @returns レポートコード文字列、または null（パース失敗時）
 */
function extractReportCode(input: string): string | null {
  const trimmed = input.trim();

  // URLパターン: /reports/XXXXXXXX
  const urlMatch = trimmed.match(/\/reports\/([A-Za-z0-9]{10,20})/);
  if (urlMatch) return urlMatch[1];

  // 裸のコード: 10〜20文字の英数字のみ
  const bareMatch = trimmed.match(/^[A-Za-z0-9]{10,20}$/);
  if (bareMatch) return trimmed;

  return null;
}

/**
 * translate=false が英語名を返しているか判定する。
 * 中国サーバーのレポートでは translate パラメータの意味が逆になり、
 * translate=false がネイティブ言語（中国語）を返す。
 */
function isLikelyEnglish(names: Map<number, string>): boolean {
  let asciiCount = 0;
  let total = 0;
  for (const name of names.values()) {
    total++;
    if (/^[\x20-\x7E]+$/.test(name)) asciiCount++;
  }
  return total === 0 || asciiCount / total > 0.5;
}

// ─────────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────────

export const FflogsTranslationModal: React.FC<FflogsTranslationModalProps> = ({
  isOpen,
  onClose,
  onMatched,
  events,
}) => {
  const { t } = useTranslation();
  useEscapeClose(isOpen, onClose);

  const [url, setUrl] = useState('');
  const [lang, setLang] = useState<TargetLang>('en');
  const [status, setStatus] = useState<Status>({ phase: 'idle' });

  const handleClose = () => {
    setUrl('');
    setLang('en');
    setStatus({ phase: 'idle' });
    onClose();
  };

  const handleFetch = async () => {
    const reportCode = extractReportCode(url);
    if (!reportCode) {
      setStatus({ phase: 'error' });
      return;
    }

    setStatus({ phase: 'loading' });

    try {
      // 最後のキルファイトを取得
      const fight = await resolveFight(reportCode, 'last');
      if (!fight) {
        setStatus({ phase: 'error' });
        return;
      }

      // translate=false + translate=true を並行取得
      // 注: 中国サーバー等ではtranslateの意味が逆になるため、後で自動判定する
      const [rawFalseEvents, rawTrueEvents] = await Promise.all([
        fetchFightEvents(reportCode, fight, false),
        fetchFightEvents(reportCode, fight, true),
      ]);

      // guid → name マップ構築（先着優先）
      const mapFalse = new Map<number, string>();
      for (const ev of rawFalseEvents) {
        if (ev.ability && !mapFalse.has(ev.ability.guid)) {
          mapFalse.set(ev.ability.guid, ev.ability.name);
        }
      }

      const mapTrue = new Map<number, string>();
      for (const ev of rawTrueEvents) {
        if (ev.ability && !mapTrue.has(ev.ability.guid)) {
          mapTrue.set(ev.ability.guid, ev.ability.name);
        }
      }

      // 中国サーバーではtranslate=falseがネイティブ言語を返すため自動検出して入替
      const falseIsEnglish = isLikelyEnglish(mapFalse);
      const guidToEn = falseIsEnglish ? mapFalse : mapTrue;
      const guidToNative = falseIsEnglish ? mapTrue : mapFalse;

      if (lang === 'en') {
        // EN翻訳: テンプレートイベントごとにGUID/JA名でマッチ
        const translations = new Map<string, string>();
        const guids = new Map<string, number>();

        for (const ev of events) {
          if (ev.name.en.trim()) continue; // Already has EN name

          let matchedGuid: number | undefined;

          // 1) GUIDマッチ
          if (ev.guid && guidToEn.has(ev.guid)) {
            matchedGuid = ev.guid;
          }
          // 2) JA名マッチ（フォールバック）
          if (!matchedGuid) {
            for (const [guid, nativeName] of guidToNative) {
              if (nativeName === ev.name.ja) {
                matchedGuid = guid;
                break;
              }
            }
          }

          if (matchedGuid) {
            const enName = guidToEn.get(matchedGuid);
            if (enName && enName !== ev.name.ja) {
              translations.set(ev.id, enName);
              if (!ev.guid) guids.set(ev.id, matchedGuid);
            }
          }
        }

        if (translations.size > 0) {
          onMatched({ lang: 'en', translations, guids });
          setStatus({ phase: 'success', count: translations.size });
        } else {
          setStatus({ phase: 'no_match' });
        }

      } else {
        // ZH/KO翻訳: GUID/EN名でマッチ
        const translations = new Map<string, string>();
        const guids = new Map<string, number>();

        // enName → guid 逆引き
        const enToGuid = new Map<string, number>();
        for (const [guid, enName] of guidToEn) {
          if (!enToGuid.has(enName)) enToGuid.set(enName, guid);
        }

        for (const ev of events) {
          let matchedGuid: number | undefined;

          // 1) GUIDマッチ
          if (ev.guid && guidToNative.has(ev.guid)) {
            matchedGuid = ev.guid;
          }
          // 2) EN名マッチ（フォールバック）
          if (!matchedGuid && ev.name.en) {
            matchedGuid = enToGuid.get(ev.name.en);
            // TB suffix対応
            if (!matchedGuid) {
              const base = ev.name.en.replace(/ \(TB\)$/, '');
              if (base !== ev.name.en) {
                matchedGuid = enToGuid.get(base);
              }
            }
          }

          if (matchedGuid) {
            let nativeName = guidToNative.get(matchedGuid);
            if (nativeName) {
              // TB suffixの復元
              if (ev.name.en.endsWith(' (TB)') && !nativeName.endsWith(' (TB)')) {
                nativeName += ' (TB)';
              }
              translations.set(ev.id, nativeName);
              if (!ev.guid) guids.set(ev.id, matchedGuid);
            }
          }
        }

        if (translations.size > 0) {
          onMatched({ lang, translations, guids });
          setStatus({ phase: 'success', count: translations.size });
        } else {
          setStatus({ phase: 'no_match' });
        }
      }
    } catch {
      setStatus({ phase: 'error' });
    }
  };

  if (!isOpen) return null;

  const isLoading = status.phase === 'loading';

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* バックドロップ */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

      {/* モーダル本体 */}
      <div className="relative glass-tier3 shadow-sm rounded-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 flex flex-col">

        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-app-border flex items-center justify-between shrink-0">
          <h2 className="text-app-2xl font-bold text-app-text">
            {t('admin.tpl_fflogs_title')}
          </h2>
          <button
            onClick={handleClose}
            className="px-3 py-1 text-app-lg text-app-text-muted border border-app-text/20 rounded hover:bg-app-text/5 transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-5 flex flex-col gap-4">

          {/* 言語選択 */}
          <div className="flex items-center gap-2">
            <span className="text-app-base text-app-text-muted">
              {t('admin.tpl_fflogs_lang_label')}
            </span>
            {(['en', 'zh', 'ko'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-3 py-1 text-app-lg rounded border cursor-pointer transition-colors ${
                  lang === l
                    ? 'border-purple-500/60 bg-purple-500/15 text-purple-400'
                    : 'border-app-text/20 text-app-text-muted hover:bg-app-text/10'
                }`}
              >
                {t(`admin.tpl_fflogs_lang_${l}`)}
              </button>
            ))}
          </div>

          {/* URLラベル */}
          <label className="flex flex-col gap-1.5">
            <span className="text-app-base text-app-text-muted">
              {lang === 'en'
                ? t('admin.tpl_fflogs_url_label')
                : t('admin.tpl_fflogs_url_hint_zhko', {
                    lang: t(`admin.tpl_fflogs_lang_${lang}`),
                  })
              }
            </span>

            {/* URL入力 + 取得ボタン */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={t('admin.tpl_fflogs_url_placeholder')}
                disabled={isLoading}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !isLoading && url.trim()) {
                    void handleFetch();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void handleFetch()}
                disabled={isLoading || !url.trim()}
                className="shrink-0 px-3 py-1.5 text-app-lg border rounded transition-colors cursor-pointer border-purple-500/40 text-purple-400 hover:bg-purple-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? '...' : t('admin.tpl_fflogs_fetch')}
              </button>
            </div>
          </label>

          {/* ステータスメッセージ */}
          {status.phase === 'error' && (
            <p className="text-app-lg text-red-400">
              {t('admin.tpl_fflogs_error')}
            </p>
          )}
          {status.phase === 'success' && (
            <p className="text-app-lg text-emerald-400">
              {t('admin.tpl_fflogs_matched', { count: status.count })}
            </p>
          )}
          {status.phase === 'no_match' && (
            <p className="text-app-lg text-amber-400">
              {t('admin.tpl_fflogs_no_match')}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
