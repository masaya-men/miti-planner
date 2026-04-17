import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { useJobs } from '../hooks/useSkillsData';
import {
  getContentDefinitions,
  getContentById,
} from '../data/contentRegistry';
import { PLAN_LIMITS } from '../types/firebase';
import { apiFetch } from '../lib/apiClient';
import { getAnonCopyId } from '../lib/anonCopyId';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import type { PlanData, SavedPlan } from '../types';
import './MitigationSheet.css';

// --- 型 ---
interface PopularEntry {
  shareId: string;
  contentId: string;
  title: string;
  copyCount: number;
  viewCount: number;
  featured: boolean;
  partyMembers: { jobId: string | null }[];
}

interface ContentResult {
  contentId: string;
  plans: PopularEntry[];
  featured: PopularEntry | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentContentId: string | null;
}

// --- トースト（PopularPage.tsxと同じパターン） ---
function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-app-toggle text-app-toggle-text px-4 py-2 rounded-full text-app-2xl font-bold z-[99999]';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 1500);
  setTimeout(() => el.remove(), 2000);
}

// --- コンテンツID算出（PopularPage.tsxから移植） ---
const savageContents = getContentDefinitions().filter(c => c.category === 'savage');
const latestPatch = savageContents.reduce((max, c) => c.patch > max ? c.patch : max, '0');
const savageIds = savageContents
  .filter(c => c.patch === latestPatch)
  .sort((a, b) => a.order - b.order)
  .map(c => c.id);

const ultimateIds = getContentDefinitions()
  .filter(c => c.category === 'ultimate' && c.id !== 'dsr_p1')
  .map(c => c.id);

export const MitigationSheet: React.FC<Props> = ({ isOpen, onClose, currentContentId }) => {
  const { t, i18n } = useTranslation();
  const JOBS = useJobs();
  const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';
  const plans = usePlanStore(s => s.plans);

  // --- 状態 ---
  const [activeTab, setActiveTab] = useState<'savage' | 'ultimate'>('savage');
  const [popularData, setPopularData] = useState<Record<string, { plans: PopularEntry[]; featured: PopularEntry | null }>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PlanData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [drumrollDone, setDrumrollDone] = useState(false);
  const [copyState, setCopyState] = useState<
    | null
    | { phase: 'crawl'; current: number; total: number }
    | { phase: 'surge'; current: number; total: number }
    | { phase: 'done'; count: number }
  >(null);

  const listRef = useRef<HTMLDivElement>(null);

  const contentIds = activeTab === 'savage' ? savageIds : ultimateIds;

  // featured があればそれを優先、なければ自動ランキング1位を返す（UIでの視覚的区別なし）
  const getRepresentativeEntry = (contentId: string): PopularEntry | null => {
    const d = popularData[contentId];
    if (!d) return null;
    return d.featured ?? d.plans?.[0] ?? null;
  };

  // --- データ取得 ---
  useEffect(() => {
    if (!isOpen) return;
    const allIds = [...savageIds, ...ultimateIds];
    apiFetch(`/api/popular?contentIds=${allIds.join(',')}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((json: { results: ContentResult[] }) => {
        const map: Record<string, { plans: PopularEntry[]; featured: PopularEntry | null }> = {};
        for (const item of json.results) {
          map[item.contentId] = { plans: item.plans, featured: item.featured };
        }
        setPopularData(map);
      })
      .catch(() => {
        showToast(t('miti_sheet.fetch_error_toast'));
      });
  }, [isOpen, t]);

  // --- 選択中プランのプレビュー取得 ---
  useEffect(() => {
    if (!selectedId) { setPreviewData(null); return; }
    const entry = getRepresentativeEntry(selectedId);
    if (!entry) return;

    // preview=true: プレビュー表示は受動的閲覧なのでviewCountをスキップ
    setPreviewLoading(true);
    apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}&preview=true`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(shared => {
        setPreviewData(shared.planData ?? shared.data ?? null);
        setPreviewLoading(false);
      })
      .catch(() => {
        setPreviewData(null);
        setPreviewLoading(false);
      });
  }, [selectedId, popularData]);

  // --- タブ自動選択 + 初期選択（シート開時1回だけ） ---
  useEffect(() => {
    if (!isOpen || drumrollDone) return;

    // currentContentId に基づいてタブとカードを同時に決定する
    // （setActiveTab後も contentIds は旧activeTabの値なので依存しない）
    let targetTab: 'savage' | 'ultimate' = 'savage';
    let targetId: string | null = currentContentId;

    if (currentContentId && ultimateIds.includes(currentContentId)) {
      targetTab = 'ultimate';
    } else if (currentContentId && savageIds.includes(currentContentId)) {
      targetTab = 'savage';
    }

    // フォールバック: どちらのリストにもない場合は先頭を選択
    const resolvedIds = targetTab === 'savage' ? savageIds : ultimateIds;
    if (!targetId || !resolvedIds.includes(targetId)) {
      targetId = resolvedIds[0] ?? null;
    }

    setActiveTab(targetTab);
    setSelectedId(targetId);
    setDrumrollDone(true);
  }, [isOpen, drumrollDone, currentContentId]);

  // --- ヘルパー ---
  const getContentName = (contentId: string): string => {
    const def = getContentById(contentId);
    if (!def) return contentId;
    return def.name[lang] || def.name.ja;
  };

  // 零式は短縮名（1層、2層...）、絶は正式名称
  const getCardLabel = (contentId: string): string => {
    const def = getContentById(contentId);
    if (!def) return contentId;
    if (def.category === 'ultimate') {
      return def.name[lang] || def.name.ja;
    }
    return (lang === 'ja' ? def.shortName.ja : def.shortName.en).replace(/\n/g, ' ');
  };

  const getJobIcon = (jobId: string | null): string | null => {
    if (!jobId) return null;
    return JOBS.find(j => j.id === jobId)?.icon ?? null;
  };

  // --- コピーロジック ---
  const copyPlan = useCallback(async (entry: PopularEntry): Promise<boolean> => {
    // 件数制限チェック
    const contentPlans = plans.filter(p => p.contentId === entry.contentId);
    if (contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
      showToast(t('miti_sheet.limit_reached_toast', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }));
      return false;
    }
    if (plans.length >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
      showToast(t('miti_sheet.limit_reached_toast', { max: PLAN_LIMITS.MAX_TOTAL_PLANS }));
      return false;
    }

    try {
      // previewフラグ無し: コピーは能動操作なのでviewCountを計上する
      const res = await apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`);
      if (!res.ok) throw new Error();
      const shared = await res.json();
      const planData: PlanData = shared.planData ?? shared.data;

      const newPlan: SavedPlan = {
        id: crypto.randomUUID?.() ?? `plan_${Date.now()}`,
        ownerId: '',
        ownerDisplayName: '',
        title: entry.title,
        contentId: entry.contentId,
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: planData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      usePlanStore.getState().addPlan(newPlan);

      // copyCount +1（重複防止）
      const copiedKey = 'lopo_copied_shares';
      const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
      if (!copiedList.includes(entry.shareId)) {
        copiedList.push(entry.shareId);
        localStorage.setItem(copiedKey, JSON.stringify(copiedList));
        apiFetch('/api/popular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shareId: entry.shareId,
            anonId: getAnonCopyId(),
          }),
        }).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }, [plans, t]);

  // 共通コピー: 擬似プログレス → 完了ぐいーん → シート閉じ
  const runCopy = useCallback(async (entries: PopularEntry[]) => {
    if (entries.length === 0) return;
    const startedAt = Date.now();
    setCopyState({ phase: 'crawl', current: 0, total: entries.length });

    // 裏でコピー実行
    let copied = 0;
    for (const entry of entries) {
      const ok = await copyPlan(entry);
      if (ok) copied++;
      // 1件完了ごとに current を進める
      setCopyState({ phase: 'crawl', current: copied, total: entries.length });
    }

    // 最低表示時間 400ms（瞬殺ケースでも crawl が見えるように）
    const elapsed = Date.now() - startedAt;
    if (elapsed < 400) {
      await new Promise(r => setTimeout(r, 400 - elapsed));
    }

    // コピー完了 → ぐいーんと100%
    setCopyState({ phase: 'surge', current: entries.length, total: entries.length });
    await new Promise(r => setTimeout(r, 700));

    // チェックマーク
    setCopyState({ phase: 'done', count: copied });
    await new Promise(r => setTimeout(r, 900));
    setCopyState(null);
    onClose();
  }, [copyPlan, onClose]);

  // カード直接コピー（モバイル用）
  const handleCardCopy = useCallback(async (entry: PopularEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    await runCopy([entry]);
  }, [runCopy]);

  // 単体コピー
  const handleCopyThis = useCallback(async () => {
    if (!selectedId) return;
    const entry = getRepresentativeEntry(selectedId);
    if (!entry) return;
    await runCopy([entry]);
  }, [selectedId, popularData, runCopy]);

  // まとめてコピー
  const handleCopyAll = useCallback(async () => {
    const ids = activeTab === 'savage' ? savageIds : ultimateIds;
    const entries = ids
      .map(id => getRepresentativeEntry(id))
      .filter((e): e is PopularEntry => !!e);
    await runCopy(entries);
  }, [activeTab, popularData, runCopy]);

  // 選択コピー
  const handleCopyChecked = useCallback(async () => {
    const entries = Array.from(checkedIds)
      .map(id => getRepresentativeEntry(id))
      .filter((e): e is PopularEntry => !!e);
    await runCopy(entries);
    setSelectMode(false);
    setCheckedIds(new Set());
  }, [checkedIds, popularData, runCopy]);

  // カードクリック
  const handleCardClick = (contentId: string) => {
    if (selectMode) {
      setCheckedIds(prev => {
        const next = new Set(prev);
        if (next.has(contentId)) next.delete(contentId);
        else next.add(contentId);
        return next;
      });
      return;
    }
    setSelectedId(contentId);
  };

  // ESCで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // リセット（閉じた時）
  useEffect(() => {
    if (!isOpen) {
      setDrumrollDone(false);
      setSelectedId(null);
      setPreviewData(null);
      setSelectMode(false);
      setCheckedIds(new Set());
      setActiveTab('savage');
    }
  }, [isOpen]);

  // 初期ローディング判定: popularData未取得 or プレビュー取得中
  const isInitialLoading = (Object.keys(popularData).length === 0) || previewLoading;

  // 現在のコンテンツ名
  const currentContentName = currentContentId ? getContentName(currentContentId) : '';

  // OGP画像URL
  const getOgpUrl = (shareId: string) => `/api/og?id=${encodeURIComponent(shareId)}`;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <motion.div
            className="miti-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* カプセル通知 */}
          {currentContentName && (
            <motion.div
              className="miti-capsule"
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15, delay: 0 } }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: 0.8,
              }}
            >
              <span className="miti-capsule-dot" />
              <span>{t('miti_sheet.editing_context', { content: currentContentName })}</span>
            </motion.div>
          )}

          {/* ボトムシート */}
          <motion.div
            className="miti-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 28,
            }}
          >
            <div className="miti-handle" onClick={onClose} />

            {/* ヘッダー（1行: タブ → コピー群 → ×） */}
            <div className="miti-header">
              <div className="miti-header-row">
                <div className="miti-tabs">
                  <button
                    className="miti-tab"
                    data-active={activeTab === 'savage'}
                    onClick={() => setActiveTab('savage')}
                  >
                    {t('miti_sheet.tab_savage')}
                  </button>
                  <button
                    className="miti-tab"
                    data-active={activeTab === 'ultimate'}
                    onClick={() => setActiveTab('ultimate')}
                  >
                    {t('miti_sheet.tab_ultimate')}
                  </button>
                </div>
                <div className="miti-actions">
                  <button
                    className="miti-btn miti-hide-mobile"
                    onClick={() => { setSelectMode(!selectMode); setCheckedIds(new Set()); }}
                  >
                    {t('miti_sheet.copy_selected')}
                  </button>
                  <button className="miti-btn" onClick={handleCopyAll}>
                    {activeTab === 'savage' ? t('miti_sheet.copy_all_savage') : t('miti_sheet.copy_all_ultimate')}
                  </button>
                  {selectMode && checkedIds.size > 0 && (
                    <button className="miti-btn miti-btn-primary" onClick={handleCopyChecked}>
                      {t('miti_sheet.copy_n_items', { count: checkedIds.size })}
                    </button>
                  )}
                  {!selectMode && (
                    <button
                      className="miti-btn miti-hide-mobile"
                      onClick={handleCopyThis}
                      disabled={!selectedId}
                    >
                      {t('miti_sheet.copy_this')}
                    </button>
                  )}
                </div>
                <button className="miti-close" onClick={onClose}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* メイン */}
            <div className="miti-body">
              {/* 左: OGPカードリスト */}
              <div className="miti-card-list" ref={listRef}>
                {contentIds.map(contentId => {
                  const entry = getRepresentativeEntry(contentId);
                  const isSelected = selectedId === contentId;
                  const isChecked = checkedIds.has(contentId);

                  return (
                    <div
                      key={contentId}
                      data-content-id={contentId}
                      className="miti-card"
                      data-selected={isSelected}
                      onClick={() => handleCardClick(contentId)}
                    >
                      {selectMode && (
                        <div className="miti-check" data-checked={isChecked}>
                          {isChecked && <Check size={11} />}
                        </div>
                      )}
                      <div className="miti-floor-label">{getCardLabel(contentId)}</div>
                      {entry ? (
                        <>
                          <img
                            className="miti-ogp-img"
                            src={getOgpUrl(entry.shareId)}
                            alt={entry.title}
                            loading="lazy"
                          />
                          {entry.partyMembers?.length > 0 && (
                            <div className="miti-jobs-overlay">
                              {entry.partyMembers.map((m, i) => {
                                const icon = getJobIcon(m.jobId);
                                return icon ? <img key={i} src={icon} alt="" /> : null;
                              })}
                            </div>
                          )}
                          <div className="miti-card-bottom">
                            <span className="miti-card-title" title={entry.title}>
                              {entry.title}
                            </span>
                            <span className="miti-copies">
                              {t('miti_sheet.copies', { count: entry.copyCount })}
                            </span>
                            {!selectMode && (
                              <button
                                className="miti-card-copy-btn"
                                onClick={(e) => handleCardCopy(entry, e)}
                              >
                                {t('miti_sheet.copy_card')}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div
                          className="miti-ogp-img"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                            {t('miti_sheet.no_data')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* エンドライン */}
                <div className="miti-end-line" />
              </div>

              {/* 右: プレビュー */}
              <div className="miti-preview">
                <div className="miti-info-panel">
                  <div className="miti-info-item miti-info-blue">
                    <span className="miti-info-item-icon" style={{ fontSize: 12, width: 16, textAlign: 'center' }}>&#x2194;</span>
                    <span>{t('miti_sheet.info_compat')}</span>
                  </div>
                  <div className="miti-info-item miti-info-neutral">
                    <span className="miti-info-item-icon" style={{ fontSize: 12, width: 16, textAlign: 'center' }}>+</span>
                    <span>{t('miti_sheet.info_new_plan', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT })}</span>
                  </div>
                </div>

                <MitigationSheetPreview
                  planData={previewData}
                  loading={previewLoading || !drumrollDone}
                />
              </div>

              {/* 初期ローディングオーバーレイ */}
              <AnimatePresence>
                {isInitialLoading && (
                  <motion.div
                    className="miti-loading-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <motion.svg
                      className="miti-loading-spinner"
                      viewBox="0 0 32 32"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    >
                      <circle
                        cx="16" cy="16" r="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeOpacity="0.15"
                      />
                      <circle
                        cx="16" cy="16" r="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="20 81.7"
                      />
                    </motion.svg>
                    <span className="miti-loading-text">{t('miti_sheet.loading')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* コピーオーバーレイ */}
            <AnimatePresence>
              {copyState && (
                <motion.div
                  className="miti-copy-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className="miti-copy-panel"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    {(copyState.phase === 'crawl' || copyState.phase === 'surge') ? (
                      <>
                        <div className="miti-copy-ring">
                          {copyState.phase === 'crawl' ? (
                            // 不確定スピナー（円弧が回転し続ける）
                            <motion.svg
                              viewBox="0 0 36 36"
                              className="miti-copy-ring-svg"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                              <circle
                                cx="18" cy="18" r="16" fill="none"
                                stroke="#3b82f6"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeDasharray="25 100"
                              />
                            </motion.svg>
                          ) : (
                            // surge: 0.2 → 1 にぐいーん
                            <svg viewBox="0 0 36 36" className="miti-copy-ring-svg">
                              <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                              <motion.circle
                                cx="18" cy="18" r="16" fill="none"
                                stroke="#3b82f6"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                pathLength={1}
                                initial={{ pathLength: 0.2 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                              />
                            </svg>
                          )}
                          <span className="miti-copy-count">
                            {copyState.current}/{copyState.total}
                          </span>
                        </div>
                        <motion.span
                          className="miti-copy-label"
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          {t('miti_sheet.copying_progress', { current: copyState.current, total: copyState.total })}
                        </motion.span>
                      </>
                    ) : (
                      <>
                        <motion.div
                          className="miti-copy-check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                          <Check size={28} />
                        </motion.div>
                        <span className="miti-copy-label">
                          {t('miti_sheet.copied_n_toast', { count: copyState.count })}
                        </span>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="miti-footer">{t('miti_sheet.footer_readonly')}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
