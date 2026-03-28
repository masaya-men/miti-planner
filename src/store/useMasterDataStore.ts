/**
 * マスターデータ用Zustandストア
 * Firestoreから取得したコンフィグ・コンテンツ定義をキャッシュ管理する
 */
import { create } from 'zustand';
import type {
  ContentCategory,
  ContentDefinition,
  ContentSeries,
  LocalizedString,
} from '../types';
import type { TemplateData } from '../data/templateLoader';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export interface MasterConfig {
  dataVersion: number;
  featureFlags: { useFirestore: boolean };
  categoryLabels: Record<ContentCategory, LocalizedString>;
  levelLabels: Record<number, LocalizedString>;
}

export interface MasterContents {
  items: ContentDefinition[];
  series: ContentSeries[];
}

interface MasterDataState {
  config: MasterConfig | null;
  contents: MasterContents | null;
  ready: boolean;
  error: string | null;
  templateCache: Record<string, TemplateData>;

  // アクション
  setData: (config: MasterConfig, contents: MasterContents) => void;
  setError: (error: string) => void;
  setTemplate: (contentId: string, data: TemplateData) => void;
}

// ─────────────────────────────────────────────
// ストア本体
// ─────────────────────────────────────────────

export const useMasterDataStore = create<MasterDataState>()((set) => ({
  config: null,
  contents: null,
  ready: false,
  error: null,
  templateCache: {},

  setData: (config, contents) =>
    set({ config, contents, ready: true, error: null }),

  setError: (error) =>
    set({ error }),

  setTemplate: (contentId, data) =>
    set((state) => ({
      templateCache: { ...state.templateCache, [contentId]: data },
    })),
}));

// ─────────────────────────────────────────────
// localStorageキャッシュヘルパー
// ─────────────────────────────────────────────

const MASTER_CACHE_KEY = 'lopo-master-data';
const TEMPLATE_CACHE_PREFIX = 'lopo-template-';

interface MasterCachePayload {
  version: number;
  config: MasterConfig;
  contents: MasterContents;
}

/** マスターデータをlocalStorageに保存 */
export function saveMasterCache(
  version: number,
  config: MasterConfig,
  contents: MasterContents,
): void {
  try {
    const payload: MasterCachePayload = { version, config, contents };
    localStorage.setItem(MASTER_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[MasterData] localStorageへの保存に失敗:', e);
  }
}

/** localStorageからマスターデータを読み込み */
export function loadMasterCache(): MasterCachePayload | null {
  try {
    const raw = localStorage.getItem(MASTER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MasterCachePayload;
  } catch {
    return null;
  }
}

/** テンプレートデータをlocalStorageに保存 */
export function saveTemplateCache(contentId: string, data: TemplateData): void {
  try {
    localStorage.setItem(
      `${TEMPLATE_CACHE_PREFIX}${contentId}`,
      JSON.stringify(data),
    );
  } catch (e) {
    console.warn(`[MasterData] テンプレートキャッシュ保存失敗 (${contentId}):`, e);
  }
}

/** localStorageからテンプレートデータを読み込み */
export function loadTemplateCache(contentId: string): TemplateData | null {
  try {
    const raw = localStorage.getItem(`${TEMPLATE_CACHE_PREFIX}${contentId}`);
    if (!raw) return null;
    return JSON.parse(raw) as TemplateData;
  } catch {
    return null;
  }
}
