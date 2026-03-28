/**
 * マスターデータ初期化・アクセスフック
 * アプリ起動時にFirestore → localStorage → 静的ファイルの順でデータを取得する
 */
import { useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  useMasterDataStore,
  saveMasterCache,
  loadMasterCache,
  saveTemplateCache,
  loadTemplateCache,
} from '../store/useMasterDataStore';
import type { MasterConfig, MasterContents } from '../store/useMasterDataStore';
import type { TemplateData } from '../data/templateLoader';

// 静的フォールバック用のインポート
import {
  CATEGORY_LABELS,
  LEVEL_LABELS,
  CONTENT_DEFINITIONS,
  CONTENT_SERIES,
} from '../data/contentRegistry';

// ─────────────────────────────────────────────
// 静的データからフォールバック用MasterConfigを生成
// ─────────────────────────────────────────────
function buildStaticConfig(): MasterConfig {
  return {
    dataVersion: 0,
    featureFlags: { useFirestore: false },
    categoryLabels: CATEGORY_LABELS,
    levelLabels: LEVEL_LABELS,
  };
}

function buildStaticContents(): MasterContents {
  return {
    items: CONTENT_DEFINITIONS,
    series: CONTENT_SERIES,
  };
}

// ─────────────────────────────────────────────
// useMasterDataInit — アプリ起動時に1回だけ呼ぶ
// ─────────────────────────────────────────────
export function useMasterDataInit(): void {
  const ready = useMasterDataStore((s) => s.ready);
  const setData = useMasterDataStore((s) => s.setData);
  const setError = useMasterDataStore((s) => s.setError);
  const initStarted = useRef(false);

  useEffect(() => {
    // 既に初期化済み or 初期化中ならスキップ
    if (ready || initStarted.current) return;
    initStarted.current = true;

    (async () => {
      try {
        // localStorageキャッシュを先に読み込む
        const cached = loadMasterCache();

        // Firestoreからconfigを取得（1 read）
        const configSnap = await getDoc(doc(db, 'master', 'config'));

        if (configSnap.exists()) {
          const remoteConfig = configSnap.data() as MasterConfig;

          // バージョンが一致 → キャッシュをそのまま使用（0 additional reads）
          if (cached && cached.version === remoteConfig.dataVersion) {
            setData(cached.config, cached.contents);
            return;
          }

          // バージョン不一致 → contentsも取得（1 more read）
          const contentsSnap = await getDoc(doc(db, 'master', 'contents'));
          if (contentsSnap.exists()) {
            const remoteContents = contentsSnap.data() as MasterContents;
            saveMasterCache(remoteConfig.dataVersion, remoteConfig, remoteContents);
            setData(remoteConfig, remoteContents);
            return;
          }
        }

        // Firestoreにデータがない場合 → キャッシュフォールバック
        if (cached) {
          console.warn('[MasterData] Firestoreにデータなし、キャッシュを使用');
          setData(cached.config, cached.contents);
          return;
        }

        // キャッシュもない → 静的ファイルフォールバック
        console.warn('[MasterData] Firestoreもキャッシュもなし、静的データを使用');
        setData(buildStaticConfig(), buildStaticContents());
      } catch (err) {
        console.error('[MasterData] 初期化エラー:', err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);

        // エラー時もフォールバック：キャッシュ → 静的データ
        const cached = loadMasterCache();
        if (cached) {
          console.warn('[MasterData] エラー発生、キャッシュにフォールバック');
          setData(cached.config, cached.contents);
        } else {
          console.warn('[MasterData] エラー発生、静的データにフォールバック');
          setData(buildStaticConfig(), buildStaticContents());
        }
      }
    })();
  }, [ready, setData, setError]);
}

// ─────────────────────────────────────────────
// useMasterData — ストアから現在の状態を取得
// ─────────────────────────────────────────────
export function useMasterData() {
  const config = useMasterDataStore((s) => s.config);
  const contents = useMasterDataStore((s) => s.contents);
  const ready = useMasterDataStore((s) => s.ready);
  return { config, contents, ready };
}

// ─────────────────────────────────────────────
// fetchTemplate — テンプレートデータを段階的に取得
// ─────────────────────────────────────────────
export async function fetchTemplate(contentId: string): Promise<TemplateData | null> {
  const store = useMasterDataStore.getState();

  // 1. メモリキャッシュ確認
  if (store.templateCache[contentId]) {
    return store.templateCache[contentId];
  }

  // 2. localStorageキャッシュ確認
  const localCached = loadTemplateCache(contentId);
  if (localCached) {
    store.setTemplate(contentId, localCached);
    return localCached;
  }

  // 3. Firestoreから取得
  try {
    const snap = await getDoc(doc(db, 'templates', contentId));
    if (snap.exists()) {
      const data = snap.data() as TemplateData;
      saveTemplateCache(contentId, data);
      store.setTemplate(contentId, data);
      return data;
    }
  } catch (err) {
    console.warn(`[MasterData] テンプレート取得失敗 (${contentId}):`, err);
  }

  // 4. 静的ファイルフォールバック
  try {
    const { getTemplate } = await import('../data/templateLoader');
    const staticData = await getTemplate(contentId);
    if (staticData) {
      saveTemplateCache(contentId, staticData);
      store.setTemplate(contentId, staticData);
      return staticData;
    }
  } catch (err) {
    console.warn(`[MasterData] 静的テンプレート読み込み失敗 (${contentId}):`, err);
  }

  return null;
}
