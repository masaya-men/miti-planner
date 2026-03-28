# Phase 3: スキル・ステータスのFirestore化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ジョブ・スキル・ステータス・レベル補正をFirestoreに移行し、ブラウザの管理画面から編集可能にする

**Architecture:** 既存の `useMasterData` フック + `useMasterDataStore` を拡張して `/master/skills` と `/master/stats` を取得・キャッシュする。全消費元ファイル（15+5件）のimportを静的ファイル直接参照からストア経由に書き換える。管理APIはVercel 12関数制限のため `api/admin/templates/index.ts` に `?type=skills` / `?type=stats` として統合する。

**Tech Stack:** React 19, TypeScript, Zustand, Firebase Firestore, Vercel Serverless Functions

**制約:**
- Vercel Hobby 12関数制限（現在12/12） → 新規APIファイル追加不可、既存エンドポイントに統合
- 操作中のFirestoreアクセスゼロを維持（起動時1回フェッチ→メモリ使用）
- 静的ファイルはフォールバック用に残す

---

## ファイル構成

### 新規作成
| ファイル | 責務 |
|---------|------|
| `src/hooks/useSkillsData.ts` | スキル・ステータスデータをストアから取得するヘルパーフック |
| `src/components/admin/AdminSkills.tsx` | スキル管理画面（ジョブ一覧・スキル編集） |
| `src/components/admin/AdminStats.tsx` | ステータス管理画面（レベル補正・パッチ別ステータス） |

### 修正
| ファイル | 変更内容 |
|---------|---------|
| `scripts/seed-firestore.mjs` | skills + stats シーディング追加 |
| `src/store/useMasterDataStore.ts` | skills, stats をストアに追加 |
| `src/hooks/useMasterData.ts` | skills, stats のフェッチ + フォールバック追加 |
| `api/admin/templates/index.ts` | `?type=skills` / `?type=stats` ハンドラー統合 |
| `src/store/useMitigationStore.ts` | 静的import → ストア経由に変更 |
| `src/utils/autoPlanner.ts` | 引数経由でスキルデータを受け取るように変更 |
| `src/utils/calculator.ts` | 引数経由でレベル補正を受け取るように変更 |
| `src/components/PopularPage.tsx` | JOBS/MITIGATIONS → ストア経由 |
| `src/components/TimelineRow.tsx` | 同上 |
| `src/components/MitigationSelector.tsx` | 同上 |
| `src/components/CheatSheetView.tsx` | 同上 |
| `src/components/PartySettingsModal.tsx` | 同上 |
| `src/components/Timeline.tsx` | 同上 |
| `src/components/EventModal.tsx` | 同上 |
| `src/components/Layout.tsx` | 同上 |
| `src/components/JobPicker.tsx` | 同上 |
| `src/components/ClearMitigationsPopover.tsx` | 同上 |
| `src/components/PartyStatusPopover.tsx` | LEVEL_MODIFIERS → ストア経由 |
| `src/utils/resourceTracker.ts` | 同上 |
| `src/utils/jobMigration.ts` | 同上 |
| `src/store/useTutorialStore.ts` | 同上 |
| `src/debug_calc.ts` | 同上 |
| `src/components/admin/AdminLayout.tsx` | ナビにスキル・ステータスタブ追加 |
| `src/App.tsx` | ルート追加 |
| `src/components/FFLogsImportModal.tsx` | JOBS → ストア経由 |

---

## Task 1: シーディングスクリプト拡張

**Files:**
- Modify: `scripts/seed-firestore.mjs`
- Reference: `src/data/mockData.ts`, `src/data/defaultStats.ts`, `src/data/levelModifiers.ts`

- [ ] **Step 1: mockData.tsのデータをJSON形式に変換するヘルパーを追加**

`seed-firestore.mjs` の末尾に、skills と stats のシーディングを追加する。
mockData.ts はTypeScriptなのでNodeから直接読めない。手動でデータを構築するのではなく、
`src/data/mockData.ts` をパースしてJSONに変換する中間スクリプトを作る代わりに、
シードスクリプト内で直接Firestore用のデータを組み立てる。

ただし mockData.ts は577行あり手動変換は非現実的。代替案として:
- Viteのビルドを利用してmockData.tsをimportし、JSON.stringifyで出力する一時スクリプトを使う
- または、tsxランナーを使ってTypeScriptを直接実行する

**最もシンプルな方法:** `npx tsx` を使ってTypeScriptを直接実行するシードスクリプトを書く。

```javascript
// seed-firestore.mjs の末尾に追加

// ==========================================
// skills データの構築（mockData.ts から）
// ==========================================
// mockData.ts は TypeScript なので、別の seed-skills.ts スクリプトから
// JSON を出力させてパイプする方式を取る。
// ここでは seed-firestore.mjs 単体で完結させるため、
// 一時的にビルド済みのJSONファイルを読み込む方式にする。

// → 実際の実装: scripts/export-skills-json.ts を npx tsx で実行し、
//   その出力を seed-firestore.mjs が読む2段階方式

```

**実際の実装方針:** `scripts/seed-skills-stats.ts` を新規作成し、`npx tsx` で実行する。
mockData.ts, defaultStats.ts, levelModifiers.ts を直接importしてFirestoreに書き込む。

- [ ] **Step 2: seed-skills-stats.ts を新規作成**

```typescript
// scripts/seed-skills-stats.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { JOBS, MITIGATIONS, MITIGATION_DISPLAY_ORDER } from '../src/data/mockData';
import { DT_PATCH_STATS, EW_PATCH_STATS, SHB_PATCH_STATS, SB_PATCH_STATS } from '../src/data/defaultStats';
import { LEVEL_MODIFIERS } from '../src/data/levelModifiers';

// .env.local 読み込み（seed-firestore.mjs と同じloadEnv関数）
function loadEnv(filePath: string) {
  const text = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に Firebase認証情報が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

// /master/skills
const skillsDoc = {
  jobs: JOBS,
  mitigations: MITIGATIONS,
  displayOrder: MITIGATION_DISPLAY_ORDER,
};
await db.doc('master/skills').set(skillsDoc);
console.log(`✅ /master/skills 書き込み完了 (jobs: ${JOBS.length}, mitigations: ${MITIGATIONS.length})`);

// /master/stats
const statsDoc = {
  levelModifiers: LEVEL_MODIFIERS,
  patchStats: {
    ...DT_PATCH_STATS,
    ...EW_PATCH_STATS,
    ...SHB_PATCH_STATS,
    ...SB_PATCH_STATS,
  },
  defaultStatsByLevel: {
    100: '7.40',
    90: '6.40',
    80: '5.40',
    70: '4.40',
  },
};
await db.doc('master/stats').set(statsDoc);
console.log('✅ /master/stats 書き込み完了');

// dataVersion を+1
await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 スキル・ステータスのシード完了！');
```

- [ ] **Step 3: シードスクリプトを実行してデータを投入**

```bash
npx tsx scripts/seed-skills-stats.ts
```

期待される出力:
```
✅ /master/skills 書き込み完了 (jobs: 21, mitigations: 97)
✅ /master/stats 書き込み完了
✅ dataVersion インクリメント完了
🎉 スキル・ステータスのシード完了！
```

- [ ] **Step 4: Firebase Consoleで書き込みを確認**

ブラウザでFirebase Console → Firestore → `master/skills` と `master/stats` が存在することを確認。

- [ ] **Step 5: コミット**

```bash
git add scripts/seed-skills-stats.ts
git commit -m "feat: Phase 3 スキル・ステータスのシードスクリプト追加"
```

---

## Task 2: ストア拡張（useMasterDataStore に skills/stats を追加）

**Files:**
- Modify: `src/store/useMasterDataStore.ts`

- [ ] **Step 1: MasterSkills / MasterStats 型を追加**

```typescript
// useMasterDataStore.ts に追加する型定義

import type { Job, Mitigation, LevelModifier, TemplateStats } from '../types';

export interface MasterSkills {
  jobs: Job[];
  mitigations: Mitigation[];
  displayOrder: string[];
}

export interface MasterStats {
  levelModifiers: Record<number, LevelModifier>;
  patchStats: Record<string, TemplateStats>;
  defaultStatsByLevel: Record<number, string>; // level → patchバージョン
}
```

注意: `LevelModifier` と `TemplateStats` は `src/types/index.ts` にまだ定義がない可能性がある。
`LevelModifier` は `src/data/levelModifiers.ts` で定義されている。
`TemplateStats` は `src/data/defaultStats.ts` で定義されている。
これらを `src/types/index.ts` に移動するか、各ファイルから re-export する。

**方針:** `src/types/index.ts` に `LevelModifier` と `TemplateStats` を追加する。
既存の `levelModifiers.ts` と `defaultStats.ts` は `src/types/index.ts` からimportするように変更。

- [ ] **Step 2: types/index.ts に LevelModifier と TemplateStats を追加**

`src/types/index.ts` の末尾に追加:

```typescript
export interface LevelModifier {
  level: number;
  main: number;
  sub: number;
  div: number;
  hp: number;
}

export interface TemplateStats {
  tank: { hp: number; mainStat: number; det: number; wd: number };
  other: { hp: number; mainStat: number; det: number; wd: number };
}
```

- [ ] **Step 3: levelModifiers.ts と defaultStats.ts の型定義を types/index.ts からのimportに変更**

`src/data/levelModifiers.ts`:
```typescript
import type { LevelModifier } from '../types';
// export interface LevelModifier {...} を削除
```

`src/data/defaultStats.ts`:
```typescript
import type { TemplateStats } from '../types';
// export interface TemplateStats {...} を削除
```

- [ ] **Step 4: useMasterDataStore にフィールドとアクションを追加**

```typescript
// MasterDataState に追加
interface MasterDataState {
  config: MasterConfig | null;
  contents: MasterContents | null;
  skills: MasterSkills | null;     // 追加
  stats: MasterStats | null;       // 追加
  ready: boolean;
  error: string | null;
  templateCache: Record<string, TemplateData>;

  setData: (config: MasterConfig, contents: MasterContents, skills?: MasterSkills | null, stats?: MasterStats | null) => void;
  setError: (error: string) => void;
  setTemplate: (contentId: string, data: TemplateData) => void;
}

// ストア本体の初期値に追加
skills: null,
stats: null,

// setData を修正
setData: (config, contents, skills = null, stats = null) =>
  set({ config, contents, skills, stats, ready: true, error: null }),
```

- [ ] **Step 5: localStorageキャッシュにskills/statsを追加**

```typescript
interface MasterCachePayload {
  version: number;
  config: MasterConfig;
  contents: MasterContents;
  skills: MasterSkills | null;   // 追加
  stats: MasterStats | null;     // 追加
}

export function saveMasterCache(
  version: number,
  config: MasterConfig,
  contents: MasterContents,
  skills: MasterSkills | null = null,
  stats: MasterStats | null = null,
): void {
  try {
    const payload: MasterCachePayload = { version, config, contents, skills, stats };
    localStorage.setItem(MASTER_CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[MasterData] localStorageへの保存に失敗:', e);
  }
}
```

- [ ] **Step 6: ビルド確認**

```bash
npx tsc --noEmit
```

エラーがないことを確認。

- [ ] **Step 7: コミット**

```bash
git add src/store/useMasterDataStore.ts src/types/index.ts src/data/levelModifiers.ts src/data/defaultStats.ts
git commit -m "feat: useMasterDataStore に skills/stats フィールド追加"
```

---

## Task 3: useMasterData フック拡張（skills/stats フェッチ）

**Files:**
- Modify: `src/hooks/useMasterData.ts`

- [ ] **Step 1: 静的フォールバック用のインポートを追加**

```typescript
// 既存のインポートに追加
import { JOBS, MITIGATIONS, MITIGATION_DISPLAY_ORDER } from '../data/mockData';
import { ALL_PATCH_STATS } from '../data/defaultStats';
import { LEVEL_MODIFIERS } from '../data/levelModifiers';
import type { MasterSkills, MasterStats } from '../store/useMasterDataStore';
```

- [ ] **Step 2: 静的スキル/ステータスビルド関数を追加**

```typescript
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
```

- [ ] **Step 3: useMasterDataInit のフェッチロジックを拡張**

`useMasterDataInit` 内の async 関数を修正。バージョン不一致時に skills と stats も取得:

```typescript
// バージョン不一致 → contents, skills, stats も取得
const [contentsSnap, skillsSnap, statsSnap] = await Promise.all([
  getDoc(doc(db, 'master', 'contents')),
  getDoc(doc(db, 'master', 'skills')),
  getDoc(doc(db, 'master', 'stats')),
]);

const remoteContents = contentsSnap.exists() ? contentsSnap.data() as MasterContents : buildStaticContents();
const remoteSkills = skillsSnap.exists() ? skillsSnap.data() as MasterSkills : buildStaticSkills();
const remoteStats = statsSnap.exists() ? statsSnap.data() as MasterStats : buildStaticStats();

saveMasterCache(remoteConfig.dataVersion, remoteConfig, remoteContents, remoteSkills, remoteStats);
setData(remoteConfig, remoteContents, remoteSkills, remoteStats);
```

バージョン一致時もキャッシュの skills/stats を setData に渡す:
```typescript
if (cached && cached.version === remoteConfig.dataVersion) {
  setData(cached.config, cached.contents, cached.skills ?? buildStaticSkills(), cached.stats ?? buildStaticStats());
  return;
}
```

フォールバック時も skills/stats を含める:
```typescript
// キャッシュフォールバック
setData(cached.config, cached.contents, cached.skills ?? buildStaticSkills(), cached.stats ?? buildStaticStats());

// 静的フォールバック
setData(buildStaticConfig(), buildStaticContents(), buildStaticSkills(), buildStaticStats());
```

- [ ] **Step 4: useMasterData の返り値に skills/stats を追加**

```typescript
export function useMasterData() {
  const config = useMasterDataStore((s) => s.config);
  const contents = useMasterDataStore((s) => s.contents);
  const skills = useMasterDataStore((s) => s.skills);
  const stats = useMasterDataStore((s) => s.stats);
  const ready = useMasterDataStore((s) => s.ready);
  return { config, contents, skills, stats, ready };
}
```

- [ ] **Step 5: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: コミット**

```bash
git add src/hooks/useMasterData.ts
git commit -m "feat: useMasterData で skills/stats をフェッチ + フォールバック"
```

---

## Task 4: useSkillsData ヘルパーフック作成

**Files:**
- Create: `src/hooks/useSkillsData.ts`

- [ ] **Step 1: ヘルパーフック作成**

コンポーネントが簡単にスキル・ステータスデータにアクセスするためのフック。
ストアからデータを取得し、まだ ready でない場合は静的ファイルをフォールバックとして返す。

```typescript
/**
 * スキル・ステータスデータへのアクセスフック
 * Firestoreから取得したデータを返し、未取得時は静的ファイルにフォールバック
 */
import { useMasterDataStore } from '../store/useMasterDataStore';
import type { Job, Mitigation, LevelModifier, TemplateStats } from '../types';
import { JOBS as STATIC_JOBS, MITIGATIONS as STATIC_MITIGATIONS, MITIGATION_DISPLAY_ORDER as STATIC_DISPLAY_ORDER, getMitigationPriority } from '../data/mockData';
import { DEFAULT_STATS_BY_LEVEL as STATIC_DEFAULT_STATS, ALL_PATCH_STATS as STATIC_ALL_PATCH_STATS } from '../data/defaultStats';
import { LEVEL_MODIFIERS as STATIC_LEVEL_MODIFIERS } from '../data/levelModifiers';

/** ジョブ一覧を取得 */
export function useJobs(): Job[] {
  const skills = useMasterDataStore((s) => s.skills);
  return skills?.jobs ?? STATIC_JOBS;
}

/** 軽減スキル一覧を取得 */
export function useMitigations(): Mitigation[] {
  const skills = useMasterDataStore((s) => s.skills);
  return skills?.mitigations ?? STATIC_MITIGATIONS;
}

/** 表示順配列を取得 */
export function useDisplayOrder(): string[] {
  const skills = useMasterDataStore((s) => s.skills);
  return skills?.displayOrder ?? STATIC_DISPLAY_ORDER;
}

/** レベル補正を取得 */
export function useLevelModifiers(): Record<number, LevelModifier> {
  const stats = useMasterDataStore((s) => s.stats);
  return stats?.levelModifiers ?? STATIC_LEVEL_MODIFIERS;
}

/** パッチ別ステータスを取得 */
export function usePatchStats(): Record<string, TemplateStats> {
  const stats = useMasterDataStore((s) => s.stats);
  return stats?.patchStats ?? STATIC_ALL_PATCH_STATS;
}

/** レベル別デフォルトステータスを取得 */
export function useDefaultStatsByLevel(): Record<number, TemplateStats> {
  const stats = useMasterDataStore((s) => s.stats);
  if (!stats) return STATIC_DEFAULT_STATS;
  // stats.defaultStatsByLevel は { 100: '7.40', 90: '6.40', ... } なので
  // patchStats と組み合わせてTemplateStatsに解決する
  const result: Record<number, TemplateStats> = {};
  for (const [level, patch] of Object.entries(stats.defaultStatsByLevel)) {
    const patchData = stats.patchStats[patch];
    if (patchData) result[Number(level)] = patchData;
  }
  return Object.keys(result).length > 0 ? result : STATIC_DEFAULT_STATS;
}

// ────────────────────────────────────────
// 非Reactコンテキスト用（ストア・ユーティリティ関数から使用）
// ────────────────────────────────────────

/** ストアから直接取得（React外で使用） */
export function getJobsFromStore(): Job[] {
  return useMasterDataStore.getState().skills?.jobs ?? STATIC_JOBS;
}

export function getMitigationsFromStore(): Mitigation[] {
  return useMasterDataStore.getState().skills?.mitigations ?? STATIC_MITIGATIONS;
}

export function getDisplayOrderFromStore(): string[] {
  return useMasterDataStore.getState().skills?.displayOrder ?? STATIC_DISPLAY_ORDER;
}

export function getLevelModifiersFromStore(): Record<number, LevelModifier> {
  return useMasterDataStore.getState().stats?.levelModifiers ?? STATIC_LEVEL_MODIFIERS;
}

export function getPatchStatsFromStore(): Record<string, TemplateStats> {
  return useMasterDataStore.getState().stats?.patchStats ?? STATIC_ALL_PATCH_STATS;
}

export function getDefaultStatsByLevelFromStore(): Record<number, TemplateStats> {
  const stats = useMasterDataStore.getState().stats;
  if (!stats) return STATIC_DEFAULT_STATS;
  const result: Record<number, TemplateStats> = {};
  for (const [level, patch] of Object.entries(stats.defaultStatsByLevel)) {
    const patchData = stats.patchStats[patch];
    if (patchData) result[Number(level)] = patchData;
  }
  return Object.keys(result).length > 0 ? result : STATIC_DEFAULT_STATS;
}

/** getMitigationPriority はデータ依存なしのためそのまま re-export */
export { getMitigationPriority };
```

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/hooks/useSkillsData.ts
git commit -m "feat: useSkillsData ヘルパーフック追加（ストア経由データアクセス）"
```

---

## Task 5: useMitigationStore の書き換え

**Files:**
- Modify: `src/store/useMitigationStore.ts`

これが最も重要で影響範囲の大きい変更。静的importをストア経由に置き換える。

- [ ] **Step 1: importを変更**

```typescript
// 削除:
// import { JOBS, MITIGATIONS } from '../data/mockData';
// import { LEVEL_MODIFIERS } from '../data/levelModifiers';
// import { DEFAULT_STATS_BY_LEVEL, ALL_PATCH_STATS } from '../data/defaultStats';

// 追加:
import {
  getJobsFromStore,
  getMitigationsFromStore,
  getLevelModifiersFromStore,
  getDefaultStatsByLevelFromStore,
  getPatchStatsFromStore,
} from '../hooks/useSkillsData';
```

- [ ] **Step 2: LEVEL_MODIFIERS[100].sub の参照を修正**

```typescript
// 変更前:
// const subBase100 = LEVEL_MODIFIERS[100].sub;

// 変更後: 関数化して遅延取得
const getSubBase = (level: number = 100) => {
  const mods = getLevelModifiersFromStore();
  return mods[level]?.sub ?? 420; // フォールバック値
};

const fillDefaultStats = (partial: any, level: number = 100): PlayerStats => ({
  ...partial,
  crt: getSubBase(level),
  ten: getSubBase(level),
  ss: getSubBase(level),
});
```

- [ ] **Step 3: DEFAULT_TANK_STATS / DEFAULT_HEALER_STATS を関数化**

```typescript
// 変更前（モジュールレベル定数）:
// export const DEFAULT_TANK_STATS = fillDefaultStats(DEFAULT_STATS_BY_LEVEL[100].tank);
// export const DEFAULT_HEALER_STATS = fillDefaultStats(DEFAULT_STATS_BY_LEVEL[100].other);

// 変更後: 関数化して呼び出し時にストアからデータ取得
export function getDefaultTankStats(level: number = 100): PlayerStats {
  const defaults = getDefaultStatsByLevelFromStore();
  return fillDefaultStats(defaults[level]?.tank ?? defaults[100]?.tank ?? { hp: 296194, mainStat: 6217, det: 2410, wd: 154 }, level);
}

export function getDefaultHealerStats(level: number = 100): PlayerStats {
  const defaults = getDefaultStatsByLevelFromStore();
  return fillDefaultStats(defaults[level]?.other ?? defaults[100]?.other ?? { hp: 186846, mainStat: 6317, det: 2987, wd: 154 }, level);
}

// 後方互換用のexport（既存コードが DEFAULT_TANK_STATS を参照している場合）
export const DEFAULT_TANK_STATS = getDefaultTankStats();
export const DEFAULT_HEALER_STATS = getDefaultHealerStats();
```

注意: `DEFAULT_TANK_STATS` をモジュールレベルで評価すると、ストアがまだ初期化されていない可能性がある。
しかし `useSkillsData.ts` は静的ファイルにフォールバックするので問題ない。

- [ ] **Step 4: INITIAL_PARTY の構築を修正**

INITIAL_PARTY もモジュールレベルなので同様にフォールバックで安全:

```typescript
const INITIAL_PARTY: PartyMember[] = [
  { id: 'MT', jobId: null, role: 'tank', stats: { ...getDefaultTankStats() }, computedValues: {} },
  { id: 'ST', jobId: null, role: 'tank', stats: { ...getDefaultTankStats() }, computedValues: {} },
  { id: 'H1', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {} },
  { id: 'H2', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {} },
  { id: 'D1', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
  { id: 'D2', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
  { id: 'D3', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
  { id: 'D4', jobId: null, role: 'dps', stats: { ...getDefaultHealerStats() }, computedValues: {} },
];
```

- [ ] **Step 5: applyDefaultStats アクションを修正**

```typescript
applyDefaultStats: (level, patch) => {
  const defaultsByLevel = getDefaultStatsByLevelFromStore();
  const patchStats = getPatchStatsFromStore();

  const templateStats = patch
    ? patchStats[patch]
    : defaultsByLevel[level];

  if (!templateStats) return;

  set(state => ({
    partyMembers: state.partyMembers.map(m => {
      const base = m.role === 'tank' ? templateStats.tank : templateStats.other;
      const stats = fillDefaultStats(base, level);
      return { ...m, stats, computedValues: calculateMemberValues({ ...m, stats }, level) };
    }),
  }));
},
```

- [ ] **Step 6: setMemberJob でJOBSの参照を修正**

ストア内で `JOBS` を使っている箇所を `getJobsFromStore()` に変更。
まず全ての `JOBS` 参照を確認し、`getJobsFromStore()` に置き換える。

- [ ] **Step 7: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: コミット**

```bash
git add src/store/useMitigationStore.ts
git commit -m "refactor: useMitigationStore を静的import → ストア経由に移行"
```

---

## Task 6: calculator.ts の書き換え

**Files:**
- Modify: `src/utils/calculator.ts`

- [ ] **Step 1: LEVEL_MODIFIERS の参照をストア経由に変更**

```typescript
// 削除:
// import { LEVEL_MODIFIERS } from '../data/levelModifiers';

// 追加:
import { getLevelModifiersFromStore } from '../hooks/useSkillsData';

// 使用箇所を全て変更:
// LEVEL_MODIFIERS[level] → getLevelModifiersFromStore()[level]
```

`calculator.ts` 内の `LEVEL_MODIFIERS` 使用箇所を全て `getLevelModifiersFromStore()` に置換する。
ただし、関数呼び出しのたびにストアにアクセスするのを避けるため、
各関数の冒頭で `const levelMods = getLevelModifiersFromStore();` として一度取得する。

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/utils/calculator.ts
git commit -m "refactor: calculator.ts の LEVEL_MODIFIERS をストア経由に移行"
```

---

## Task 7: autoPlanner.ts の書き換え

**Files:**
- Modify: `src/utils/autoPlanner.ts`

- [ ] **Step 1: 静的importをストア経由に変更**

```typescript
// 削除:
// import { MITIGATIONS, JOBS, getMitigationPriority } from '../data/mockData';

// 追加:
import { getMitigationsFromStore, getJobsFromStore, getMitigationPriority } from '../hooks/useSkillsData';
```

関数内の `MITIGATIONS` 参照を `getMitigationsFromStore()` に、`JOBS` を `getJobsFromStore()` に変更。

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/utils/autoPlanner.ts
git commit -m "refactor: autoPlanner.ts のスキルデータをストア経由に移行"
```

---

## Task 8: 残り全消費元コンポーネントの書き換え（一括）

**Files:**
- Modify: 以下のファイル全て

mockData.ts を import しているコンポーネント:
1. `src/components/PopularPage.tsx`
2. `src/components/TimelineRow.tsx`
3. `src/components/MitigationSelector.tsx`
4. `src/components/CheatSheetView.tsx`
5. `src/components/PartySettingsModal.tsx`
6. `src/components/Timeline.tsx`
7. `src/components/EventModal.tsx`
8. `src/components/Layout.tsx`
9. `src/components/JobPicker.tsx`
10. `src/components/ClearMitigationsPopover.tsx`
11. `src/store/useTutorialStore.ts`
12. `src/utils/resourceTracker.ts`
13. `src/utils/jobMigration.ts`
14. `src/components/FFLogsImportModal.tsx`

levelModifiers.ts を import しているコンポーネント:
15. `src/components/EventModal.tsx` （上と重複）
16. `src/components/PartyStatusPopover.tsx`
17. `src/debug_calc.ts`

**パターン:** 各ファイルで以下の置換を行う:

Reactコンポーネントの場合:
```typescript
// 削除: import { JOBS, MITIGATIONS, ... } from '../data/mockData';
// 追加: import { useJobs, useMitigations, ... } from '../hooks/useSkillsData';

// 関数コンポーネント内:
const jobs = useJobs();
const mitigations = useMitigations();
```

非Reactファイルの場合:
```typescript
// 削除: import { JOBS, MITIGATIONS, ... } from '../data/mockData';
// 追加: import { getJobsFromStore, getMitigationsFromStore, ... } from '../hooks/useSkillsData';
```

- [ ] **Step 1: 全ファイルのimport を一括書き換え**

各ファイルで:
1. `import { JOBS } from '../data/mockData'` → フック版 or ストア版に変更
2. `import { MITIGATIONS } from '../data/mockData'` → 同上
3. `import { MITIGATION_DISPLAY_ORDER } from '../data/mockData'` → 同上
4. `import { getMitigationPriority } from '../data/mockData'` → `useSkillsData` から re-export
5. `import { LEVEL_MODIFIERS } from '../data/levelModifiers'` → 同上
6. `import { DEFAULT_STATS_BY_LEVEL, ALL_PATCH_STATS } from '../data/defaultStats'` → 同上

Reactコンポーネントでは `useJobs()` / `useMitigations()` フックを使う。
非React関数では `getJobsFromStore()` / `getMitigationsFromStore()` を使う。

**重要:** JOBS, MITIGATIONS をコンポーネントのトップレベルで使っている場合（例: コンポーネント外の定数定義）は、
関数内に移動するか、`getJobsFromStore()` を使う。

- [ ] **Step 2: 各ファイルの具体的な変更**

各ファイルごとに何をimportしているかを確認し、適切な置換を行う。
以下は代表的なパターン:

**PopularPage.tsx** — `JOBS` を使用:
```typescript
// import { JOBS } from '../data/mockData'; を削除
import { useJobs } from '../hooks/useSkillsData';
// コンポーネント内: const jobs = useJobs();
// JOBS.find(...) → jobs.find(...)
```

**MitigationSelector.tsx** — `MITIGATIONS`, `JOBS`, `MITIGATION_DISPLAY_ORDER` を使用:
```typescript
import { useMitigations, useJobs, useDisplayOrder, getMitigationPriority } from '../hooks/useSkillsData';
```

**EventModal.tsx** — `LEVEL_MODIFIERS` を使用:
```typescript
import { useLevelModifiers } from '../hooks/useSkillsData';
// コンポーネント内: const levelModifiers = useLevelModifiers();
```

**PartyStatusPopover.tsx** — `LEVEL_MODIFIERS` を使用:
```typescript
import { useLevelModifiers } from '../hooks/useSkillsData';
```

**resourceTracker.ts** — 非Reactファイル:
```typescript
import { getMitigationsFromStore } from '../hooks/useSkillsData';
```

**jobMigration.ts** — 非Reactファイル:
```typescript
import { getMitigationsFromStore, getJobsFromStore } from '../hooks/useSkillsData';
```

**useTutorialStore.ts** — Zustandストア（非React）:
```typescript
import { getJobsFromStore } from '../hooks/useSkillsData';
```

**debug_calc.ts** — 非Reactファイル:
```typescript
import { getLevelModifiersFromStore } from '../hooks/useSkillsData';
```

- [ ] **Step 3: ビルド確認**

```bash
npx tsc --noEmit
```

全てのTypeScriptエラーを解消する。

- [ ] **Step 4: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザでアプリを開き、以下を確認:
- タイムラインが正常に表示される
- ジョブ選択ができる
- 軽減スキル選択が動作する
- オートプランが動作する
- ステータス変更が反映される

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "refactor: 全消費元ファイルのスキル・ステータス参照をストア経由に移行"
```

---

## Task 9: 管理API拡張（skills/stats CRUD）

**Files:**
- Modify: `api/admin/templates/index.ts`

既存の `?type=config` パターンに倣い、`?type=skills` と `?type=stats` を追加。

- [ ] **Step 1: GET ハンドラーに skills/stats を追加**

```typescript
// 既存の type=config 分岐の後に追加:

// GET ?type=skills — スキルデータ取得
if (type === 'skills') {
  const snap = await db.doc('master/skills').get();
  if (!snap.exists) return res.status(404).json({ error: 'Skills data not found' });
  return res.status(200).json(snap.data());
}

// GET ?type=stats — ステータスデータ取得
if (type === 'stats') {
  const snap = await db.doc('master/stats').get();
  if (!snap.exists) return res.status(404).json({ error: 'Stats data not found' });
  return res.status(200).json(snap.data());
}
```

- [ ] **Step 2: PUT ハンドラーに skills/stats を追加**

```typescript
// PUT type=skills — スキルデータ更新
if (type === 'skills') {
  const { jobs, mitigations, displayOrder } = req.body;

  // バリデーション
  if (!Array.isArray(jobs) || !Array.isArray(mitigations) || !Array.isArray(displayOrder)) {
    return res.status(400).json({ error: 'jobs, mitigations, displayOrder arrays are required' });
  }

  // バックアップ
  const current = await db.doc('master/skills').get();
  if (current.exists) {
    await db.collection('master_backups').doc(`skills_${Date.now()}`).set({
      type: 'skills',
      data: current.data(),
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 更新
  await db.doc('master/skills').set({ jobs, mitigations, displayOrder });
  await bumpDataVersion(db);

  await writeAuditLog(db, uid, 'skills.update', {
    jobCount: jobs.length,
    mitigationCount: mitigations.length,
  });

  return res.status(200).json({ success: true });
}

// PUT type=stats — ステータスデータ更新
if (type === 'stats') {
  const { levelModifiers, patchStats, defaultStatsByLevel } = req.body;

  if (!levelModifiers || !patchStats || !defaultStatsByLevel) {
    return res.status(400).json({ error: 'levelModifiers, patchStats, defaultStatsByLevel are required' });
  }

  // バックアップ
  const current = await db.doc('master/stats').get();
  if (current.exists) {
    await db.collection('master_backups').doc(`stats_${Date.now()}`).set({
      type: 'stats',
      data: current.data(),
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 更新
  await db.doc('master/stats').set({ levelModifiers, patchStats, defaultStatsByLevel });
  await bumpDataVersion(db);

  await writeAuditLog(db, uid, 'stats.update', {});

  return res.status(200).json({ success: true });
}
```

- [ ] **Step 3: ファイル先頭のJSDocコメントを更新**

```typescript
/**
 * テンプレート管理API + マスターデータ管理API（統合）
 * GET    /api/admin/templates              — 全テンプレート一覧
 * GET    /api/admin/templates?type=config  — マスターコンフィグ
 * GET    /api/admin/templates?type=skills  — スキルデータ
 * GET    /api/admin/templates?type=stats   — ステータスデータ
 * PUT    /api/admin/templates (type=config)— コンフィグ更新
 * PUT    /api/admin/templates (type=skills)— スキルデータ更新
 * PUT    /api/admin/templates (type=stats) — ステータスデータ更新
 * ...（既存のテンプレートCRUD）
 */
```

- [ ] **Step 4: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: コミット**

```bash
git add api/admin/templates/index.ts
git commit -m "feat: 管理APIに skills/stats CRUD を統合（Vercel関数制限対応）"
```

---

## Task 10: 管理画面 — スキル管理UI

**Files:**
- Create: `src/components/admin/AdminSkills.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: AdminLayout にナビゲーション追加**

```typescript
const NAV_ITEMS = [
  { path: '/admin', labelKey: 'admin.dashboard', end: true },
  { path: '/admin/contents', labelKey: 'admin.contents', end: false },
  { path: '/admin/templates', labelKey: 'admin.templates', end: false },
  { path: '/admin/skills', labelKey: 'admin.skills', end: false },       // 追加
  { path: '/admin/stats', labelKey: 'admin.stats', end: false },         // 追加
  { path: '/admin/config', labelKey: 'admin.config', end: false },
] as const;
```

- [ ] **Step 2: App.tsx にルート追加**

```typescript
import { AdminSkills } from './components/admin/AdminSkills';
import { AdminStats } from './components/admin/AdminStats';

// 管理画面ルート内に追加:
<Route path="skills" element={<AdminSkills />} />
<Route path="stats" element={<AdminStats />} />
```

- [ ] **Step 3: AdminSkills.tsx を作成**

スキル管理画面。ジョブ一覧とスキル一覧を表示し、編集できるUI。

構成:
- 左: ジョブ一覧（選択するとそのジョブのスキルを表示）
- 右: 選択中ジョブのスキル一覧（各スキルをクリックで展開→編集）
- 全体: 保存ボタン（変更をまとめてAPIに送信）

**白黒デザインルールに従う。** アクセントカラー不使用。

```typescript
/**
 * スキル管理画面
 * ジョブ一覧 → スキル一覧 → スキル詳細編集
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import type { Job, Mitigation } from '../../types';

interface SkillsData {
  jobs: Job[];
  mitigations: Mitigation[];
  displayOrder: string[];
}

export function AdminSkills() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingMitigation, setEditingMitigation] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // データ取得
  useEffect(() => {
    (async () => {
      try {
        const token = await user?.getIdToken();
        const res = await fetch('/api/admin/templates?type=skills', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('スキルデータ取得失敗:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!data || !user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/templates?type=skills', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setDirty(false);
        alert('保存しました');
      } else {
        alert('保存に失敗しました');
      }
    } catch (err) {
      console.error('保存失敗:', err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [data, user]);

  // スキル更新ハンドラー
  const updateMitigation = useCallback((id: string, updates: Partial<Mitigation>) => {
    if (!data) return;
    setData({
      ...data,
      mitigations: data.mitigations.map(m =>
        m.id === id ? { ...m, ...updates } : m
      ),
    });
    setDirty(true);
  }, [data]);

  if (loading) return <div className="text-app-text-muted text-sm">読み込み中...</div>;
  if (!data) return <div className="text-app-text-muted text-sm">データの取得に失敗しました</div>;

  const selectedJob = data.jobs.find(j => j.id === selectedJobId);
  const jobMitigations = data.mitigations.filter(m => m.jobId === selectedJobId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">{t('admin.skills', 'スキル管理')}</h1>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`px-4 py-1.5 text-xs border rounded transition-colors ${
            dirty
              ? 'border-app-text text-app-text hover:bg-app-text/10'
              : 'border-app-text/20 text-app-text/30 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* ジョブ一覧 */}
        <div className="w-48 flex-shrink-0">
          <div className="text-xs text-app-text-muted mb-2">ジョブ一覧 ({data.jobs.length})</div>
          <div className="flex flex-col gap-0.5">
            {data.jobs.map(job => (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`text-left px-3 py-1.5 text-xs rounded transition-colors ${
                  selectedJobId === job.id
                    ? 'bg-app-text/10 font-bold'
                    : 'hover:bg-app-text/5'
                }`}
              >
                {job.name.ja} ({job.id})
              </button>
            ))}
          </div>
        </div>

        {/* スキル一覧 */}
        <div className="flex-1">
          {selectedJob ? (
            <>
              <div className="text-xs text-app-text-muted mb-2">
                {selectedJob.name.ja} のスキル ({jobMitigations.length})
              </div>
              <div className="flex flex-col gap-1">
                {jobMitigations.map(m => (
                  <div key={m.id} className="border border-app-text/10 rounded">
                    <button
                      onClick={() => setEditingMitigation(editingMitigation === m.id ? null : m.id)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-app-text/5"
                    >
                      <span>{m.name.ja} ({m.id})</span>
                      <span className="text-app-text-muted">
                        {m.duration}s / {m.recast}s CD
                      </span>
                    </button>
                    {editingMitigation === m.id && (
                      <div className="px-3 py-3 border-t border-app-text/10 grid grid-cols-2 gap-2">
                        <label className="text-[10px] text-app-text-muted">
                          名前 (JA)
                          <input
                            type="text"
                            value={m.name.ja}
                            onChange={e => updateMitigation(m.id, { name: { ...m.name, ja: e.target.value } })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          />
                        </label>
                        <label className="text-[10px] text-app-text-muted">
                          名前 (EN)
                          <input
                            type="text"
                            value={m.name.en}
                            onChange={e => updateMitigation(m.id, { name: { ...m.name, en: e.target.value } })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          />
                        </label>
                        <label className="text-[10px] text-app-text-muted">
                          効果時間 (秒)
                          <input
                            type="number"
                            value={m.duration}
                            onChange={e => updateMitigation(m.id, { duration: Number(e.target.value) })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          />
                        </label>
                        <label className="text-[10px] text-app-text-muted">
                          リキャスト (秒)
                          <input
                            type="number"
                            value={m.recast}
                            onChange={e => updateMitigation(m.id, { recast: Number(e.target.value) })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          />
                        </label>
                        <label className="text-[10px] text-app-text-muted">
                          軽減率 (%)
                          <input
                            type="number"
                            value={m.value}
                            onChange={e => updateMitigation(m.id, { value: Number(e.target.value) })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          />
                        </label>
                        <label className="text-[10px] text-app-text-muted">
                          タイプ
                          <select
                            value={m.type}
                            onChange={e => updateMitigation(m.id, { type: e.target.value as Mitigation['type'] })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          >
                            <option value="all">all</option>
                            <option value="magical">magical</option>
                            <option value="physical">physical</option>
                          </select>
                        </label>
                        <label className="text-[10px] text-app-text-muted">
                          スコープ
                          <select
                            value={m.scope || 'self'}
                            onChange={e => updateMitigation(m.id, { scope: e.target.value as Mitigation['scope'] })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          >
                            <option value="self">self</option>
                            <option value="party">party</option>
                            <option value="target">target</option>
                          </select>
                        </label>
                        <label className="text-[10px] text-app-text-muted">
                          最小レベル
                          <input
                            type="number"
                            value={m.minLevel ?? ''}
                            onChange={e => updateMitigation(m.id, { minLevel: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full mt-0.5 px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-app-text-muted">左のジョブ一覧から選択してください</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: i18nキーを追加**

日本語・英語の翻訳ファイルに `admin.skills` と `admin.stats` キーを追加。
（翻訳ファイルの場所を確認して追加する）

- [ ] **Step 5: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: 開発サーバーで管理画面を確認**

```bash
npm run dev
```

`/admin/skills` にアクセスし、ジョブ一覧・スキル一覧が表示されることを確認。

- [ ] **Step 7: コミット**

```bash
git add src/components/admin/AdminSkills.tsx src/components/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat: スキル管理画面を追加（Phase 3）"
```

---

## Task 11: 管理画面 — ステータス管理UI

**Files:**
- Create: `src/components/admin/AdminStats.tsx`

- [ ] **Step 1: AdminStats.tsx を作成**

レベル補正値とパッチ別ステータスの編集画面。

```typescript
/**
 * ステータス管理画面
 * レベル補正値 + パッチ別デフォルトステータスの編集
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import type { LevelModifier, TemplateStats } from '../../types';

interface StatsData {
  levelModifiers: Record<number, LevelModifier>;
  patchStats: Record<string, TemplateStats>;
  defaultStatsByLevel: Record<number, string>;
}

export function AdminStats() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await user?.getIdToken();
        const res = await fetch('/api/admin/templates?type=stats', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('ステータスデータ取得失敗:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!data || !user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/templates?type=stats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) { setDirty(false); alert('保存しました'); }
      else alert('保存に失敗しました');
    } catch { alert('保存に失敗しました'); }
    finally { setSaving(false); }
  }, [data, user]);

  const updateLevelMod = useCallback((level: number, field: keyof LevelModifier, value: number) => {
    if (!data) return;
    setData({
      ...data,
      levelModifiers: {
        ...data.levelModifiers,
        [level]: { ...data.levelModifiers[level], [field]: value },
      },
    });
    setDirty(true);
  }, [data]);

  const updatePatchStat = useCallback((patch: string, role: 'tank' | 'other', field: string, value: number) => {
    if (!data) return;
    setData({
      ...data,
      patchStats: {
        ...data.patchStats,
        [patch]: {
          ...data.patchStats[patch],
          [role]: { ...data.patchStats[patch][role], [field]: value },
        },
      },
    });
    setDirty(true);
  }, [data]);

  if (loading) return <div className="text-app-text-muted text-sm">読み込み中...</div>;
  if (!data) return <div className="text-app-text-muted text-sm">データの取得に失敗しました</div>;

  const levels = Object.keys(data.levelModifiers).map(Number).sort((a, b) => b - a);
  const patches = Object.keys(data.patchStats).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">{t('admin.stats', 'ステータス管理')}</h1>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`px-4 py-1.5 text-xs border rounded transition-colors ${
            dirty ? 'border-app-text text-app-text hover:bg-app-text/10' : 'border-app-text/20 text-app-text/30 cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* レベル補正値 */}
      <section className="mb-8">
        <h2 className="text-sm font-bold mb-3">レベル補正値</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-app-text/10">
              <th className="text-left py-1 pr-2">レベル</th>
              <th className="text-left py-1 pr-2">main</th>
              <th className="text-left py-1 pr-2">sub</th>
              <th className="text-left py-1 pr-2">div</th>
              <th className="text-left py-1">hp</th>
            </tr>
          </thead>
          <tbody>
            {levels.map(level => {
              const mod = data.levelModifiers[level];
              return (
                <tr key={level} className="border-b border-app-text/5">
                  <td className="py-1 pr-2 font-mono">Lv{level}</td>
                  {(['main', 'sub', 'div', 'hp'] as const).map(field => (
                    <td key={field} className="py-1 pr-2">
                      <input
                        type="number"
                        value={mod[field]}
                        onChange={e => updateLevelMod(level, field, Number(e.target.value))}
                        className="w-20 px-1 py-0.5 bg-transparent border border-app-text/20 rounded text-xs"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* パッチ別ステータス */}
      <section>
        <h2 className="text-sm font-bold mb-3">パッチ別デフォルトステータス</h2>
        {patches.map(patch => {
          const ps = data.patchStats[patch];
          return (
            <div key={patch} className="mb-4 border border-app-text/10 rounded p-3">
              <div className="text-xs font-bold mb-2">パッチ {patch}</div>
              {(['tank', 'other'] as const).map(role => (
                <div key={role} className="flex gap-2 items-center mb-1">
                  <span className="text-[10px] text-app-text-muted w-10">{role === 'tank' ? 'Tank' : 'Other'}</span>
                  {(['hp', 'mainStat', 'det', 'wd'] as const).map(field => (
                    <label key={field} className="text-[10px] text-app-text-muted">
                      {field}
                      <input
                        type="number"
                        value={ps[role][field]}
                        onChange={e => updatePatchStat(patch, role, field, Number(e.target.value))}
                        className="w-20 ml-1 px-1 py-0.5 bg-transparent border border-app-text/20 rounded text-xs"
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 開発サーバーで確認**

`/admin/stats` にアクセスし、レベル補正値とパッチ別ステータスが表示されることを確認。

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/AdminStats.tsx
git commit -m "feat: ステータス管理画面を追加（Phase 3）"
```

---

## Task 12: Firestoreルール更新 + 全体動作確認

**Files:**
- Modify: `firestore.rules` （必要に応じて）

- [ ] **Step 1: Firestoreルールに skills/stats の読み取りルールを確認**

`/master/skills` と `/master/stats` は `/master/{docId}` パターンで既にカバーされているはず。
確認して、カバーされていなければルールを追加。

```
// 既存: match /master/{docId} の read ルールがあるか確認
match /master/{docId} {
  allow read: if true;  // 全ユーザーが読める
  allow write: if false; // API経由のみ（admin SDK）
}
```

- [ ] **Step 2: ビルド（本番ビルド確認）**

```bash
npm run build
```

ビルドエラーがないことを確認。

- [ ] **Step 3: 全体動作確認チェックリスト**

開発サーバーで以下を全て確認:

1. ☐ アプリ起動時にコンソールエラーがないこと
2. ☐ タイムラインが正常に表示される
3. ☐ ジョブ選択で全ジョブが表示される
4. ☐ 軽減スキル選択で全スキルが表示される
5. ☐ レベル変更でステータスが切り替わる
6. ☐ オートプランが正常に動作する
7. ☐ FFLogsインポートが動作する
8. ☐ 管理画面 `/admin/skills` でスキル一覧が表示される
9. ☐ 管理画面 `/admin/stats` でステータス一覧が表示される
10. ☐ 管理画面でスキル編集→保存が成功する
11. ☐ 管理画面でステータス編集→保存が成功する
12. ☐ 保存後にアプリをリロードすると変更が反映される

- [ ] **Step 4: Firestoreルールデプロイ（変更がある場合のみ）**

```bash
npx firebase deploy --only firestore:rules
```

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "feat: Phase 3 完了 — スキル・ステータスのFirestore化 + 管理画面"
```

---

## 補足: 各タスクの依存関係

```
Task 1 (シード) ─────────────────────────────────────────┐
Task 2 (ストア拡張) → Task 3 (フック拡張) → Task 4 (ヘルパー) ┤
                                                          ├→ Task 8 (全消費元書き換え) → Task 12 (動作確認)
Task 5 (ストア書き換え) ──────────────────────────────────┤
Task 6 (calculator) ──────────────────────────────────────┤
Task 7 (autoPlanner) ─────────────────────────────────────┤
Task 9 (管理API) → Task 10 (スキル管理UI) ────────────────┤
                 → Task 11 (ステータス管理UI) ─────────────┘
```

並列実行可能な組み合わせ:
- Task 1 と Task 2 は並列実行可能
- Task 5, 6, 7, 8 は Task 4 完了後に並列実行可能（ただし8は5,6,7と競合する可能性があるので最後）
- Task 9 は Task 2 完了後いつでも着手可能
- Task 10, 11 は Task 9 完了後に並列実行可能
