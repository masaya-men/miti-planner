import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { hasContentRegistry, getFilteredBosses } from '../lib/contentSelection';
import { CATEGORY_LABELS } from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';

/** コンテンツ選択 UI に渡す props。GridImportModal 等の取り込みモーダルで共通利用。 */
export interface ImportContentSelectorProps {
  selLevel: ContentLevel | null;
  setSelLevel: (v: ContentLevel | null) => void;
  selCategory: ContentCategory | null;
  setSelCategory: (v: ContentCategory | null) => void;
  selBoss: ContentDefinition | null;
  setSelBoss: (v: ContentDefinition | null) => void;
  selTitle: string;
  setSelTitle: (v: string) => void;
  lang: 'ja' | 'en';
}

/** Step1「取り込み先コンテンツ選択」で使うレベル/カテゴリ定数。 */
const LEVEL_OPTIONS: ContentLevel[] = [100, 90, 80, 70];
const CATEGORY_OPTIONS: ContentCategory[] = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];

/**
 * 取り込み先コンテンツ選択 UI（Level / Category / Boss リスト / 自由入力タイトル）。
 * 旧スプシ取込モーダルの Step1 から抽出した実証済みの挙動をそのまま保持する。
 * Task 12 の GridImportModal でも同部品を再利用する。
 */
export const ImportContentSelector: React.FC<ImportContentSelectorProps> = ({
  selLevel,
  setSelLevel,
  selCategory,
  setSelCategory,
  selBoss,
  setSelBoss,
  selTitle,
  setSelTitle,
  lang,
}) => {
  const { t } = useTranslation();

  // Level / Category が変わるたびに Boss リストを再算出する。
  const filteredBosses = useMemo(() => getFilteredBosses(selLevel, selCategory), [selLevel, selCategory]);

  return (
    <div className="space-y-2">
      <p className="text-app-lg text-app-text-muted block">
        {t('sheetImport.target_content_label')}
      </p>
      {/* Level */}
      <div className="flex gap-2 flex-wrap">
        {LEVEL_OPTIONS.map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => { setSelLevel(lv); setSelBoss(null); }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-app-2xl font-bold border transition-all duration-200 cursor-pointer active:scale-95',
              selLevel === lv
                ? 'border-app-text bg-app-text/5 text-app-text'
                : 'border-app-border text-app-text-muted hover:border-app-text/40',
            )}
          >
            Lv{lv}
          </button>
        ))}
      </div>
      {/* Category */}
      <div className="flex gap-2 flex-wrap pt-1">
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => { setSelCategory(cat); setSelBoss(null); setSelTitle(''); }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-app-2xl font-bold border transition-all duration-200 cursor-pointer active:scale-95',
              selCategory === cat
                ? 'border-app-text bg-app-text/5 text-app-text'
                : 'border-app-border text-app-text-muted hover:border-app-text/40',
            )}
          >
            {(CATEGORY_LABELS[cat][lang] || CATEGORY_LABELS[cat].ja).toUpperCase()}
          </button>
        ))}
      </div>
      {/* Boss (零式・絶) */}
      {hasContentRegistry(selCategory) && (
        selLevel ? (
          filteredBosses.length > 0 ? (
            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pt-1">
              {filteredBosses.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelBoss(b)}
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg text-app-2xl font-bold border text-left transition-all duration-200 cursor-pointer active:scale-[0.98]',
                    selBoss?.id === b.id
                      ? 'border-app-text bg-app-text/5 text-app-text'
                      : 'border-app-border text-app-text-muted hover:border-app-text/40',
                  )}
                >
                  {b.name[lang] || b.name.ja}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-app-lg text-app-text-muted py-2">{t('new_plan.no_matches')}</p>
          )
        ) : (
          <p className="text-app-lg text-app-text-muted py-2">{t('new_plan.select_level_first')}</p>
        )
      )}
      {/* 自由入力タイトル (ダンジョン/レイド/その他) */}
      {selCategory !== null && !hasContentRegistry(selCategory) && (
        <input
          type="text"
          value={selTitle}
          onChange={(e) => setSelTitle(e.target.value)}
          placeholder={t('new_plan.plan_name_placeholder')}
          className="w-full bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted mt-1"
          spellCheck={false}
        />
      )}
    </div>
  );
};
