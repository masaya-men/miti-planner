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

  const listRef = useRef<HTMLDivElement>(null);

  const contentIds = activeTab === 'savage' ? savageIds : ultimateIds;

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
    const d = popularData[selectedId];
    const entry = d?.plans?.[0] ?? null;
    if (!entry) return;

    setPreviewLoading(true);
    apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`)
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

  // --- タブ自動選択 + 初期スクロール ---
  useEffect(() => {
    if (!isOpen || drumrollDone) return;
    if (currentContentId && ultimateIds.includes(currentContentId)) {
      setActiveTab('ultimate');
    }
    // DOM描画後にターゲットへスクロール
    requestAnimationFrame(() => {
      scrollToTarget();
    });
  }, [isOpen, drumrollDone, activeTab]);

  const scrollToTarget = () => {
    const list = listRef.current;
    if (!list) { setDrumrollDone(true); return; }

    const cards = Array.from(list.querySelectorAll('[data-content-id]')) as HTMLElement[];
    if (cards.length === 0) { setDrumrollDone(true); return; }

    let targetId = currentContentId;
    let targetIdx = targetId ? cards.findIndex(c => c.dataset.contentId === targetId) : -1;
    if (targetIdx < 0) {
      targetIdx = 0;
      targetId = cards[0]?.dataset.contentId ?? contentIds[0];
    }

    const targetCard = cards[targetIdx];

    // ターゲットの上端をリストの上端にぴったり合わせる
    list.scrollTop = targetCard.offsetTop - list.offsetTop;

    setSelectedId(targetId);
    setDrumrollDone(true);

    // グロウエフェクト
    targetCard.classList.add('selecting');
    setTimeout(() => targetCard.classList.remove('selecting'), 600);
  };

  // --- ヘルパー ---
  const getFloorLabel = (contentId: string): string => {
    const def = getContentById(contentId);
    if (!def) return contentId;
    return (lang === 'ja' ? def.shortName.ja : def.shortName.en).replace(/\n/g, ' ');
  };

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
          body: JSON.stringify({ shareId: entry.shareId }),
        }).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }, [plans, t]);

  // 単体コピー
  const handleCopyThis = useCallback(async () => {
    if (!selectedId) return;
    const d = popularData[selectedId];
    const entry = d?.plans?.[0] ?? null;
    if (!entry) return;
    const ok = await copyPlan(entry);
    if (ok) showToast(t('miti_sheet.copied_toast'));
  }, [selectedId, popularData, copyPlan, t]);

  // まとめてコピー（現在のタブの全1位プラン）
  const handleCopyAll = useCallback(async () => {
    const ids = activeTab === 'savage' ? savageIds : ultimateIds;
    const entries = ids
      .map(id => popularData[id]?.plans?.[0])
      .filter((e): e is PopularEntry => !!e);

    if (entries.length === 0) return;

    let copied = 0;
    let skipped = 0;
    for (const entry of entries) {
      const ok = await copyPlan(entry);
      if (ok) copied++;
      else skipped++;
    }

    let msg = t('miti_sheet.copied_n_toast', { count: copied });
    if (skipped > 0) msg += ' ' + t('miti_sheet.skipped_toast', { count: skipped });
    showToast(msg);
  }, [activeTab, popularData, copyPlan, t]);

  // 選択コピー
  const handleCopyChecked = useCallback(async () => {
    const entries = Array.from(checkedIds)
      .map(id => popularData[id]?.plans?.[0])
      .filter((e): e is PopularEntry => !!e);

    if (entries.length === 0) return;

    let copied = 0;
    let skipped = 0;
    for (const entry of entries) {
      const ok = await copyPlan(entry);
      if (ok) copied++;
      else skipped++;
    }

    let msg = t('miti_sheet.copied_n_toast', { count: copied });
    if (skipped > 0) msg += ' ' + t('miti_sheet.skipped_toast', { count: skipped });
    showToast(msg);
    setSelectMode(false);
    setCheckedIds(new Set());
  }, [checkedIds, popularData, copyPlan, t]);

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
    // グロウ + スクロール
    const card = listRef.current?.querySelector(`[data-content-id="${contentId}"]`) as HTMLElement | null;
    if (card) {
      card.classList.add('selecting');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('selecting'), 600);
    }
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
              exit={{ opacity: 0 }}
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
            <div className="miti-handle" />

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
                    className="miti-btn"
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
                      className="miti-btn"
                      onClick={handleCopyThis}
                      disabled={!selectedId}
                    >
                      {t('miti_sheet.copy_this')}
                    </button>
                  )}
                </div>
                <button className="miti-close" onClick={onClose} title={t('miti_sheet.close') + ' (ESC)'}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* メイン */}
            <div className="miti-body">
              {/* 左: OGPカードリスト */}
              <div className="miti-card-list" ref={listRef}>
                {contentIds.map(contentId => {
                  const entry = popularData[contentId]?.plans?.[0];
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
                          <div className="miti-copies">
                            {t('miti_sheet.copies', { count: entry.copyCount })}
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
            </div>

            <div className="miti-footer">{t('miti_sheet.footer_readonly')}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
