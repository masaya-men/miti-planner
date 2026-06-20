# 管理画面 FFLogs タイムライン取り込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面のテンプレートエディターに FFLogs URL から直接タイムラインを取り込む機能（置き換え／追記の 2 モード）を新設する。

**Architecture:** FFLogs の取得シーケンスと URL 解析を純粋な共通部品（`src/lib/fflogs/`）へ抽出し、既存ユーザー側 `FFLogsImportModal` と新設する管理画面モーダルが共用する。ストア `useMitigationStore.importTimelineEvents` には一切触れず、テンプレ用のフェーズ追記は独立した純粋関数で実装する。

**Tech Stack:** React + TypeScript（strict, tsc -b）、Zustand、react-i18next、vitest（pool=vmThreads）、Vite。

**Spec:** `docs/superpowers/specs/2026-06-20-admin-fflogs-import-design.md`（多エージェント監査反映の決定版）

## Global Constraints

- **既存ユーザー側（軽減表編集）の FFLogs 取り込み挙動を 1 ミリも変えない。** 共有するのは「取得シーケンス」と「URL 解析」と副作用ゼロの純粋関数のみ。レート制限・ログインガード・進捗表示・エラー処理・auto-register・preview ペイロード・受理 URL 集合はモーダル側に残し現状維持。
- **ストア `src/store/useMitigationStore.ts` と `src/utils/importModes.ts` は改変しない**（`resolveImportEvents` は読み取り利用のみ）。
- **回帰ゲート（無改変で緑のまま＝完了条件）**: `src/utils/__tests__/importModes.test.ts`、`src/store/__tests__/useMitigationStore.importModes.test.ts`、`src/store/__tests__/useMitigationStore.collab.test.ts`。
- **取得シーケンスの不変条件**: `resolveFight(reportId, fightId)` → `fetchPlayerDetails(reportId, fight.id)`（第 2 引数は `fight.id`=number）→ `Promise.all` で 5 本並列 `[fetchFightEvents(false), fetchFightEvents(true), fetchDeathEvents, fetchCastEvents(true), fetchCastEvents(false)]` → 分解 `[eventsJp, eventsEn, deaths, castEn, castJp]` → `mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths, castEn, castJp, players)`。**この順序・translate フラグ・引数順を一字一句変えない**（en/jp 取り違えは技名を無言で逆転させる）。
- **mapped.labels を editor に渡さない**（`Label[]` と `TemplateLabel[]` は型非互換・`as any` 禁止）。
- **新規 i18n キーは `admin.tpl_fflogs_import_*`**（既存 `admin.tpl_fflogs_*` は翻訳専用で意味衝突）。4 言語（ja/en/ko/zh）必須・en 表示崩れなし。
- **型 import は `import type`**（tsc -b 厳密・`erasableSyntaxOnly` 対応）。push 前に `npm run build` 必須（[[feedback_vercel_tsc_strict]]）。
- vitest は `pool='vmThreads'` 必須（`vitest.config.ts:33`・削除厳禁）。実行は `npm run test`（=vitest run）。
- ブランチ `feat/admin-fflogs-import`（作成済み）で作業。各タスク完了ごとにコミット。

---

## File Structure

| ファイル | 区分 | 責務 |
|---|---|---|
| `src/lib/fflogs/parseFflogsUrl.ts` | 新規 | FFLogs URL → `{reportId, fightId}` 解析（純粋・ユーザー側 regex 正本） |
| `src/lib/fflogs/fetchAndMapFflogs.ts` | 新規 | 取得シーケンス共通関数（onProgress・throw 透過・MapperResult 返却） |
| `src/utils/templateImportPhases.ts` | 新規 | テンプレ用フェーズ追記純粋関数 |
| `src/components/admin/FflogsTimelineImportModal.tsx` | 新規 | 管理画面の取り込みモーダル（URL→preview→mode→onImport） |
| `src/components/FFLogsImportModal.tsx` | 改変 | `handleUrlChange`/`handleFetch` を共通関数呼び出しへ差し替え（挙動不変） |
| `src/components/admin/AdminTemplates.tsx` | 改変 | モーダル配線 ＋ `handleFflogsTimelineImport` |
| `src/components/admin/TemplateEditorToolbar.tsx` | 改変 | 「FFLogs 取り込み」ボタン追加 |
| `src/locales/{ja,en,ko,zh}.json` | 改変 | `admin.tpl_fflogs_import_*` キー追加 |

テスト: `src/lib/fflogs/__tests__/parseFflogsUrl.test.ts`、`src/lib/fflogs/__tests__/fetchAndMapFflogs.test.ts`、`src/utils/__tests__/templateImportPhases.test.ts`。

---

## Task 1: parseFflogsUrl（URL 解析純粋関数の抽出）

**Files:**
- Create: `src/lib/fflogs/parseFflogsUrl.ts`
- Test: `src/lib/fflogs/__tests__/parseFflogsUrl.test.ts`
- Modify: `src/components/FFLogsImportModal.tsx:80-100`（`handleUrlChange` を差し替え）

**Interfaces:**
- Produces: `parseFflogsUrl(url: string): { reportId: string; fightId: string | null } | null`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/fflogs/__tests__/parseFflogsUrl.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseFflogsUrl } from '../parseFflogsUrl';

describe('parseFflogsUrl', () => {
  it('reports コード + ?fight=数値 を抽出する', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234?fight=5'))
      .toEqual({ reportId: 'aBcd1234', fightId: '5' });
  });
  it('#fight=数値 も抽出する', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234#fight=12'))
      .toEqual({ reportId: 'aBcd1234', fightId: '12' });
  });
  it('fight 指定なしは fightId=null', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234'))
      .toEqual({ reportId: 'aBcd1234', fightId: null });
  });
  it('fight=last など非数値も現ユーザー側どおり許容する', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234?fight=last'))
      .toEqual({ reportId: 'aBcd1234', fightId: 'last' });
  });
  it('クエリが続く場合 fightId のみ抽出（& で打ち切り）', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234?fight=3&type=damage'))
      .toEqual({ reportId: 'aBcd1234', fightId: '3' });
  });
  it('reports セグメントが無ければ null', () => {
    expect(parseFflogsUrl('https://example.com/foo')).toBeNull();
  });
  it('空文字は null', () => {
    expect(parseFflogsUrl('')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- parseFflogsUrl`
Expected: FAIL（`parseFflogsUrl` が解決できない / モジュール無し）

- [ ] **Step 3: 実装する**

`src/lib/fflogs/parseFflogsUrl.ts`:

```ts
/**
 * FFLogs レポート URL から reportId と fightId を抽出する純粋関数。
 * ユーザー側 FFLogsImportModal.handleUrlChange（旧 L89-90）の正規表現をそのまま正本として再現する。
 * 受理 URL 集合を狭めないため、管理側 FflogsTranslationModal の厳しい正規表現には寄せない。
 */
export function parseFflogsUrl(
  url: string,
): { reportId: string; fightId: string | null } | null {
  const reportMatch = url.match(/reports\/([a-zA-Z0-9]+)/);
  if (!reportMatch || !reportMatch[1]) return null;
  const fightMatch = url.match(/[#?]fight=([^&]+)/);
  return { reportId: reportMatch[1], fightId: fightMatch ? fightMatch[1] : null };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- parseFflogsUrl`
Expected: PASS（7 ケース）

- [ ] **Step 5: ユーザー側 `handleUrlChange` を差し替え（挙動不変）**

`src/components/FFLogsImportModal.tsx` の import に追加:

```ts
import { parseFflogsUrl } from '../lib/fflogs/parseFflogsUrl';
```

`handleUrlChange`（現 L80-100）の正規表現ブロックを置換。最終形:

```ts
    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        setUrlError(null);
        setParsedData(null);
        setStatus({ phase: 'idle' });

        if (!newUrl.trim()) return;

        const parsed = parseFflogsUrl(newUrl);
        if (parsed) {
            setParsedData(parsed);
        } else {
            setUrlError(t('fflogs.invalid_url'));
        }
    };
```

- [ ] **Step 6: ビルドと回帰確認**

Run: `npm run build`
Expected: tsc -b エラーなし（未使用 import なし）

Run: `npm run test -- parseFflogsUrl`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
rtk git add src/lib/fflogs/parseFflogsUrl.ts src/lib/fflogs/__tests__/parseFflogsUrl.test.ts src/components/FFLogsImportModal.tsx
rtk git commit -m "refactor(fflogs): URL解析をparseFflogsUrl純粋関数へ抽出（ユーザー側挙動不変）"
```

---

## Task 2: fetchAndMapFflogs（取得シーケンスの抽出）

**Files:**
- Create: `src/lib/fflogs/fetchAndMapFflogs.ts`
- Test: `src/lib/fflogs/__tests__/fetchAndMapFflogs.test.ts`
- Modify: `src/components/FFLogsImportModal.tsx:102-138`（`handleFetch` を差し替え）

**Interfaces:**
- Consumes: `src/api/fflogs` の `resolveFight` / `fetchPlayerDetails` / `fetchFightEvents` / `fetchDeathEvents` / `fetchCastEvents`、`src/utils/fflogsMapper` の `mapFFLogsToTimeline`、型 `FFLogsFight` / `FFLogsRawEvent`（api/fflogs）/ `MapperResult`（fflogsMapper）。
- Produces:
  - `type FflogsFetchPhase = 'resolving' | 'fetching_players' | 'fetching' | 'mapping'`
  - `fetchAndMapFflogs(reportId: string, fightId: string | null, onProgress?: (phase: FflogsFetchPhase, ctx?: { name?: string }) => void): Promise<{ fight: FFLogsFight; events: FFLogsRawEvent[]; mapped: MapperResult }>`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/fflogs/__tests__/fetchAndMapFflogs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAndMapFflogs } from '../fetchAndMapFflogs';
import * as fflogsApi from '../../../api/fflogs';
import * as mapper from '../../../utils/fflogsMapper';

vi.mock('../../../api/fflogs');
vi.mock('../../../utils/fflogsMapper');

const fight = { id: 7, startTime: 0, endTime: 1000, name: 'Boss' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fflogsApi.resolveFight).mockResolvedValue(fight as any);
  vi.mocked(fflogsApi.fetchPlayerDetails).mockResolvedValue({ tanks: [], healers: [], dps: [] } as any);
  vi.mocked(fflogsApi.fetchFightEvents).mockImplementation(async (_r, _f, translate) =>
    (translate ? [{ marker: 'EN' }] : [{ marker: 'JP' }]) as any);
  vi.mocked(fflogsApi.fetchDeathEvents).mockResolvedValue([{ marker: 'DEATH' }] as any);
  vi.mocked(fflogsApi.fetchCastEvents).mockImplementation(async (_r, _f, translate) =>
    (translate ? [{ marker: 'CAST_EN' }] : [{ marker: 'CAST_JP' }]) as any);
  vi.mocked(mapper.mapFFLogsToTimeline).mockReturnValue(
    { events: [], phases: [], labels: [], stats: { isEnglishOnly: false } } as any,
  );
});

describe('fetchAndMapFflogs', () => {
  it('resolveFight に (reportId, fightId) を渡す', async () => {
    await fetchAndMapFflogs('rep', '3');
    expect(fflogsApi.resolveFight).toHaveBeenCalledWith('rep', '3');
  });
  it('fetchPlayerDetails には resolveFight の fight.id(number) を渡す', async () => {
    await fetchAndMapFflogs('rep', '3');
    expect(fflogsApi.fetchPlayerDetails).toHaveBeenCalledWith('rep', 7);
  });
  it('mapFFLogsToTimeline へ (eventsEn, eventsJp, fight, deaths, castEn, castJp, players) の順で渡す', async () => {
    await fetchAndMapFflogs('rep', '3');
    const args = vi.mocked(mapper.mapFFLogsToTimeline).mock.calls[0];
    expect(args[0]).toEqual([{ marker: 'EN' }]);    // eventsEn (translate=true)
    expect(args[1]).toEqual([{ marker: 'JP' }]);    // eventsJp (translate=false)
    expect(args[2]).toBe(fight);
    expect(args[3]).toEqual([{ marker: 'DEATH' }]);
    expect(args[4]).toEqual([{ marker: 'CAST_EN' }]); // castEn (translate=true)
    expect(args[5]).toEqual([{ marker: 'CAST_JP' }]); // castJp (translate=false)
  });
  it('戻り値 events は eventsEn', async () => {
    const { events } = await fetchAndMapFflogs('rep', '3');
    expect(events).toEqual([{ marker: 'EN' }]);
  });
  it('onProgress が resolving→fetching_players→fetching(name)→mapping の順で発火', async () => {
    const calls: Array<[string, unknown]> = [];
    await fetchAndMapFflogs('rep', '3', (p, ctx) => calls.push([p, ctx]));
    expect(calls).toEqual([
      ['resolving', undefined],
      ['fetching_players', undefined],
      ['fetching', { name: 'Boss' }],
      ['mapping', undefined],
    ]);
  });
  it('throw を透過する（内部で握らない）', async () => {
    vi.mocked(fflogsApi.resolveFight).mockRejectedValue(new Error('boom'));
    await expect(fetchAndMapFflogs('rep', '3')).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- fetchAndMapFflogs`
Expected: FAIL（モジュール無し）

- [ ] **Step 3: 実装する（handleFetch L113-131 を setStatus 抜きで逐語移植）**

`src/lib/fflogs/fetchAndMapFflogs.ts`:

```ts
import {
  resolveFight,
  fetchFightEvents,
  fetchDeathEvents,
  fetchCastEvents,
  fetchPlayerDetails,
} from '../../api/fflogs';
import type { FFLogsFight, FFLogsRawEvent } from '../../api/fflogs';
import { mapFFLogsToTimeline } from '../../utils/fflogsMapper';
import type { MapperResult } from '../../utils/fflogsMapper';

export type FflogsFetchPhase = 'resolving' | 'fetching_players' | 'fetching' | 'mapping';

/**
 * FFLogs レポートを取得してタイムラインへ変換する共通シーケンス。
 * FFLogsImportModal.handleFetch（旧 L113-131）の取得本体を setStatus を除いて逐語移植したもの。
 * - throw は透過（内部に try/catch を持たない）。呼び出し側が捕捉してエラー表示に落とす。
 * - 進捗は onProgress で通知（t()/setStatus は呼び出し側に残す）。
 * - Promise.all の 5 要素の順序・translate フラグ・分解先・map の引数順は絶対に変えない
 *   （en/jp や cast の translate を取り違えると技名が無言で逆転する）。
 */
export async function fetchAndMapFflogs(
  reportId: string,
  fightId: string | null,
  onProgress?: (phase: FflogsFetchPhase, ctx?: { name?: string }) => void,
): Promise<{ fight: FFLogsFight; events: FFLogsRawEvent[]; mapped: MapperResult }> {
  onProgress?.('resolving');
  const fight = await resolveFight(reportId, fightId);

  onProgress?.('fetching_players');
  const players = await fetchPlayerDetails(reportId, fight.id);

  onProgress?.('fetching', { name: fight.name });
  const [eventsJp, eventsEn, deaths, castEn, castJp] = await Promise.all([
    fetchFightEvents(reportId, fight, false),
    fetchFightEvents(reportId, fight, true),
    fetchDeathEvents(reportId, fight),
    fetchCastEvents(reportId, fight, true),
    fetchCastEvents(reportId, fight, false),
  ]);

  onProgress?.('mapping');
  const mapped = mapFFLogsToTimeline(eventsEn, eventsJp, fight, deaths, castEn, castJp, players);

  return { fight, events: eventsEn, mapped };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- fetchAndMapFflogs`
Expected: PASS（6 ケース）

- [ ] **Step 5: ユーザー側 `handleFetch` を差し替え（onProgress で進捗・連打ガード維持）**

`src/components/FFLogsImportModal.tsx` の import に追加:

```ts
import { fetchAndMapFflogs } from '../lib/fflogs/fetchAndMapFflogs';
```

不要になる import を削除: `resolveFight, fetchFightEvents, fetchDeathEvents, fetchCastEvents, fetchPlayerDetails`（`from '../api/fflogs'`）、`mapFFLogsToTimeline`（`from '../utils/fflogsMapper'`）。**`FFLogsRawEvent` / `FFLogsFight` / `MapperResult` の type import は `ImportStatus` 型定義で使うので残す**（`type ImportStatus = ... preview; events: FFLogsRawEvent[]; mapped: MapperResult ...`）。

`handleFetch`（現 L102-138）を置換。最終形:

```ts
    const handleFetch = async () => {
        if (!parsedData || !isLoggedIn) return;

        if (getRemainingImports() <= 0) {
            setStatus({ phase: 'error', message: t('fflogs.rate_limit_exceeded', { max: IMPORT_RATE_LIMIT }) });
            return;
        }

        try {
            recordImport();
            // 連打ガード: await 前に同期で loading 化（canFetch を即 false に）
            setStatus({ phase: 'loading', message: t('fflogs.resolving') });
            const { fight, events, mapped } = await fetchAndMapFflogs(
                parsedData.reportId,
                parsedData.fightId,
                (phase, ctx) => {
                    if (phase === 'resolving') {
                        setStatus({ phase: 'loading', message: t('fflogs.resolving') });
                    } else if (phase === 'fetching_players') {
                        setStatus({ phase: 'loading', message: t('fflogs.fetching_players') });
                    } else if (phase === 'fetching') {
                        setStatus({ phase: 'loading', message: t('fflogs.fetching', { lang: 'JP+EN', name: ctx?.name ?? '' }) });
                    } else if (phase === 'mapping') {
                        setStatus({ phase: 'loading', message: t('fflogs.mapping') });
                    }
                },
            );
            setStatus({ phase: 'preview', fight, events, mapped });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setStatus({ phase: 'error', message });
        }
    };
```

> 不変条件チェック: `recordImport()` は try 先頭・`await` 前（fetch 試行=1 消費）/ レート制限ゲートは try の外・現状順序 / catch は message 文字列化のみで parsedData を触らない / `setStatus('preview', { fight, events, mapped })` の events は `eventsEn`。

- [ ] **Step 6: ビルドと回帰確認**

Run: `npm run build`
Expected: tsc -b エラーなし（**未使用 import が残っていないこと**を特に確認）

Run: `npm run test`
Expected: 既存全テスト緑（特に `importModes` / `useMitigationStore.importModes` / `useMitigationStore.collab` が無改変で PASS）。新規 `fetchAndMapFflogs` PASS。

- [ ] **Step 7: 実機回帰（ユーザー側を 1 ミリも変えていないことの確認）**

`npm run dev` で軽減表編集を開き、FFLogs 取り込みを実行。確認:
- 撃破ログ／fightId 指定 URL／英語のみログで取り込めること
- preview のボス名・長さ・イベント数が出ること、取り込み後の技名が日本語/英語とも従来どおり（逆転していない）
- 取り込みモード（置き換え＋軽減削除/保持/追記）が従来どおり動くこと

- [ ] **Step 8: コミット**

```bash
rtk git add src/lib/fflogs/fetchAndMapFflogs.ts src/lib/fflogs/__tests__/fetchAndMapFflogs.test.ts src/components/FFLogsImportModal.tsx
rtk git commit -m "refactor(fflogs): 取得シーケンスをfetchAndMapFflogsへ抽出（onProgress/throw透過・ユーザー側挙動不変）"
```

---

## Task 3: resolveTemplatePhaseAppend（テンプレ用フェーズ追記純粋関数）

**Files:**
- Create: `src/utils/templateImportPhases.ts`
- Test: `src/utils/__tests__/templateImportPhases.test.ts`

**Interfaces:**
- Consumes: 型 `TemplateData`（`src/data/templateLoader`、`phases` = `{ id: number; startTimeSec: number; name?: LocalizedString }[]`）。
- Produces: `resolveTemplatePhaseAppend(currentPhases: TemplateData['phases'], incomingPhases: TemplateData['phases'], mode: 'replace_all' | 'append', appendFromTime: number | null): TemplateData['phases']`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/templateImportPhases.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveTemplatePhaseAppend } from '../templateImportPhases';

const ph = (id: number, startTimeSec: number) => ({
  id,
  startTimeSec,
  name: { ja: `P${id}`, en: `P${id}` },
});

describe('resolveTemplatePhaseAppend', () => {
  it('replace_all は incoming をそのまま返す', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, 0), ph(11, 50)];
    expect(resolveTemplatePhaseAppend(cur, inc, 'replace_all', null)).toBe(inc);
  });
  it('append: cutoff より後の新規フェーズだけ追加し時刻昇順', () => {
    const cur = [ph(1, 0), ph(2, 30)];
    const inc = [ph(10, 20), ph(11, 60)];
    const out = resolveTemplatePhaseAppend(cur, inc, 'append', 30);
    expect(out.map((p) => p.startTimeSec)).toEqual([0, 30, 60]); // 20 は除外、60 追加
  });
  it('append: 同時刻ちょうど(===cutoff)は除外し既存を触らない', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, 30)];
    expect(resolveTemplatePhaseAppend(cur, inc, 'append', 30)).toBe(cur);
  });
  it('append: 新規0件なら既存と同一参照を返す', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, 10)];
    expect(resolveTemplatePhaseAppend(cur, inc, 'append', 50)).toBe(cur);
  });
  it('append: startTimeSec<0 を除外', () => {
    const cur = [ph(1, 0)];
    const inc = [ph(10, -1), ph(11, 80)];
    const out = resolveTemplatePhaseAppend(cur, inc, 'append', 50);
    expect(out.map((p) => p.startTimeSec)).toEqual([0, 80]);
  });
  it('append: appendFromTime=null(空テンプレ)なら全件追加', () => {
    const cur: TemplateData['phases'] = [];
    const inc = [ph(10, 0), ph(11, 40)];
    const out = resolveTemplatePhaseAppend(cur, inc, 'append', null);
    expect(out.map((p) => p.startTimeSec)).toEqual([0, 40]);
  });
});

// 型 import はテスト先頭の implicit any 回避のため
import type { TemplateData } from '../../data/templateLoader';
```

> 注: 上記テストの `import type { TemplateData }` はファイル先頭に移動してよい（vitest/tsc は順序非依存だが可読性のため先頭推奨）。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test -- templateImportPhases`
Expected: FAIL（モジュール無し）

- [ ] **Step 3: 実装する**

`src/utils/templateImportPhases.ts`:

```ts
import type { TemplateData } from '../data/templateLoader';

/**
 * テンプレートエディター向けのフェーズ取り込み解決（純粋関数）。
 * ストアの importTimelineEvents（useMitigationStore.ts:932-951）のフェーズ追記ロジックの
 * テンプレ型版。ストア Phase 型（startTime/endTime）とは別に TemplateData['phases']
 * （startTimeSec・endTime なし）で動く。ensurePhaseEndTimes は通さない（描画前に補完される）。
 */
export function resolveTemplatePhaseAppend(
  currentPhases: TemplateData['phases'],
  incomingPhases: TemplateData['phases'],
  mode: 'replace_all' | 'append',
  appendFromTime: number | null,
): TemplateData['phases'] {
  if (mode === 'replace_all') {
    return incomingPhases;
  }
  // append: cutoff より後の新規フェーズだけ既存に足す（負値除外・同時刻除外。null ガード必須）
  const added = incomingPhases.filter(
    (p) => p.startTimeSec >= 0 && (appendFromTime === null || p.startTimeSec > appendFromTime),
  );
  if (added.length === 0) {
    return currentPhases;
  }
  return [...currentPhases, ...added].sort((a, b) => a.startTimeSec - b.startTimeSec);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test -- templateImportPhases`
Expected: PASS（6 ケース）

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/templateImportPhases.ts src/utils/__tests__/templateImportPhases.test.ts
rtk git commit -m "feat(template): テンプレ用フェーズ追記純粋関数 resolveTemplatePhaseAppend を追加"
```

---

## Task 4: FflogsTimelineImportModal（管理画面の取り込みモーダル）＋ i18n

**Files:**
- Create: `src/components/admin/FflogsTimelineImportModal.tsx`
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`（`admin.tpl_fflogs_import_*` キー追加）

**Interfaces:**
- Consumes: `parseFflogsUrl`（Task 1）、`fetchAndMapFflogs`（Task 2）、型 `MapperResult` / `TimelineEvent` / `TemplateData`。
- Produces: `FflogsTimelineImportModal`（Props: `{ isOpen, onClose, hasEvents, onImport(events, phases, mode) }`、`mode: 'replace_all' | 'append'`）。Task 5 が配線する。

このタスクは UI 専従（取得→プレビュー→モード選択→`onImport` 呼び出し）。editor への反映ロジックは Task 5 が持つ。テストは UI 駆動（vmThreads でハング危険）を避け、Task 5 の実機確認＋ Task 1-3 の純粋関数テストで担保する。

- [ ] **Step 1: i18n キーを 4 言語に追加**

各 `src/locales/{ja,en,ko,zh}.json` の `admin` オブジェクト内、既存 `tpl_fflogs_btn` の近くに以下を追加（値は言語別）。

ja.json:
```json
"tpl_fflogs_import_btn": "FFLogs取り込み",
"tpl_fflogs_import_title": "FFLogsからタイムラインを取り込む",
"tpl_fflogs_import_url_label": "FFLogsレポートのURLを貼り付けてください",
"tpl_fflogs_import_url_placeholder": "https://www.fflogs.com/reports/...",
"tpl_fflogs_import_fetch": "取得する",
"tpl_fflogs_import_fetching": "取得中...",
"tpl_fflogs_import_invalid_url": "無効なFFLogsのURLです",
"tpl_fflogs_import_empty_hint": "現在のタイムラインは空です。取り込むと新しく作成されます",
"tpl_fflogs_import_fight": "ボス",
"tpl_fflogs_import_events": "イベント数",
"tpl_fflogs_import_duration": "長さ",
"tpl_fflogs_import_english_only": "英語ログのため日本語の技名は取得できません",
"tpl_fflogs_import_mode_label": "取り込み方法",
"tpl_fflogs_import_mode_replace_all": "置き換え（全て入れ替え）",
"tpl_fflogs_import_mode_append": "追記（既存より後のイベントのみ）",
"tpl_fflogs_import_confirm": "タイムラインに取り込む",
```

en.json:
```json
"tpl_fflogs_import_btn": "Import FFLogs",
"tpl_fflogs_import_title": "Import timeline from FFLogs",
"tpl_fflogs_import_url_label": "Paste an FFLogs report URL",
"tpl_fflogs_import_url_placeholder": "https://www.fflogs.com/reports/...",
"tpl_fflogs_import_fetch": "Fetch",
"tpl_fflogs_import_fetching": "Fetching...",
"tpl_fflogs_import_invalid_url": "Invalid FFLogs URL",
"tpl_fflogs_import_empty_hint": "The timeline is empty. Importing will create a new one",
"tpl_fflogs_import_fight": "Boss",
"tpl_fflogs_import_events": "Events",
"tpl_fflogs_import_duration": "Duration",
"tpl_fflogs_import_english_only": "English-only log: Japanese ability names are unavailable",
"tpl_fflogs_import_mode_label": "Import method",
"tpl_fflogs_import_mode_replace_all": "Replace (replace all)",
"tpl_fflogs_import_mode_append": "Append (only events after the current end)",
"tpl_fflogs_import_confirm": "Import to timeline",
```

ko.json:
```json
"tpl_fflogs_import_btn": "FFLogs 가져오기",
"tpl_fflogs_import_title": "FFLogs에서 타임라인 가져오기",
"tpl_fflogs_import_url_label": "FFLogs 리포트 URL을 붙여넣으세요",
"tpl_fflogs_import_url_placeholder": "https://www.fflogs.com/reports/...",
"tpl_fflogs_import_fetch": "가져오기",
"tpl_fflogs_import_fetching": "가져오는 중...",
"tpl_fflogs_import_invalid_url": "잘못된 FFLogs URL입니다",
"tpl_fflogs_import_empty_hint": "타임라인이 비어 있습니다. 가져오면 새로 생성됩니다",
"tpl_fflogs_import_fight": "보스",
"tpl_fflogs_import_events": "이벤트 수",
"tpl_fflogs_import_duration": "길이",
"tpl_fflogs_import_english_only": "영어 로그라 일본어 스킬 이름을 가져올 수 없습니다",
"tpl_fflogs_import_mode_label": "가져오기 방식",
"tpl_fflogs_import_mode_replace_all": "교체 (전체 교체)",
"tpl_fflogs_import_mode_append": "추가 (기존 이후 이벤트만)",
"tpl_fflogs_import_confirm": "타임라인에 가져오기",
```

zh.json:
```json
"tpl_fflogs_import_btn": "导入 FFLogs",
"tpl_fflogs_import_title": "从 FFLogs 导入时间轴",
"tpl_fflogs_import_url_label": "粘贴 FFLogs 报告 URL",
"tpl_fflogs_import_url_placeholder": "https://www.fflogs.com/reports/...",
"tpl_fflogs_import_fetch": "获取",
"tpl_fflogs_import_fetching": "获取中...",
"tpl_fflogs_import_invalid_url": "无效的 FFLogs URL",
"tpl_fflogs_import_empty_hint": "时间轴为空，导入将创建新时间轴",
"tpl_fflogs_import_fight": "Boss",
"tpl_fflogs_import_events": "事件数",
"tpl_fflogs_import_duration": "时长",
"tpl_fflogs_import_english_only": "英语日志，无法获取日语技能名称",
"tpl_fflogs_import_mode_label": "导入方式",
"tpl_fflogs_import_mode_replace_all": "替换（全部替换）",
"tpl_fflogs_import_mode_append": "追加（仅导入现有之后的事件）",
"tpl_fflogs_import_confirm": "导入到时间轴",
```

> JSON 構文注意: 追加位置の直前・直後のカンマを必ず確認（末尾要素にカンマ無し等）。`npm run build` 前に 4 ファイルとも JSON として妥当か確認。

- [ ] **Step 2: モーダルコンポーネントを実装**

`src/components/admin/FflogsTimelineImportModal.tsx`:

```tsx
/**
 * src/components/admin/FflogsTimelineImportModal.tsx
 *
 * FFLogs レポート URL からタイムライン（イベント＋フェーズ）を取得し、
 * テンプレートエディターへ「置き換え／追記」で取り込む管理画面モーダル。
 * 取得は共通の fetchAndMapFflogs を使う（ユーザー側 FFLogsImportModal と共用）。
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { parseFflogsUrl } from '../../lib/fflogs/parseFflogsUrl';
import { fetchAndMapFflogs } from '../../lib/fflogs/fetchAndMapFflogs';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';
import type { MapperResult } from '../../utils/fflogsMapper';

type ImportMode = 'replace_all' | 'append';

interface FflogsTimelineImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasEvents: boolean;
  onImport: (events: TimelineEvent[], phases: TemplateData['phases'], mode: ImportMode) => void;
}

type Status =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'preview'; fightName: string; durationSec: number; mapped: MapperResult }
  | { phase: 'error'; message: string };

export function FflogsTimelineImportModal({
  isOpen,
  onClose,
  hasEvents,
  onImport,
}: FflogsTimelineImportModalProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>({ phase: 'idle' });
  const [mode, setMode] = useState<ImportMode>('replace_all');

  useEscapeClose(isOpen, onClose);

  if (!isOpen) return null;

  const handleClose = () => {
    setUrl('');
    setStatus({ phase: 'idle' });
    setMode('replace_all');
    onClose();
  };

  const handleFetch = async () => {
    const parsed = parseFflogsUrl(url);
    if (!parsed) {
      setStatus({ phase: 'error', message: t('admin.tpl_fflogs_import_invalid_url') });
      return;
    }
    try {
      setStatus({ phase: 'loading' });
      const { fight, mapped } = await fetchAndMapFflogs(parsed.reportId, parsed.fightId);
      setStatus({
        phase: 'preview',
        fightName: fight.name,
        durationSec: Math.floor((fight.endTime - fight.startTime) / 1000),
        mapped,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ phase: 'error', message });
    }
  };

  const handleConfirm = () => {
    if (status.phase !== 'preview') return;
    onImport(status.mapped.events, status.mapped.phases, hasEvents ? mode : 'replace_all');
    handleClose();
  };

  const btnBase = 'px-3 py-1.5 text-app-lg rounded cursor-pointer transition-colors border';
  const btnBlue = `${btnBase} border-blue-500/40 text-blue-400 hover:bg-blue-500/10`;
  const btnMuted = `${btnBase} border-app-text/20 text-app-text-muted hover:bg-app-text/5`;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-app-2xl font-bold">{t('admin.tpl_fflogs_import_title')}</p>

        {/* URL 入力 */}
        <div>
          <label className="block text-app-base text-app-text-muted mb-1">
            {t('admin.tpl_fflogs_import_url_label')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setStatus({ phase: 'idle' }); }}
              placeholder={t('admin.tpl_fflogs_import_url_placeholder')}
              className="flex-1 px-2 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text"
            />
            <button
              onClick={handleFetch}
              disabled={status.phase === 'loading' || !url.trim()}
              className={`${btnBlue} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {status.phase === 'loading'
                ? t('admin.tpl_fflogs_import_fetching')
                : t('admin.tpl_fflogs_import_fetch')}
            </button>
          </div>
        </div>

        {/* 空テンプレ時の説明 */}
        {!hasEvents && (
          <p className="text-app-base text-app-text-muted">{t('admin.tpl_fflogs_import_empty_hint')}</p>
        )}

        {/* エラー */}
        {status.phase === 'error' && (
          <p className="text-app-lg text-red-400 whitespace-pre-wrap">{status.message}</p>
        )}

        {/* プレビュー */}
        {status.phase === 'preview' && (
          <div className="border border-app-text/10 rounded p-3 space-y-1 text-app-lg">
            <div className="flex gap-2">
              <span className="text-app-text-muted">{t('admin.tpl_fflogs_import_fight')}:</span>
              <span className="text-app-text truncate">{status.fightName}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-app-text-muted">
                {t('admin.tpl_fflogs_import_events')}:{' '}
                <span className="text-app-text">{status.mapped.events.length}</span>
              </span>
              <span className="text-app-text-muted">
                {t('admin.tpl_fflogs_import_duration')}:{' '}
                <span className="text-app-text">
                  {Math.floor(status.durationSec / 60)}m {status.durationSec % 60}s
                </span>
              </span>
            </div>
            {status.mapped.stats.isEnglishOnly && (
              <p className="text-app-base text-amber-400">{t('admin.tpl_fflogs_import_english_only')}</p>
            )}

            {/* モード選択（既存タイムラインがある時のみ） */}
            {hasEvents && (
              <div className="pt-2 space-y-1">
                <span className="text-app-base text-app-text-muted">{t('admin.tpl_fflogs_import_mode_label')}</span>
                {(['replace_all', 'append'] as ImportMode[]).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer text-app-lg">
                    <input
                      type="radio"
                      name="fflogs-tpl-import-mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="accent-app-text"
                    />
                    <span>{t(`admin.tpl_fflogs_import_mode_${m}`)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ボタン行 */}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={handleClose} className={btnMuted}>{t('admin.cancel')}</button>
          {status.phase === 'preview' && (
            <button onClick={handleConfirm} className={btnBlue}>
              {t('admin.tpl_fflogs_import_confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: tsc -b エラーなし（型 import が `import type`、未使用なし）。JSON 4 ファイルが妥当。

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/admin/FflogsTimelineImportModal.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(admin): FFLogsタイムライン取り込みモーダル新設 + i18n(admin.tpl_fflogs_import_*)"
```

---

## Task 5: AdminTemplates 配線 ＋ TemplateEditorToolbar ボタン

**Files:**
- Modify: `src/components/admin/AdminTemplates.tsx`（フラグ・ハンドラ・モーダル配線・ツールバー prop）
- Modify: `src/components/admin/TemplateEditorToolbar.tsx`（prop・ボタン追加）

**Interfaces:**
- Consumes: `FflogsTimelineImportModal`（Task 4）、`resolveImportEvents`（`src/utils/importModes`・既存）、`resolveTemplatePhaseAppend`（Task 3）、`editor`（`useTemplateEditor`: `replaceAll(events, phases, labels?)` / `visibleEvents` / `state.currentPhases` / `state.currentLabels`）。

- [ ] **Step 1: TemplateEditorToolbar に prop とボタンを追加**

`src/components/admin/TemplateEditorToolbar.tsx`:

`TemplateEditorToolbarProps` に追加（`onOpenFflogsTranslation` の下）:
```ts
  onOpenFflogsTimelineImport: () => void;
```

引数分割代入に `onOpenFflogsTimelineImport,` を追加。

FFLogs 翻訳ボタン（現 L63-70）の**直後**に新ボタンを挿入:
```tsx
      <button
        type="button"
        onClick={onOpenFflogsTimelineImport}
        className={`${baseButtonClass} border-sky-500/40 text-sky-400 hover:bg-sky-500/10`}
      >
        {t('admin.tpl_fflogs_import_btn')}
      </button>
```

> **デザイン注記（ui-design.md 承認フロー）**: 新規取り込み（置換）は空テンプレにも使うため `disabled` は付けない。ボタン色は仮に `sky`（promote=blue・csv=emerald・fflogs翻訳=purple と区別）。Step 5 の実機確認でユーザーに最終承認をもらい、必要なら調整する。

- [ ] **Step 2: AdminTemplates に import・フラグ・ハンドラを追加**

`src/components/admin/AdminTemplates.tsx`:

import 追加:
```ts
import { FflogsTimelineImportModal } from './FflogsTimelineImportModal';
import { resolveImportEvents } from '../../utils/importModes';
import { resolveTemplatePhaseAppend } from '../../utils/templateImportPhases';
```

state 追加（既存 `showFflogsModal` の近く・現 L62 付近）:
```ts
  const [showFflogsImportModal, setShowFflogsImportModal] = useState(false);
```

ハンドラ追加（既存 `handleFflogsMatched` の近く・現 L290 付近）:
```ts
  const handleFflogsTimelineImport = (
    events: TimelineEvent[],
    phases: TemplateData['phases'],
    mode: 'replace_all' | 'append',
  ) => {
    if (mode === 'replace_all') {
      editor.replaceAll(events, phases);
    } else {
      const resolution = resolveImportEvents(editor.visibleEvents, events, 'append');
      const mergedPhases = resolveTemplatePhaseAppend(
        editor.state.currentPhases,
        phases,
        'append',
        resolution.appendFromTime,
      );
      editor.replaceAll(resolution.events, mergedPhases, [...editor.state.currentLabels]);
    }
    setDataSource('fflogs_timeline_import');
  };
```

> **型注意**: `setDataSource` が受ける `dataSource` の union 型に `'fflogs_timeline_import'` が無ければ追加する（既存 `'plan_promote'` / `'csv_import'` と同じ定義箇所。`AdminTemplates.tsx` 内 or 別型ファイル。`npm run build` の TS エラーで検出されるので、出たら union に追記）。`resolveImportEvents` の戻り値型は `{ events: TimelineEvent[]; clearMitigations: boolean; appendFromTime: number | null }`。`clearMitigations` はテンプレでは未使用（軽減が無いため）。

- [ ] **Step 3: ツールバー呼び出しとモーダル配線を追加**

`TemplateEditorToolbar` の呼び出し（現 L342-356 付近）に prop を追加:
```tsx
            onOpenFflogsTimelineImport={() => setShowFflogsImportModal(true)}
```

モーダル群（現 L535-540 の `FflogsTranslationModal` の後）に追加:
```tsx
      <FflogsTimelineImportModal
        isOpen={showFflogsImportModal}
        onClose={() => setShowFflogsImportModal(false)}
        hasEvents={hasEvents}
        onImport={handleFflogsTimelineImport}
      />
```

- [ ] **Step 4: ビルドと全テスト**

Run: `npm run build`
Expected: tsc -b エラーなし。

Run: `npm run test`
Expected: 全テスト緑。**回帰ゲート 3 本（`importModes` / `useMitigationStore.importModes` / `useMitigationStore.collab`）が無改変で PASS**。

- [ ] **Step 5: 実機確認（管理画面サンドボックス）＋ デザイン承認**

Run: `npm run dev:admin`（本番非接触のサンドボックス・[[reference_admin_sandbox]]）

確認:
- テンプレートエディターのツールバーに「FFLogs取り込み」ボタンが出る（色・配置をユーザーに見せて承認）
- 空テンプレで取り込み → タイムラインが入る（モード選択は出ない・empty_hint が出る）
- 既存タイムラインありで取り込み → 置き換え／追記ラジオが出る
- 「置き換え」→ 全入れ替え。「追記」→ 既存の後ろにだけ追加・既存イベント/フェーズ/ラベルが残る
- 英語ログで english_only 注記が出る
- en/ko/zh 表示が崩れない

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/admin/AdminTemplates.tsx src/components/admin/TemplateEditorToolbar.tsx
rtk git commit -m "feat(admin): テンプレ編集にFFLogs取り込みを配線（置き換え/追記・ツールバーボタン）"
```

---

## 最終確認（全タスク後）

- [ ] `npm run build` 緑（tsc -b 厳密）
- [ ] `npm run test` 緑（回帰ゲート 3 本が無改変）
- [ ] ユーザー側 FFLogs 取り込みの実機回帰（Task 2 Step 7）合格
- [ ] 管理画面 FFLogs 取り込みの実機確認（Task 5 Step 5）合格・ボタンデザイン承認済み
- [ ] `docs/TODO.md` / `docs/TODO_COMPLETED.md` 更新、ブランチ `feat/admin-fflogs-import` を main へ統合（finishing-a-development-branch）

---

## Self-Review（計画作成者による点検）

**Spec coverage:**
- spec §3 取り込みモード 2 種 → Task 4 モーダル UI ＋ Task 5 ハンドラで実装 ✓
- spec §4.1 parseFflogsUrl → Task 1 ✓ / §4.2 fetchAndMapFflogs → Task 2 ✓ / §4.3 resolveTemplatePhaseAppend → Task 3 ✓ / §4.4 モーダル → Task 4 ✓ / §4.5 配線 → Task 5 ✓
- spec §6 labels 非渡し → Task 4 で `onImport` に labels を渡さない設計 ✓ / 英語ログ注記 → Task 4 english_only ✓
- spec §8 ストア非介入・回帰ゲート → Global Constraints ＋ 各 Task の `npm run test` で担保 ✓
- spec §10 テスト → Task 1/2/3 に単体テスト、Task 2/5 に実機回帰 ✓

**Placeholder scan:** TBD/TODO/「適切に」等なし。全 step に実コード・実コマンド・期待値あり ✓

**Type consistency:**
- `fetchAndMapFflogs` 戻り値 `{ fight, events, mapped }`（Task 2）= モーダル消費（Task 4）一致 ✓
- `resolveTemplatePhaseAppend(currentPhases, incomingPhases, mode, appendFromTime)`（Task 3）= AdminTemplates 呼び出し（Task 5）一致 ✓
- `onImport(events, phases, mode)`（Task 4 Props）= `handleFflogsTimelineImport(events, phases, mode)`（Task 5）一致 ✓
- `resolveImportEvents` 戻り値 `.appendFromTime` を `resolveTemplatePhaseAppend` の第 4 引数へ ✓
- i18n キー `admin.tpl_fflogs_import_mode_${m}`（m = replace_all|append）= 追加キー一致 ✓

**未確認で実装時に確認すべき点（計画に注記済み）:**
- `setDataSource` の union に `'fflogs_timeline_import'` 追加要否（Task 5 Step 2 注記）
- ボタン色 sky の最終承認（Task 5 Step 1/5 注記・ui-design.md フロー）
- `/api/admin` templates POST が labels 空・mechanicGroup 無しイベントを正しく永続化するか（spec §11・保存時に確認）
