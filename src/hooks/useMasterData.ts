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
import type { MasterConfig, MasterContents, MasterSkills, MasterStats } from '../store/useMasterDataStore';
import type { MasterServers } from '../types';
import type { TemplateData } from '../data/templateLoader';

// 静的フォールバック用のインポート
import {
  CATEGORY_LABELS,
  LEVEL_LABELS,
  CONTENT_DEFINITIONS,
  CONTENT_SERIES,
} from '../data/contentRegistry';
import { JOBS, MITIGATIONS, MITIGATION_DISPLAY_ORDER } from '../data/mockData';
import { ALL_PATCH_STATS } from '../data/defaultStats';
import { LEVEL_MODIFIERS } from '../data/levelModifiers';
import {
  serverMasterData,
  housingAreaMasterData,
  housingSizeMasterData,
  tagMasterData,
} from '../data/masterData';

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

function buildStaticSkills(): MasterSkills {
  return {
    jobs: JOBS,
    mitigations: MITIGATIONS,
    displayOrder: MITIGATION_DISPLAY_ORDER,
  };
}

function buildStaticStats(): MasterStats {
  return {
    levelModifiers: LEVEL_MODIFIERS,
    patchStats: ALL_PATCH_STATS,
    defaultStatsByLevel: { 100: '7.40', 90: '6.40', 80: '5.40', 70: '4.40' },
  };
}

function buildStaticServers(): MasterServers {
  return {
    datacenters: serverMasterData,
    housingAreas: housingAreaMasterData,
    housingSizes: housingSizeMasterData,
    tags: tagMasterData,
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
            setData(cached.config, cached.contents, cached.skills ?? buildStaticSkills(), cached.stats ?? buildStaticStats(), cached.servers ?? buildStaticServers());
            return;
          }

          // バージョン不一致 → contents/skills/stats/serversも並列取得（4 more reads）
          const [contentsSnap, skillsSnap, statsSnap, serversSnap] = await Promise.all([
            getDoc(doc(db, 'master', 'contents')),
            getDoc(doc(db, 'master', 'skills')),
            getDoc(doc(db, 'master', 'stats')),
            getDoc(doc(db, 'master', 'servers')),
          ]);

          const remoteContents = contentsSnap.exists() ? contentsSnap.data() as MasterContents : buildStaticContents();
          const remoteSkills = skillsSnap.exists() ? skillsSnap.data() as MasterSkills : buildStaticSkills();
          const remoteStats = statsSnap.exists() ? statsSnap.data() as MasterStats : buildStaticStats();
          const remoteServers = serversSnap.exists() ? serversSnap.data() as MasterServers : buildStaticServers();

          saveMasterCache(remoteConfig.dataVersion, remoteConfig, remoteContents, remoteSkills, remoteStats, remoteServers);
          setData(remoteConfig, remoteContents, remoteSkills, remoteStats, remoteServers);
          return;
        }

        // Firestoreにデータがない場合 → キャッシュフォールバック
        if (cached) {
          console.warn('[MasterData] Firestoreにデータなし、キャッシュを使用');
          setData(cached.config, cached.contents, cached.skills ?? buildStaticSkills(), cached.stats ?? buildStaticStats(), cached.servers ?? buildStaticServers());
          return;
        }

        // キャッシュもない → 静的ファイルフォールバック
        console.warn('[MasterData] Firestoreもキャッシュもなし、静的データを使用');
        setData(buildStaticConfig(), buildStaticContents(), buildStaticSkills(), buildStaticStats(), buildStaticServers());
      } catch (err) {
        console.error('[MasterData] 初期化エラー:', err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);

        // エラー時もフォールバック：キャッシュ → 静的データ
        const cached = loadMasterCache();
        if (cached) {
          console.warn('[MasterData] エラー発生、キャッシュにフォールバック');
          setData(cached.config, cached.contents, cached.skills ?? buildStaticSkills(), cached.stats ?? buildStaticStats(), cached.servers ?? buildStaticServers());
        } else {
          console.warn('[MasterData] エラー発生、静的データにフォールバック');
          setData(buildStaticConfig(), buildStaticContents(), buildStaticSkills(), buildStaticStats(), buildStaticServers());
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
  const skills = useMasterDataStore((s) => s.skills);
  const stats = useMasterDataStore((s) => s.stats);
  const ready = useMasterDataStore((s) => s.ready);
  return { config, contents, skills, stats, ready };
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
    const { getStaticTemplate } = await import('../data/templateLoader');
    const staticData = await getStaticTemplate(contentId);
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
