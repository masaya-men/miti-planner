# ゲームデータ翻訳 繁体字流し込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ジョブ名・軽減スキル名(190件)・コンテンツ名(64件)・コード内ラベル類(カテゴリ/レベル/プロジェクト13件+シリーズ名生成ロジック)に繁体字(zh-Hant)訳を追加し、専用スクリプトでFirestoreへ安全に書き込む。

**Architecture:** (1) Firestoreの現行データをCSVに書き出す → (2) 役割別に分担してzh-Hant列を個別調査・記入する → (3) 専用スクリプトでdry-run確認後、zh-HantフィールドのみをFirestoreへ書き込む → (4) コード内ハードコード分(ラベル・シリーズ名)を直接編集する → (5) 完全性・回帰テストで検証する。

**Tech Stack:** TypeScript, firebase-admin(サービスアカウント経由の直接書き込み), Node.js(tsx実行), Vitest。

## Global Constraints

- 対象は254件のFirestoreデータ(ジョブ名21・軽減スキル名169・コンテンツ名64)+コード内ラベル類のみ。攻撃名(timelineEvents)・フェーズ名は対象外(戦闘ログ由来の別運用、触らない)
- 公式ゲーム用語(ジョブ名・スキル名・コンテンツ名)は台湾版公式サイトを一次ソースとして個別調査する。一次ソースで確認できない場合のみ簡体字からの機械翻訳を仮置きし、`_UNVERIFIED_`のようなマーカーではなく通常の値を入れつつ、調査メモに「要確認」と明記する(Firestoreには通常の翻訳文字列のみを書き込み、マーカー文字列は絶対に書き込まない)
- Firestore書き込みは既存の `ja`/`en`/`zh`/`ko` フィールドを絶対に変更しない。`zh-Hant` フィールドの新規追加のみ
- コード変更(`src/data/contentRegistry.ts`)は worktree `.claude/worktrees/housing-taiwan-region-support`(ブランチ `worktree-housing-taiwan-region-support`)で行う。**このworktreeへの `cd` は自動継承されないため、各タスクで絶対パスに `cd` した上で `pwd` で確認すること**
- Firestore書き込みスクリプトはリポジトリ直下(worktreeではなくmain)の `scripts/` で作成・実行する(`.env.local` のサービスアカウント資格情報を使う既存スクリプト群と同じ場所)
- 本フェーズもpushはしない。5フェーズ全部完了後にまとめて本番反映する

---

### Task 1: 翻訳データ書き込みスクリプトの作成

**Files:**
- Create: `scripts/apply-zh-hant-translations.ts`
- Test: `scripts/__tests__/apply-zh-hant-translations.test.ts`

**Interfaces:**
- Consumes: CSVファイル(ヘッダー `ID,ja,en,zh,zh-Hant,ko` または `ID,ja,en,zh,zh-Hant,ko,job`/`,category` — 末尾の追加列は無視してよい)
- Produces: `applyTranslationsFromCsv(csvText: string, existingItems: Array<{ id: string; name: Record<string, string> }>) => { updated: Array<{ id: string; name: Record<string, string> }>; appliedCount: number; skippedIds: string[] }` という純粋関数(Firestore I/Oと分離してテストできるようにする)

このタスクは既存の `scripts/seed-contents.ts`(浅マージ方式)・`scripts/seed-skills-stats.ts`(ADDITIVEモード・`.env.local`読み込み・dry-run/force-overwriteのCLI引数パターン)を参考にする。

- [ ] **Step 1: 失敗するテストを書く**

`scripts/__tests__/apply-zh-hant-translations.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { applyTranslationsFromCsv } from '../apply-zh-hant-translations';

describe('applyTranslationsFromCsv', () => {
  const existingItems = [
    { id: 'pld', name: { ja: 'ナイト', en: 'Paladin', zh: '骑士', ko: '나이트' } },
    { id: 'war', name: { ja: '戦士', en: 'Warrior', zh: '战士', ko: '전사' } },
  ];

  it('CSVのzh-Hant列を該当idのnameオブジェクトに追加する', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\npld,ナイト,Paladin,骑士,騎士,나이트';
    const result = applyTranslationsFromCsv(csv, existingItems);
    const updatedPld = result.updated.find(i => i.id === 'pld');
    expect(updatedPld?.name['zh-Hant']).toBe('騎士');
    expect(result.appliedCount).toBe(1);
  });

  it('既存のja/en/zh/koフィールドは一切変更しない', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\npld,ナイト,Paladin,骑士,騎士,나이트';
    const result = applyTranslationsFromCsv(csv, existingItems);
    const updatedPld = result.updated.find(i => i.id === 'pld');
    expect(updatedPld?.name.ja).toBe('ナイト');
    expect(updatedPld?.name.en).toBe('Paladin');
    expect(updatedPld?.name.zh).toBe('骑士');
    expect(updatedPld?.name.ko).toBe('나이트');
  });

  it('zh-Hant列が空の行はスキップする(既存データを変更しない)', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\nwar,戦士,Warrior,战士,,전사';
    const result = applyTranslationsFromCsv(csv, existingItems);
    const updatedWar = result.updated.find(i => i.id === 'war');
    expect(updatedWar?.name['zh-Hant']).toBeUndefined();
    expect(result.appliedCount).toBe(0);
  });

  it('CSVに存在するがexistingItemsに無いidはskippedIdsに記録する', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\nunknown_id,x,x,x,テスト,x';
    const result = applyTranslationsFromCsv(csv, existingItems);
    expect(result.skippedIds).toContain('unknown_id');
    expect(result.appliedCount).toBe(0);
  });

  it('CSVに存在しない既存itemsはそのまま変更せず結果に含む', () => {
    const csv = 'ID,ja,en,zh,zh-Hant,ko\npld,ナイト,Paladin,骑士,騎士,나이트';
    const result = applyTranslationsFromCsv(csv, existingItems);
    expect(result.updated.find(i => i.id === 'war')).toEqual(existingItems[1]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `npx vitest run scripts/__tests__/apply-zh-hant-translations.test.ts`
Expected: FAIL(`apply-zh-hant-translations` モジュールが存在しない)

- [ ] **Step 3: 最小実装を書く**

`scripts/apply-zh-hant-translations.ts` を新規作成(先頭に純粋関数、末尾にCLIエントリポイント):

```typescript
/**
 * apply-zh-hant-translations.ts
 * 翻訳済みCSV(ID,ja,en,zh,zh-Hant,ko)を読み込み、Firestore の
 * master/skills(jobs[].name / mitigations[].name) または
 * master/contents(items[].name) の zh-Hant フィールドのみを更新する。
 * 既存の ja/en/zh/ko フィールドには一切触れない。
 *
 * 使い方:
 *   npx tsx scripts/apply-zh-hant-translations.ts --target=jobs --csv=path/to/jobs.csv --dry-run
 *   npx tsx scripts/apply-zh-hant-translations.ts --target=mitigations --csv=path/to/mitigations.csv --dry-run
 *   npx tsx scripts/apply-zh-hant-translations.ts --target=contents --csv=path/to/contents.csv --dry-run
 *   (--dry-run を外すと実際にFirestoreへ書き込む)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export interface NamedItem {
  id: string;
  name: Record<string, string>;
  [key: string]: unknown;
}

export interface ApplyResult {
  updated: NamedItem[];
  appliedCount: number;
  skippedIds: string[];
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cells.push(cur); cur = ''; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

export function applyTranslationsFromCsv(csvText: string, existingItems: NamedItem[]): ApplyResult {
  const text = csvText.replace(/^\uFEFF/, '').trim();
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const idIdx = header.indexOf('ID');
  const zhHantIdx = header.indexOf('zh-Hant');
  if (idIdx === -1 || zhHantIdx === -1) {
    throw new Error('CSVヘッダーに ID または zh-Hant 列がありません');
  }

  const zhHantById = new Map<string, string>();
  const skippedIds: string[] = [];
  const existingIds = new Set(existingItems.map(i => i.id));

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const id = cells[idIdx]?.trim();
    const zhHant = cells[zhHantIdx]?.trim();
    if (!id || !zhHant) continue;
    if (!existingIds.has(id)) { skippedIds.push(id); continue; }
    zhHantById.set(id, zhHant);
  }

  let appliedCount = 0;
  const updated = existingItems.map(item => {
    const zhHant = zhHantById.get(item.id);
    if (!zhHant) return item;
    appliedCount++;
    return { ...item, name: { ...item.name, 'zh-Hant': zhHant } };
  });

  return { updated, appliedCount, skippedIds };
}

// ─────────────────────────────────────────────
// CLI エントリポイント
// ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const target = args.find(a => a.startsWith('--target='))?.split('=')[1];
  const csvPath = args.find(a => a.startsWith('--csv='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  if (!target || !csvPath || !['jobs', 'mitigations', 'contents'].includes(target)) {
    console.error('使い方: npx tsx scripts/apply-zh-hant-translations.ts --target=jobs|mitigations|contents --csv=<path> [--dry-run]');
    process.exit(1);
  }

  function loadEnv(filePath: string): Record<string, string> {
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
    console.error('.env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore();

  const csvText = readFileSync(resolve(csvPath), 'utf-8');

  if (target === 'jobs' || target === 'mitigations') {
    const snap = await db.doc('master/skills').get();
    const data = snap.data() as { jobs: NamedItem[]; mitigations: NamedItem[]; displayOrder: string[] };
    const items = target === 'jobs' ? data.jobs : data.mitigations;
    const result = applyTranslationsFromCsv(csvText, items);
    console.log(`[${target}] 適用件数: ${result.appliedCount} / 未知ID: ${result.skippedIds.length}件 ${result.skippedIds.slice(0, 10).join(', ')}`);
    if (dryRun) { console.log('--dry-run のため書き込みません'); return; }
    const merged = target === 'jobs'
      ? { ...data, jobs: result.updated }
      : { ...data, mitigations: result.updated };
    await db.doc('master/skills').set(merged);
    console.log('master/skills に書き込みました');
  } else {
    const snap = await db.doc('master/contents').get();
    const data = snap.data() as { items: NamedItem[]; series: unknown[] };
    const result = applyTranslationsFromCsv(csvText, data.items);
    console.log(`[contents] 適用件数: ${result.appliedCount} / 未知ID: ${result.skippedIds.length}件 ${result.skippedIds.slice(0, 10).join(', ')}`);
    if (dryRun) { console.log('--dry-run のため書き込みません'); return; }
    await db.doc('master/contents').set({ ...data, items: result.updated });
    console.log('master/contents に書き込みました');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

Run: `npx vitest run scripts/__tests__/apply-zh-hant-translations.test.ts`
Expected: PASS(5件全て)

- [ ] **Step 5: コミット(リポジトリ直下、mainブランチ)**

```bash
git add scripts/apply-zh-hant-translations.ts scripts/__tests__/apply-zh-hant-translations.test.ts
git commit -m "feat: zh-Hant翻訳CSVをFirestoreへ安全に適用するスクリプトを追加"
```

---

### Task 2: ベースCSVのエクスポート

**Files:**
- Create: `docs/.private/2026-07-29-zh-hant-gamedata-csv/jobs.csv`
- Create: `docs/.private/2026-07-29-zh-hant-gamedata-csv/mitigations.csv`
- Create: `docs/.private/2026-07-29-zh-hant-gamedata-csv/contents.csv`
- Create(一時利用・完了後削除可): `scripts/_tmp-export-base-csv.ts`

**Interfaces:**
- Produces: 3つのCSVファイル(ヘッダー `ID,ja,en,zh,zh-Hant,ko` + mitigations/contentsは末尾に `job`/`category` 列を追加。`zh-Hant` 列は空欄)。Task 3〜6 はこれらのファイルの `zh-Hant` 列を埋める

`docs/.private/` はプロジェクトの `.gitignore` 対象(公開リポジトリに載せない前提の作業ファイル置き場)。

- [ ] **Step 1: エクスポートスクリプトを作成して実行**

`scripts/_tmp-export-base-csv.ts` を新規作成(この内容そのまま):

```typescript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadEnv(filePath: string): Record<string, string> {
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
const OUT_DIR = resolve(ROOT, 'docs/.private/2026-07-29-zh-hant-gamedata-csv');
mkdirSync(OUT_DIR, { recursive: true });

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('FIREBASE 認証情報が .env.local にありません');
  process.exit(1);
}
initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

function csvEscape(val: string | undefined): string {
  const v = val ?? '';
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function toRow(id: string, name: any, extra?: string): string {
  return [id, csvEscape(name?.ja), csvEscape(name?.en), csvEscape(name?.zh), '', csvEscape(name?.ko), csvEscape(extra)].join(',');
}

async function main() {
  const skillsSnap = await db.doc('master/skills').get();
  const skillsData = skillsSnap.data() as { jobs: any[]; mitigations: any[] };

  writeFileSync(resolve(OUT_DIR, 'jobs.csv'), '\uFEFF' + ['ID,ja,en,zh,zh-Hant,ko', ...skillsData.jobs.map(j => toRow(j.id, j.name))].join('\n'), 'utf-8');

  const jobNameMap = new Map(skillsData.jobs.map(j => [j.id, j.name.ja]));
  writeFileSync(
    resolve(OUT_DIR, 'mitigations.csv'),
    '\uFEFF' + ['ID,ja,en,zh,zh-Hant,ko,job', ...skillsData.mitigations.map(m => toRow(m.id, m.name, `${m.jobId}(${jobNameMap.get(m.jobId) ?? m.jobId})`))].join('\n'),
    'utf-8',
  );

  const contentsSnap = await db.doc('master/contents').get();
  const contentsData = contentsSnap.data() as { items: any[] };
  writeFileSync(
    resolve(OUT_DIR, 'contents.csv'),
    '\uFEFF' + ['ID,ja,en,zh,zh-Hant,ko,category', ...contentsData.items.map(item => toRow(item.id, item.name, item.category))].join('\n'),
    'utf-8',
  );

  console.log('出力完了:', OUT_DIR);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: 実行して3ファイルが生成されたことを確認**

Run: `npx tsx scripts/_tmp-export-base-csv.ts`
Expected: `docs/.private/2026-07-29-zh-hant-gamedata-csv/` に `jobs.csv`(21行+ヘッダー)・`mitigations.csv`(169行+ヘッダー)・`contents.csv`(64行+ヘッダー)が生成される

- [ ] **Step 3: 一時スクリプトを削除**

```bash
rm scripts/_tmp-export-base-csv.ts
```

(CSV自体は `docs/.private/` にgitignore対象として残す。コミット不要)

---

### Task 3: タンク職(pld/war/drk/gnb)のジョブ名・スキル名 繁体字調査

**Files:**
- Modify: `docs/.private/2026-07-29-zh-hant-gamedata-csv/jobs.csv`(該当4行の `zh-Hant` 列)
- Modify: `docs/.private/2026-07-29-zh-hant-gamedata-csv/mitigations.csv`(`job`列が `pld`/`war`/`drk`/`gnb` の行、計63件の `zh-Hant` 列)

**対象ジョブ:** ナイト(pld) / 戦士(war) / 暗黒騎士(drk) / ガンブレイカー(gnb)

**一次ソース:** 台湾版公式ジョブガイド `https://www.ffxiv.com.tw/web/intro/guide/battle/{job}/`(`{job}` は英語スラッグ。例: `paladin`/`warrior`/`darkknight`/`gunbreaker`。一覧起点は `https://www.ffxiv.com.tw/web/intro/guide/battle/` — スラッグが違う場合はここから該当ジョブへのリンクを辿る)

- [ ] **Step 1: 4ジョブ分のガイドページを取得し、ジョブ名・スキル名の繁体字表記を収集する**

`docs/.private/2026-07-29-zh-hant-gamedata-csv/jobs.csv` を開き、`ID` が `pld`/`war`/`drk`/`gnb` の4行を特定する。`docs/.private/2026-07-29-zh-hant-gamedata-csv/mitigations.csv` を開き、`job` 列が `pld(...)`/`war(...)`/`drk(...)`/`gnb(...)` の行(計63件)を特定する。各行の `ja` 列(日本語の正式名称)をキーに、公式ガイドページから対応する繁体字名を探す。

- [ ] **Step 2: 見つかった繁体字名を該当行の `zh-Hant` 列に書き込む**

CSVの列順は `ID,ja,en,zh,zh-Hant,ko` (mitigationsは末尾に`,job`が追加)。5列目(`zh-Hant`)のみを埋める。他の列(`ja`/`en`/`zh`/`ko`)は絶対に変更しない。カンマや引用符を含む値は他の行と同じCSVエスケープ(値を`"`で囲み、内部の`"`は`""`にする)に従う。

- [ ] **Step 3: 公式ガイドで見つからない項目の処理**

該当ジョブガイドページに載っていない項目(古いスキルの改名前の名前、UI専用の技名等)は、既存の `zh`(簡体字)列の値を字体変換した上で仮置きする。仮置きした行のIDを一覧化し、タスク完了報告に「要確認リスト」として含める(CSV自体には仮置きの通常値のみを書き、特殊なマーカー文字列は書かない)。

- [ ] **Step 4: 63+4=67件全てに `zh-Hant` 列が空欄でないことを確認**

Run(該当行の空欄チェック):
```bash
node -e "
const fs = require('fs');
for (const [file, jobFilter] of [['jobs.csv', id => ['pld','war','drk','gnb'].includes(id)], ['mitigations.csv', (id, row) => /^(pld|war|drk|gnb)\(/.test(row[6]||'')]]) {
  const text = fs.readFileSync('docs/.private/2026-07-29-zh-hant-gamedata-csv/' + file, 'utf-8').replace(/^\uFEFF/, '');
  const lines = text.trim().split('\n').slice(1);
  let empty = 0, total = 0;
  for (const line of lines) {
    const row = line.split(',');
    const id = row[0];
    const isTarget = file === 'jobs.csv' ? jobFilter(id) : jobFilter(id, row);
    if (!isTarget) continue;
    total++;
    if (!row[4]) empty++;
  }
  console.log(file, '対象', total, '件中', empty, '件が空欄');
}
"
```
Expected: 空欄0件(全て埋まっている)

- [ ] **Step 5: 完了報告**

このタスクはコミット不要(CSVは `docs/.private/` でgitignore対象、後続タスクがまとめて処理する)。完了報告に「要確認リスト」(Step 3で仮置きした行のID)を含めること。

---

### Task 4: ヒーラー職(whm/sch/ast/sge)のジョブ名・スキル名 繁体字調査

Task 3と全く同じ手順・同じ完全性チェック方法を、以下の対象で行う。

**対象ジョブ:** 白魔道士(whm) / 学者(sch) / 占星術師(ast) / 賢者(sge)
**対象件数:** ジョブ名4件 + スキル名(`job`列が `whm(...)`/`sch(...)`/`ast(...)`/`sge(...)`)72件 = 76件
**一次ソースURLスラッグ例:** `whitemage`/`scholar`/`astrologian`/`sage`

---

### Task 5: DPS職13種のジョブ名・スキル名 繁体字調査

Task 3と全く同じ手順・同じ完全性チェック方法を、以下の対象で行う。

**対象ジョブ:** モンク(mnk) / 竜騎士(drg) / 忍者(nin) / 侍(sam) / リーパー(rpr) / ヴァイパー(vpr) / 吟遊詩人(brd) / 機工士(mch) / 踊り子(dnc) / 黒魔道士(blm) / 召喚士(smn) / 赤魔道士(rdm) / ピクトマンサー(pct)
**対象件数:** ジョブ名13件 + スキル名(該当13ジョブの`job`列)34件 = 47件
**一次ソースURLスラッグ例:** `monk`/`dragoon`/`ninja`/`samurai`/`reaper`/`viper`/`bard`/`machinist`/`dancer`/`blackmage`/`summoner`/`redmage`/`pictomancer`

---

### Task 6: コンテンツ(ダンジョン・レイド)名 繁体字調査

**Files:**
- Modify: `docs/.private/2026-07-29-zh-hant-gamedata-csv/contents.csv`(64行全ての `zh-Hant` 列)

**対象:** `contents.csv` の全64件(ダンジョン・レイド・零式・絶等のコンテンツ名)

- [ ] **Step 1: 一次ソースを調査する**

台湾版公式サイト(`https://www.ffxiv.com.tw/`)内にダンジョン・レイド名の一覧・攻略ガイドページがないか確認する(ジョブガイドと同様のURL構造の可能性がある。無ければサイト内検索やWebSearchで探す)。見つからない場合は、台湾/香港のFF14プレイヤーコミュニティ(Wiki・攻略サイト)での繁体字表記を探す。

- [ ] **Step 2: 見つかった繁体字名を `zh-Hant` 列に書き込む**

`ja`(日本語正式名称)をキーに対応させる。`contents.csv` の列順は `ID,ja,en,zh,zh-Hant,ko,category`。5列目のみ埋める。

- [ ] **Step 3: 見つからない項目の処理**

一次ソースで確認できないコンテンツ名は、既存の `zh`(簡体字)列を字体変換して仮置きする。仮置きしたIDを完了報告に「要確認リスト」として含める。

- [ ] **Step 4: 64件全てに `zh-Hant` 列が空欄でないことを確認**

Run:
```bash
node -e "
const fs = require('fs');
const text = fs.readFileSync('docs/.private/2026-07-29-zh-hant-gamedata-csv/contents.csv', 'utf-8').replace(/^\uFEFF/, '');
const lines = text.trim().split('\n').slice(1);
const empty = lines.filter(l => !l.split(',')[4]).length;
console.log('contents.csv:', lines.length, '件中', empty, '件が空欄');
"
```
Expected: 空欄0件

- [ ] **Step 5: 完了報告**

コミット不要。「要確認リスト」を完了報告に含める。

---

### Task 7: 全CSVをFirestoreへ適用

**Files:**
- Read: `docs/.private/2026-07-29-zh-hant-gamedata-csv/jobs.csv`・`mitigations.csv`・`contents.csv`(Task 3〜6で全件`zh-Hant`が埋まっている前提)
- Use: `scripts/apply-zh-hant-translations.ts`(Task 1で作成済み)

**Interfaces:**
- Consumes: Task 1の `applyTranslationsFromCsv` とCLI

- [ ] **Step 1: 3ファイルとも空欄が無いことを再確認**

Run:
```bash
node -e "
const fs = require('fs');
for (const f of ['jobs.csv','mitigations.csv','contents.csv']) {
  const text = fs.readFileSync('docs/.private/2026-07-29-zh-hant-gamedata-csv/' + f, 'utf-8').replace(/^\uFEFF/, '');
  const lines = text.trim().split('\n').slice(1);
  const empty = lines.filter(l => !l.split(',')[4]).length;
  console.log(f, lines.length, '件中', empty, '件が空欄');
}
"
```
Expected: 3ファイルとも空欄0件

- [ ] **Step 2: dry-runで差分件数を確認(jobs → mitigations → contents の順)**

Run:
```bash
npx tsx scripts/apply-zh-hant-translations.ts --target=jobs --csv=docs/.private/2026-07-29-zh-hant-gamedata-csv/jobs.csv --dry-run
npx tsx scripts/apply-zh-hant-translations.ts --target=mitigations --csv=docs/.private/2026-07-29-zh-hant-gamedata-csv/mitigations.csv --dry-run
npx tsx scripts/apply-zh-hant-translations.ts --target=contents --csv=docs/.private/2026-07-29-zh-hant-gamedata-csv/contents.csv --dry-run
```
Expected: 適用件数がそれぞれ21/169/64、未知ID 0件

- [ ] **Step 3: 差分件数が想定通りであることをユーザー(または実装担当)が確認した上で、`--dry-run`を外して実行**

Run:
```bash
npx tsx scripts/apply-zh-hant-translations.ts --target=jobs --csv=docs/.private/2026-07-29-zh-hant-gamedata-csv/jobs.csv
npx tsx scripts/apply-zh-hant-translations.ts --target=mitigations --csv=docs/.private/2026-07-29-zh-hant-gamedata-csv/mitigations.csv
npx tsx scripts/apply-zh-hant-translations.ts --target=contents --csv=docs/.private/2026-07-29-zh-hant-gamedata-csv/contents.csv
```

- [ ] **Step 4: 書き込み後、読み取り専用スクリプトで反映確認**

`master/skills`・`master/contents` を再読込し、`jobs`(21件)・`mitigations`(169件)・`contents`(64件)全てに `name['zh-Hant']` が存在すること、かつ `ja`/`en`/`zh`/`ko` が書き込み前と一致していることを確認する。

- [ ] **Step 5: コミット不要(Firestoreへの書き込みでありgit管理対象外)。完了報告に適用件数を記録する**

---

### Task 8: contentRegistry.ts のコード直書き分にzh-Hantを追加

**Files:**
- Modify: `src/data/contentRegistry.ts:15-34`(`STATIC_CATEGORY_LABELS`/`STATIC_LEVEL_LABELS`/`STATIC_PROJECT_LABELS`)
- Modify: `src/data/contentRegistry.ts` の `getSeriesMetadata` 関数(シリーズ名・略称のzh-Hant計算を追加)
- Test: `src/data/__tests__/contentRegistry.zh-hant.test.ts`(新規)

**作業ディレクトリ:** `.claude/worktrees/housing-taiwan-region-support`(絶対パスで `cd` すること。worktree切替はサブエージェントに引き継がれない)

**Interfaces:**
- Consumes: なし(既存コードのみ)
- Produces: `CATEGORY_LABELS`/`LEVEL_LABELS`/`PROJECT_LABELS`/`CONTENT_SERIES`/`CONTENT_DEFINITIONS`の各エントリの`name`(および該当する場合`shortName`)に`'zh-Hant'`キーが追加される

- [ ] **Step 1: 作業ディレクトリを確認**

Run:
```bash
cd "c:/Users/masay/Desktop/FF14Sim/.claude/worktrees/housing-taiwan-region-support" && pwd
```
Expected: `.claude/worktrees/housing-taiwan-region-support` で終わるパスが表示される

- [ ] **Step 2: 失敗するテストを書く**

`src/data/__tests__/contentRegistry.zh-hant.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { CATEGORY_LABELS, LEVEL_LABELS, PROJECT_LABELS, getContentDefinitions, CONTENT_SERIES } from '../contentRegistry';

describe('contentRegistry zh-Hant対応', () => {
  it('CATEGORY_LABELSの全エントリにzh-Hantがある', () => {
    for (const [key, value] of Object.entries(CATEGORY_LABELS)) {
      expect(value['zh-Hant'], `category ${key}`).toBeTruthy();
    }
  });

  it('LEVEL_LABELSの全エントリにzh-Hantがある', () => {
    for (const [key, value] of Object.entries(LEVEL_LABELS)) {
      expect(value['zh-Hant'], `level ${key}`).toBeTruthy();
    }
  });

  it('PROJECT_LABELSの全エントリにzh-Hantがある', () => {
    for (const [key, value] of Object.entries(PROJECT_LABELS)) {
      expect(value['zh-Hant'], `project ${key}`).toBeTruthy();
    }
  });

  it('CONTENT_SERIESの全エントリのnameにzh-Hantがある(空文字許容の絶シリーズを除く)', () => {
    for (const series of CONTENT_SERIES) {
      if (series.name.zh === '') continue; // 絶シリーズ(1フロアのみ)はzh自体が空なので対象外
      expect(series.name['zh-Hant'], `series ${series.id}`).toBeTruthy();
    }
  });

  it('全コンテンツ定義のshortNameにzh-Hantがある', () => {
    const items = getContentDefinitions();
    for (const item of items) {
      expect(item.shortName?.['zh-Hant'], `content ${item.id} shortName`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 3: テストを実行して失敗することを確認**

Run: `npx vitest run src/data/__tests__/contentRegistry.zh-hant.test.ts`
Expected: FAIL(`zh-Hant`キーが無いため)

- [ ] **Step 4: `STATIC_CATEGORY_LABELS`/`STATIC_LEVEL_LABELS`/`STATIC_PROJECT_LABELS` にzh-Hantを追加**

`src/data/contentRegistry.ts:15-34` の各オブジェクトに、既存の `zh`/`ko` と同じ並びで `'zh-Hant'` を追加する。値は簡体字からの機械的な字体変換をベースに、違和感があれば個別修正する(例: `savage: { ja: '零式', en: 'Savage', zh: '零式', 'zh-Hant': '零式', ko: '영식' }`)。全13箇所(5+4+4)を同じパターンで追加する。

- [ ] **Step 5: `getSeriesMetadata` 関数にzh-Hant計算を追加**

`getSeriesMetadata` の戻り値型に `seriesZhHant: string` と `shortZhHant: string` を追加し、既存の `seriesZh`/`shortZh` の計算ロジック(簡体字ベースの文字列生成)と並行して、繁体字版の生成ロジックを追加する。関数呼び出し元(`name: { ja: rc.ja, en: rc.en, zh: rc.zh, ko: rc.ko }` 等、L129-130・L149-150付近)にも `'zh-Hant': rc['zh-Hant'] ?? seriesZhHant` のように既存パターンに倣って追加する。`RawContentData` 型(`src/data/contents.ts`)にも `'zh-Hant'?: string;` を追加しておく(型の完全性のため。値は空のままでよい)。

- [ ] **Step 6: テストを実行して通ることを確認**

Run: `npx vitest run src/data/__tests__/contentRegistry.zh-hant.test.ts`
Expected: PASS(5件全て)

- [ ] **Step 7: コミット(worktree内)**

```bash
cd "c:/Users/masay/Desktop/FF14Sim/.claude/worktrees/housing-taiwan-region-support"
git add src/data/contentRegistry.ts src/data/contents.ts src/data/__tests__/contentRegistry.zh-hant.test.ts
git commit -m "feat: contentRegistry.tsのラベル・シリーズ名・略称にzh-Hantを追加"
```

---

### Task 9: フルゲート検証

**Files:** なし(検証のみ)

- [ ] **Step 1: worktreeでビルドを実行**

Run:
```bash
cd "c:/Users/masay/Desktop/FF14Sim/.claude/worktrees/housing-taiwan-region-support" && npm run build
```
Expected: エラー無く成功

- [ ] **Step 2: worktreeで全テストを実行**

Run:
```bash
cd "c:/Users/masay/Desktop/FF14Sim/.claude/worktrees/housing-taiwan-region-support" && npx vitest run
```
Expected: 既存テスト+Task 1・Task 8で追加したテストが全てPASS

- [ ] **Step 3: リポジトリ直下(main)でも新規スクリプトのテストを実行**

Run:
```bash
cd "c:/Users/masay/Desktop/FF14Sim" && npx vitest run scripts/__tests__/apply-zh-hant-translations.test.ts
```
Expected: PASS

- [ ] **Step 4: Firestoreの完全性を再確認(Task 7 Step 4の再実行)**

Task 7 Step 4のスクリプトを再実行し、jobs(21)/mitigations(169)/contents(64)全件に`zh-Hant`が存在することを確認する。

---

### Task 10: TODO.md更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 「現在の状態」セクションをフェーズ⑤完了に更新**

フェーズ⑤(ゲームデータ翻訳流し込み)が完了し、①〜⑤全フェーズが実装完了したこと、次は本番反映(push・デプロイ)の判断待ちであることを追記する。

- [ ] **Step 2: 100行以内であることを確認**

Run: `wc -l docs/TODO.md`
Expected: 100行以内(超過していたら完了済み項目をTODO_COMPLETED.mdへ移動して整理)

- [ ] **Step 3: コミット(main)**

```bash
cd "c:/Users/masay/Desktop/FF14Sim"
git add docs/TODO.md
git commit -m "docs: フェーズ⑤(ゲームデータ翻訳流し込み)完了をTODOに反映"
```
