// 共有プラン自動インポートフローのオーケストレーション state
// ShareImportSheet (B-1.5) から利用される。
// store 自身は副作用を持たず (apiFetch のみ)、実インポート/削除処理は
// executeShareImport / executePlanDeletions に委譲する。
import { create } from 'zustand';
import { apiFetch } from '../lib/apiClient';
import { parseSharedDataToImportItems } from '../lib/buildShareImportItems';
import type {
  ShareImportItem,
  ProgressEvent,
  DeleteProgressEvent,
  SharedData,
  LimitContext,
} from '../lib/shareImportTypes';

/**
 * loading → 次状態 (preview / error) への最小所要時間 (Phase B-1.5 polish 第 2 弾 #1)。
 *
 * シート slide-in は spring (stiffness 300, damping 28) で ~350ms 程度で settle する。
 * API が高速 (キャッシュ済 / 軽量プラン) のとき loading 状態が裏で一瞬で完了してしまい、
 * シートが y=0 に到達した頃には既に preview に切り替わっていて「下にちらっとシートが
 * 見える」 だけになる問題があった。 シート slide-in 完了後にも「読み込み中…」 を
 * 800ms 程度視認できるよう、 トータルで 1200ms を最低保証する。
 */
export const MIN_LOADING_VISIBLE_MS = 1200;

const padLoadingDelay = async (startedAt: number): Promise<void> => {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_LOADING_VISIBLE_MS) {
    await new Promise<void>(resolve =>
      setTimeout(resolve, MIN_LOADING_VISIBLE_MS - elapsed),
    );
  }
};

export type ShareImportStatus =
  | 'idle'
  | 'loading'
  | 'preview'
  | 'importing'
  | 'limit_hit'
  | 'done'
  | 'error';

// LimitContext 型は shareImportTypes.ts に移動 (cross-module で参照されるため)

interface ShareImportFlowState {
  status: ShareImportStatus;
  shareId: string | null;
  sharedData: SharedData | null;
  importItems: ShareImportItem[];
  selectedItemIds: Set<string>;
  progressMap: Map<string, ProgressEvent>;
  deleteProgressMap: Map<string, DeleteProgressEvent>;
  limitContext: LimitContext | null;
  errorMessage: string | null;
  /** 上限ヒット時に赤くマークするカード planId 集合 (#4) */
  redFlaggedPlanIds: Set<string>;

  start: (shareId: string) => Promise<void>;
  toggleSelect: (itemPlanId: string) => void;
  setSelected: (itemPlanIds: Set<string>) => void;
  startImport: () => Promise<void>;
  resolveLimitHit: (decision: 'resolved' | 'cancelled') => void;
  setProgress: (event: ProgressEvent) => void;
  setDeleteProgress: (event: DeleteProgressEvent) => void;
  setStatus: (s: ShareImportStatus) => void;
  setLimitContext: (ctx: LimitContext | null) => void;
  /** カードを赤背景にマーク (上限ヒット視覚化、 #4) */
  setRedFlag: (planId: string) => void;
  /** 赤背景マークを外す (上限解消後、 #4) */
  clearRedFlag: (planId: string) => void;
  close: () => void;
}

export const useShareImportFlow = create<ShareImportFlowState>((set, get) => ({
  status: 'idle',
  shareId: null,
  sharedData: null,
  importItems: [],
  selectedItemIds: new Set(),
  progressMap: new Map(),
  deleteProgressMap: new Map(),
  limitContext: null,
  errorMessage: null,
  redFlaggedPlanIds: new Set(),

  start: async (shareId) => {
    const startedAt = Date.now();
    set({ status: 'loading', shareId, errorMessage: null });
    try {
      const res = await apiFetch(`/api/share?id=${encodeURIComponent(shareId)}`);
      if (res.status === 404) {
        await padLoadingDelay(startedAt);
        set({ status: 'error', errorMessage: 'not_found' });
        return;
      }
      if (!res.ok) {
        await padLoadingDelay(startedAt);
        set({ status: 'error', errorMessage: `HTTP ${res.status}` });
        return;
      }
      const data = (await res.json()) as SharedData;
      const items = parseSharedDataToImportItems(data, shareId);
      // デフォルトは「全件選択」
      const allIds = new Set(items.map(i => i.sourcePlanId ?? i.sourceShareId));
      await padLoadingDelay(startedAt);
      set({
        status: 'preview',
        sharedData: data,
        importItems: items,
        selectedItemIds: allIds,
      });
    } catch (err) {
      await padLoadingDelay(startedAt);
      set({ status: 'error', errorMessage: String(err) });
    }
  },

  toggleSelect: (itemPlanId) => {
    const next = new Set(get().selectedItemIds);
    if (next.has(itemPlanId)) {
      next.delete(itemPlanId);
    } else {
      next.add(itemPlanId);
    }
    set({ selectedItemIds: next });
  },

  setSelected: (itemPlanIds) => set({ selectedItemIds: itemPlanIds }),

  startImport: async () => {
    // 実インポート処理は ShareImportSheet 側で executeShareImport を呼び出す。
    // store に直書きすると import 循環 (planService → store → executeShareImport) が
    // 起きやすいため、 store はオーケストレーション state のみ持たせる。
    set({ status: 'importing' });
  },

  resolveLimitHit: (decision) => {
    const ctx = get().limitContext;
    if (ctx) {
      ctx.resolve(decision);
      set({ limitContext: null, status: 'importing' });
    }
  },

  setProgress: (event) => {
    const next = new Map(get().progressMap);
    next.set(`${event.planId}:${event.stage}`, event);
    set({ progressMap: next });
  },

  setDeleteProgress: (event) => {
    const next = new Map(get().deleteProgressMap);
    next.set(`${event.planId}:${event.stage}`, event);
    set({ deleteProgressMap: next });
  },

  setStatus: (s) => set({ status: s }),
  setLimitContext: (ctx) =>
    set({ limitContext: ctx, status: ctx ? 'limit_hit' : 'importing' }),

  setRedFlag: (planId) => {
    const next = new Set(get().redFlaggedPlanIds);
    next.add(planId);
    set({ redFlaggedPlanIds: next });
  },

  clearRedFlag: (planId) => {
    const next = new Set(get().redFlaggedPlanIds);
    next.delete(planId);
    set({ redFlaggedPlanIds: next });
  },

  close: () => {
    // limit_hit 状態のままシートを閉じると executeShareImport の for-loop が
    // limitContext.resolve を待ち続けて止まる (= stuck Promise)。
    // close 時に未解決の Promise が残っていれば 'cancelled' で resolve してから state を破棄する。
    // resolveLimitHit が先に呼ばれていれば limitContext は null なのでここは no-op になる (二重 resolve 安全)。
    const ctx = get().limitContext;
    if (ctx) ctx.resolve('cancelled');
    set({
      status: 'idle',
      shareId: null,
      sharedData: null,
      importItems: [],
      selectedItemIds: new Set(),
      progressMap: new Map(),
      deleteProgressMap: new Map(),
      limitContext: null,
      errorMessage: null,
      redFlaggedPlanIds: new Set(),
    });
  },
}));
