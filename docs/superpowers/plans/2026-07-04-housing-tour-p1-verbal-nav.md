# ハウジングツアー 本物のナビ化 P1: 言葉ナビ本体 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development でタスクごとに実装。ステップは `- [ ]`。
> spec: `docs/superpowers/specs/2026-07-04-housing-tour-real-navigation-design.md`

**Goal:** ツアー右パネルに、各家の「最寄りエーテライト名＋言葉での行き方」を主役として実表示し、ツアーを本物のナビにする(全5エリア×60区画)。

**Architecture:** masaya の行き方スプシ(5エリア×60=300件・`src/data/housing/directions-src/*.csv` に保全済)を生成スクリプトで静的 JSON 化 → 純関数 `getPlotDirections(area, plot)` で引く → `TourNextDestinationPanel` に「行き方」ブロックを追加。実行時 fetch なし。

**Tech Stack:** TypeScript / React / vite / vitest / i18next。生成は node mjs スクリプト。

## Global Constraints

- ハードコード禁止・色/寸法は `--housing-*` トークン経由([housing-design.md])。装飾ピル/色地alert箱を使わない(honey/candle/aether の2アクセント体系・静かな注記)。
- i18n: UI 文字列は必ずキー経由・4言語(ja/en/ko/zh)parity 維持。**行き方データ本文とエーテライト名は JP のまま**(スプシが JP のみ。en/ko/zh の本文ローカライズは将来・P1 対象外)。
- `npm run build`(tsc -b 厳密) EXIT0 ＋ `vitest run` 緑 を各タスクのゲート。未使用変数/型不足は Vercel で落ちる。
- area enum は `HOUSING_AREAS` = `Mist | LavenderBeds | Goblet | Shirogane | Empyreum`(`src/types/housing.ts`)。plot は 1-60(1-30 本街 / 31-60 拡張街)。
- 既存出荷物(`sortListingsForGallery` 等)は不改変。追加のみ。

## File Structure

- Create: `scripts/parse-ward-directions.mjs` — 5 CSV → 生成 JSON。
- Create: `src/data/housing/wardDirections.generated.json` — `{ [area]: { [plot(1-60)]: { aetheryte, directions } } }`。
- Create: `src/lib/housing/wardDirections.ts` — `getPlotDirections`。
- Create: `src/lib/housing/__tests__/wardDirections.test.ts`。
- Modify: `src/components/housing/tour/TourNextDestinationPanel.tsx` — 「行き方」ブロック追加・dl の aetheryte 行を置換。
- Modify: `src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx`。
- Modify: `src/locales/{ja,en,ko,zh}.json` — `housing.tour.nav.dest.directions` / `.teleport_to` 追加、旧 `.aetheryte` を除去(4言語同時)。
- Modify: `src/styles/housing.css` — `.housing-tour-dest-route*`。
- Source (保全済・コミット対象): `src/data/housing/directions-src/{mist,lavenderbeds,goblet,shirogane,empyreum}.csv`。

---

### Task 1: 行き方データの生成パイプライン

**Files:**
- Create: `scripts/parse-ward-directions.mjs`
- Create: `src/data/housing/wardDirections.generated.json`(スクリプト出力)
- Source: `src/data/housing/directions-src/*.csv`(保全済)

**Interfaces:**
- Produces: `wardDirections.generated.json` = `Record<Area, Record<plotStr, { aetheryte: string; directions: string }>>`。

CSV 列: `ハウジングエリア,表裏,番地,最寄りエーテライト,行き方補足`(index 0-4)。使うのは index 2(番地1-60)/3(aetheryte)/4(directions)。列0はエリア名＋参照リストで無視。全角記号のみで ASCII カンマ無し(実データ確認済)＝素朴 split で可、ただし前後クオートは剥がす。

- [ ] **Step 1: スクリプト作成**

```js
// scripts/parse-ward-directions.mjs
// 使い方: node scripts/parse-ward-directions.mjs
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'src/data/housing/directions-src';
const OUT = 'src/data/housing/wardDirections.generated.json';
// ファイル名 → area enum
const FILES = [
  ['mist.csv', 'Mist'],
  ['lavenderbeds.csv', 'LavenderBeds'],
  ['goblet.csv', 'Goblet'],
  ['shirogane.csv', 'Shirogane'],
  ['empyreum.csv', 'Empyreum'],
];

const unq = (s) => s.replace(/^"|"$/g, '').trim();

const out = {};
for (const [file, area] of FILES) {
  const txt = readFileSync(`${SRC}/${file}`, 'utf8');
  const lines = txt.split(/\r?\n/).filter((l) => l.trim());
  const byPlot = {};
  for (let i = 1; i < lines.length; i++) { // skip header
    const cols = lines[i].split(',');
    const plot = Number(unq(cols[2] ?? ''));
    const aetheryte = unq(cols[3] ?? '');
    const directions = unq(cols[4] ?? '');
    if (!Number.isInteger(plot) || plot < 1 || plot > 60) continue;
    if (!aetheryte && !directions) continue;
    byPlot[String(plot)] = { aetheryte, directions };
  }
  const n = Object.keys(byPlot).length;
  if (n !== 60) throw new Error(`${area}: expected 60 plots, got ${n}`);
  out[area] = byPlot;
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('wardDirections.generated.json written:', Object.keys(out).map((a) => `${a}=${Object.keys(out[a]).length}`).join(' '));
```

- [ ] **Step 2: 実行して生成 + 検証**

Run: `node scripts/parse-ward-directions.mjs`
Expected: `wardDirections.generated.json written: Mist=60 LavenderBeds=60 Goblet=60 Shirogane=60 Empyreum=60`(60でなければ throw)。

- [ ] **Step 3: 生成物の目視サニティ**

Run: `node -e "const d=require('./src/data/housing/wardDirections.generated.json'); console.log(d.Mist['1'], d.Mist['60'], d.Goblet['1'])"`
Expected: `{ aetheryte: 'ミストゲート・スクエア', directions: '西の階段をまっすぐ降りたとこ' } { aetheryte: '[拡張街]ミスト・ヴィレッジ南西', directions: '西の突き当りのＬハウス' } { aetheryte: 'ゴブレット市場（居住区担当官）', directions: ... }`

- [ ] **Step 4: コミット**

```bash
rtk git add scripts/parse-ward-directions.mjs src/data/housing/directions-src src/data/housing/wardDirections.generated.json
rtk git commit -m "feat(housing): 行き方データ(5エリア×60)を生成パイプライン化"
```

---

### Task 2: `getPlotDirections` 純関数

**Files:**
- Create: `src/lib/housing/wardDirections.ts`
- Test: `src/lib/housing/__tests__/wardDirections.test.ts`

**Interfaces:**
- Consumes: `wardDirections.generated.json`(Task1)。
- Produces: `getPlotDirections(area: string, plot: number | null | undefined): { aetheryte: string; directions: string } | null`。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/wardDirections.test.ts
import { describe, it, expect } from 'vitest';
import { getPlotDirections } from '../wardDirections';

describe('getPlotDirections', () => {
  it('Mist plot 1 → 実エーテライト名+行き方', () => {
    expect(getPlotDirections('Mist', 1)).toEqual({
      aetheryte: 'ミストゲート・スクエア',
      directions: '西の階段をまっすぐ降りたとこ',
    });
  });
  it('拡張街 plot 60 も引ける', () => {
    const d = getPlotDirections('Mist', 60);
    expect(d?.aetheryte).toBe('[拡張街]ミスト・ヴィレッジ南西');
  });
  it('全5エリア×60が揃う', () => {
    for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
      for (let p = 1; p <= 60; p++) {
        const d = getPlotDirections(area, p);
        expect(d, `${area} ${p}`).not.toBeNull();
        expect(d!.aetheryte.length).toBeGreaterThan(0);
      }
    }
  });
  it('plot 無し/範囲外/未知エリアは null', () => {
    expect(getPlotDirections('Mist', null)).toBeNull();
    expect(getPlotDirections('Mist', 61)).toBeNull();
    expect(getPlotDirections('Nowhere', 1)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/housing/__tests__/wardDirections.test.ts`
Expected: FAIL(`getPlotDirections` 未定義)。

- [ ] **Step 3: 実装**

```ts
// src/lib/housing/wardDirections.ts
import data from '../../data/housing/wardDirections.generated.json';

export interface PlotDirections {
  aetheryte: string;
  directions: string;
}

const TABLE = data as Record<string, Record<string, PlotDirections>>;

/** area(enum) + plot(1-60) → 最寄りエーテライト名 + 言葉ナビ。無ければ null。 */
export function getPlotDirections(
  area: string,
  plot: number | null | undefined,
): PlotDirections | null {
  if (plot == null || !Number.isInteger(plot)) return null;
  return TABLE[area]?.[String(plot)] ?? null;
}
```

- [ ] **Step 4: パス確認**

Run: `npx vitest run src/lib/housing/__tests__/wardDirections.test.ts`
Expected: PASS(4件)。

- [ ] **Step 5: JSON import が tsc -b で通るか(resolveJsonModule 確認)**

Run: `npm run build`
Expected: EXIT0。もし JSON import 型エラーなら `tsconfig` の `resolveJsonModule` は既存 generated.json import(`wardRoute.ts` が `mistWard.generated.json` を import 済)で有効なはず=踏襲。

- [ ] **Step 6: コミット**

```bash
rtk git add src/lib/housing/wardDirections.ts src/lib/housing/__tests__/wardDirections.test.ts
rtk git commit -m "feat(housing): getPlotDirections 純関数(最寄りエーテライト+言葉ナビ)"
```

---

### Task 3: 右パネルに「行き方」ブロック + i18n

**Files:**
- Modify: `src/components/housing/tour/TourNextDestinationPanel.tsx`
- Modify: `src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx`
- Modify: `src/locales/{ja,en,ko,zh}.json`

**Interfaces:**
- Consumes: `getPlotDirections`(Task2)。

**設計**: dl の「最寄りエーテライト」行(現状 `getAreaName` の仮表示)を撤去し、代わりに dl の直後に主役級の「行き方」ブロックを置く。ブロック = 見出し「行き方」＋「〔aetheryte〕へ移動」＋ 徒歩ナビ本文。directions が無い listing(plot 無し/未収録)はブロック非表示(住所のみ)。

- [ ] **Step 1: i18n キー追加(4言語・parity)** — 各 `housing.tour.nav.dest` 直下:

ja: `"directions": "行き方"`, `"teleport_to": "{{aetheryte}} へ移動"`(既存 `"aetheryte": "最寄りエーテライト"` は**削除**)
en: `"directions": "Directions"`, `"teleport_to": "Teleport to {{aetheryte}}"`(`aetheryte` 削除)
ko: `"directions": "가는 길"`, `"teleport_to": "{{aetheryte}}(으)로 이동"`(`aetheryte` 削除)
zh: `"directions": "路线"`, `"teleport_to": "传送至 {{aetheryte}}"`(`aetheryte` 削除)

該当ブロックだけ textual 編集(全体 parse→stringify しない・[[feedback_locale_json_textual_edit]])。

- [ ] **Step 2: コンポーネント改修**

`import { getPlotDirections } from '../../../lib/housing/wardDirections';` を追加。`getAreaName` の import は他で使っていなければ除去(aetheryte 行撤去のため)。listing 確定後に:

```tsx
const directions = getPlotDirections(listing?.area ?? '', listing?.plot);
```

dl から「最寄りエーテライト」の `<div className="housing-tour-dest-fact">…dest.aetheryte…getAreaName…</div>` を**削除**。dl(`</dl>`)の直後に:

```tsx
{directions && (
  <div className="housing-tour-dest-route">
    <span className="housing-tour-dest-route-label">{t('housing.tour.nav.dest.directions')}</span>
    <p className="housing-tour-dest-route-teleport">
      {t('housing.tour.nav.dest.teleport_to', { aetheryte: directions.aetheryte })}
    </p>
    <p className="housing-tour-dest-route-walk">{directions.directions}</p>
  </div>
)}
```

- [ ] **Step 3: テスト更新(実挙動裏取り)**

`TourNextDestinationPanel.test.tsx` の該当を: (a) area='Mist', plot=1 の listing で「ミストゲート・スクエア」と「西の階段をまっすぐ降りたとこ」がレンダーされる (b) 「最寄りエーテライト」ラベル(getAreaName のエリア名)がもう出ない (c) plot 無し listing では route ブロックが出ない、を検証。フィクスチャは既存の形に `area:'Mist', plot:1` を付与。

```tsx
// 追加/置換する主要 expect の例
expect(screen.getByText('西の階段をまっすぐ降りたとこ')).toBeInTheDocument();
expect(screen.getByText(/ミストゲート・スクエア/)).toBeInTheDocument();
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx src/components/housing/tour/__tests__/i18nParity.test.ts`
Expected: PASS(parity 含む)。

- [ ] **Step 5: build**

Run: `npm run build`
Expected: EXIT0。

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/housing/tour/TourNextDestinationPanel.tsx src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(housing): ツアー右パネルに行き方(最寄りエーテライト+言葉ナビ)ブロック"
```

---

### Task 4: 「行き方」ブロックのスタイル(housing.css)

**Files:**
- Modify: `src/styles/housing.css`

**設計**: 主役級だが AI 風にしない(色地 alert 箱/999px ピル禁止)。dl 下にヘアライン区切り＋見出し(小・text-mute)＋テレポ先(やや大・honey 系アクセントは最小)＋徒歩本文(読みやすい本文サイズ)。既存 `--housing-*` トークン経由。

- [ ] **Step 1: CSS 追加**(既存の `.housing-tour-dest-facts` 近傍の規約に合わせトークン利用。値は既存トークン名を流用)

```css
.housing-tour-dest-route {
  margin-top: var(--housing-space-3, 12px);
  padding-top: var(--housing-space-3, 12px);
  border-top: 1px solid var(--housing-divider);
  display: flex;
  flex-direction: column;
  gap: var(--housing-space-1, 4px);
}
.housing-tour-dest-route-label {
  font-size: var(--housing-text-xs);
  color: var(--housing-text-mute);
}
.housing-tour-dest-route-teleport {
  font-size: var(--housing-text-md);
  color: var(--housing-honey);
  font-weight: 600;
}
.housing-tour-dest-route-walk {
  font-size: var(--housing-text-sm);
  color: var(--housing-text);
  line-height: 1.5;
}
```

※ 上記トークン名(`--housing-space-*` / `--housing-text-*` / `--housing-divider` / `--housing-honey` / `--housing-text` / `--housing-text-mute`)は housing.css の既存定義を grep で確認し、無いものは最も近い既存トークンに合わせる(新規トークンは原則作らない・既存規約踏襲)。

- [ ] **Step 2: build + 既存テスト**

Run: `npm run build && npx vitest run src/components/housing/tour`
Expected: EXIT0 / PASS。

- [ ] **Step 3: コミット**

```bash
rtk git add src/styles/housing.css
rtk git commit -m "style(housing): ツアー行き方ブロックのスタイル(トークン経由)"
```

---

## 実機検証(P1 完了ゲート・親が実施)

Playwright(1489×2.58・store注入)で `/housing/tour`:
- Mist plot 1/6/30、拡張街 plot 45、他エリア(Goblet 等)を注入し、右パネルに「行き方」ブロック(最寄りエーテライト実名＋言葉ナビ)が出る。
- エリア名の仮表示(旧「最寄りエーテライト: ミスト・ヴィレッジ」)が消えている。
- plot 無し(apartment 等)ではブロック非表示・住所のみ。
- honeyトンマナ(色地箱なし)・4言語でラベルが崩れない(en/ko/zh はラベルのみ翻訳・本文は JP)。

OK なら P2(自動並べ替え＋全エリア地図)の計画へ。

## Self-Review(記入済)
- spec カバレッジ: P1 の「言葉ナビ本体」= Task1-4 で充足。auto-order/transition/地図全エリア/ゴージャス化は P2-4(別計画)。
- placeholder: なし(全ステップ実コード)。
- 型整合: `getPlotDirections(area,plot)` の戻り `{aetheryte,directions}|null` を Task2 定義→Task3 消費で一致。
- 既知の限界: en/ko/zh の行き方本文・エーテライト名は JP のまま(データが JP のみ・将来ローカライズ)。
