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
} from '../lib/shareImportTypes';

export type ShareImportStatus =
  | 'idle'
  | 'loading'
  | 'preview'
  | 'importing'
  | 'limit_hit'
  | 'done'
  | 'error';

interface LimitContext {
  contentId: string;
  neededCount: number;
  planId: string;
  resolve: (decision: 'resolved' | 'cancelled') => void;
}

interface ShareImportFlowState {
  status: ShareImportStatus;
  shareId: string | null;
  sharedData: any | null;
  importItems: ShareImportItem[];
  selectedItemIds: Set<string>;
  progressMap: Map<string, ProgressEvent>;
  deleteProgressMap: Map<string, DeleteProgressEvent>;
  limitContext: LimitContext | null;
  errorMessage: string | null;

  start: (shareId: string) => Promise<void>;
  toggleSelect: (itemPlanId: string) => void;
  setSelected: (itemPlanIds: Set<string>) => void;
  startImport: () => Promise<void>;
  resolveLimitHit: (decision: 'resolved' | 'cancelled') => void;
  setProgress: (event: ProgressEvent) => void;
  setDeleteProgress: (event: DeleteProgressEvent) => void;
  setStatus: (s: ShareImportStatus) => void;
  setLimitContext: (ctx: LimitContext | null) => void;
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

  start: async (shareId) => {
    set({ status: 'loading', shareId, errorMessage: null });
    try {
      const res = await apiFetch(`/api/share?id=${encodeURIComponent(shareId)}`);
      if (res.status === 404) {
        set({ status: 'error', errorMessage: 'not_found' });
        return;
      }
      if (!res.ok) {
        set({ status: 'error', errorMessage: `HTTP ${res.status}` });
        return;
      }
      const data = await res.json();
      const items = parseSharedDataToImportItems(data, shareId);
      // デフォルトは「全件選択」
      const allIds = new Set(items.map(i => i.sourcePlanId ?? i.sourceShareId));
      set({
        status: 'preview',
        sharedData: data,
        importItems: items,
        selectedItemIds: allIds,
      });
    } catch (err) {
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

  close: () => {
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
    });
  },
}));
