# ハウジング台湾リージョン対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2025年12月に開始した繁体字版FF14サーバー(台湾・香港・マカオ・シンガポール・マレーシア向け、UserJoy運営)のハウジングを登録・閲覧・ツアーできるようにし、グローバル/韓国/中国と構造的に混在不可能にする。

**Architecture:** 2026-07-18のKR/CN対応(`docs/superpowers/specs/2026-07-18-housing-kr-cn-region-support-design.md`)と同じ静的データ拡張方式(Firestoreスキーマ変更なし、正典CSVが唯一の情報源、変換スクリプトで生成)。KR/CNとの違いは、正典データが存在しないため本プランの前半で収集すること、および新しい言語コード`zh-Hant`を導入するため既存の"zh"衝突判定(頭2文字だけ見る/prefixだけ見る判定)を直すことの2点。

**Tech Stack:** React+TS+Vite / vitest / 生成スクリプト=Node mjs / opencc-js(簡体字→繁体字の機械変換) / Firestore(スキーマ変更なし・`/master/servers`再シードのみ)

**Spec:** `docs/superpowers/specs/2026-07-27-housing-taiwan-region-and-traditional-chinese-design.md`

## Global Constraints

- 内部キー(dc/server)は一度決めたら**変更不可**(Firestore listingに保存されるため)
- `src/utils/housingValidation.ts`はapiからもimportされる → そこへの新規importは**`.js`拡張子必須**(Vercel Node ESM)。生成JSONをapi側からimportしない(Vercel Node はJSON import不可)
- ロケールJSON(`src/locales/*.json`)は本プランでは**一切触らない**(`zh-Hant.json`の作成・LanguageSwitcherへの追加はPhase②、スコープ外)
- 正典CSV(`src/data/housing/terms-src/housing-terms.csv`)は該当行のみtextual編集(全体parse→stringify禁止)
- vitestは対象ファイル指定で実行、フルはpush前ゲートのみ。出力をパイプしない
- コミットは各タスク末尾で1回。pushはしない(最後にユーザー承認後まとめて)
- UI表示ルール: **TWのDC/ワールドは全ロケールで辞書表示名、グローバルは現状表示(内部キー=英名)を変えない**(KR/CN方式を踏襲)
- 既存の`zh`(簡体字)ユーザーの挙動は一切変えない(`pickRegionLocale('zh-CN')`は引き続き`'zh'`を返す等、既存テストの期待値を壊さない)

---

### Task 1: 簡体字→繁体字 機械変換ツール + 正典CSVへのzh-Hant列バックフィル

**Files:**
- Modify: `package.json`(依存追加)
- Create: `scripts/convert-zh-to-hant.mjs`
- Modify: `src/data/housing/terms-src/housing-terms.csv`(zh列の後にzh-Hant列を追加。ヘッダーを`カテゴリ,ja,en,ko,zh,zh-Hant,備考`に変更)
- Test: `src/data/housing/terms-src/__tests__/housingTermsCsv.test.ts`(新規)

**Interfaces:**
- Produces: 全265件(dc=17/world=117/area=5/apartment=5/aetheryte=92/district=2/size=5/tag=22)のzh-Hant値が入った正典CSV

- [ ] **Step 1: 依存追加**

Run: `rtk npm install opencc-js`

- [ ] **Step 2: 失敗するテストを書く** — `src/data/housing/terms-src/__tests__/housingTermsCsv.test.ts`:

```ts
import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

describe('housing-terms.csv の zh-Hant列', () => {
  it('ヘッダーに zh-Hant 列がある', () => {
    const header = readFileSync('src/data/housing/terms-src/housing-terms.csv', 'utf8').split(/\r?\n/)[0];
    const cols = header.split(',');
    expect(cols).toContain('zh-Hant');
  });
  it('全行で zh-Hant 列が非空 (備考行・空行を除く)', () => {
    const lines = readFileSync('src/data/housing/terms-src/housing-terms.csv', 'utf8')
      .split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(',');
    const zhHantIdx = header.indexOf('zh-Hant');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      expect(cols[zhHantIdx], `line ${i + 1}: ${lines[i]}`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 3: 失敗確認** — Run: `rtk vitest run src/data/housing/terms-src/__tests__/housingTermsCsv.test.ts` → Expected: FAIL(zh-Hant列が無い)

- [ ] **Step 4: 機械変換スクリプトを書く** — `scripts/convert-zh-to-hant.mjs`(既存zh列を繁体字へ機械変換し、新しいCSVを標準出力する。フレーズ単位変換の`twp`を使う):

```js
// 使い方: node scripts/convert-zh-to-hant.mjs > /tmp/housing-terms-with-hant.csv
// src/data/housing/terms-src/housing-terms.csv の zh 列を機械的に繁体字変換し、
// zh 列の直後に zh-Hant 列を追加した CSV を標準出力する。
// 出力はドラフト: 固有名詞(ワールド名・エリア名等)は Step 5 で公式訳に手直しすること。
import { readFileSync } from 'fs';
import * as OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
const SRC = 'src/data/housing/terms-src/housing-terms.csv';

const lines = readFileSync(SRC, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
const header = lines[0].split(',');
const zhIdx = header.indexOf('zh');
const newHeader = [...header.slice(0, zhIdx + 1), 'zh-Hant', ...header.slice(zhIdx + 1)];
console.log(newHeader.join(','));

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  const zhVal = cols[zhIdx] ?? '';
  const zhHant = zhVal ? converter(zhVal) : '';
  const newCols = [...cols.slice(0, zhIdx + 1), zhHant, ...cols.slice(zhIdx + 1)];
  console.log(newCols.join(','));
}
```

- [ ] **Step 5: 変換実行+固有名詞の手直し** — Run: `node scripts/convert-zh-to-hant.mjs > /tmp/housing-terms-with-hant.csv` で下地を生成。出力を`src/data/housing/terms-src/housing-terms.csv`に置き換える前に、以下を公式繁体字ソースで裏取りして手直しする:
  - カテゴリ「ハウジングエリア」「アパルトメント」(計10件): 台湾プレイヤーWikiで確認。見つからない場合は機械変換値のまま残す(設計書§ハウジング固有名詞の方針どおり、実機確認不可のため仮置き)
  - カテゴリ「エーテライト」(92件)のうち、Mist/LavenderBeds/Goblet/Shirogane/Empyreumの5エリア分(住居エリア直近のエーテライトのみ優先的に裏取り。他は機械変換のドラフトのままでよい)
  - 機械変換の質にかかわらず、**このステップで人手を入れなかった行も含め全行がzh-Hant非空であること**が次のStepの完了条件
  - 手直し後のCSVを`src/data/housing/terms-src/housing-terms.csv`に上書きする

- [ ] **Step 6: パス確認** — Run: `rtk vitest run src/data/housing/terms-src/__tests__/housingTermsCsv.test.ts` → PASS

- [ ] **Step 7: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): 正典CSVにzh-Hant列を追加(簡体字からの機械変換+固有名詞の手直し)"`

---

### Task 2: TWワールド調査 + dcServerMap拡張

**Files:**
- Modify: `src/data/housing/dcServerMap.ts`
- Test: `src/__tests__/housing/regionMap.test.ts`(追記)

**Interfaces:**
- Produces: `Region = 'JP'|'NA'|'EU'|'OCE'|'KR'|'CN'|'TW'`。DCキー`TW`(仮。Step1で正式名称を確認して決定)、ワールド一覧(Step1で確認)

- [ ] **Step 1: 公式サイトで最新情報を確認** — `https://www.ffxiv.com.tw/web/worldstatus/index.aspx`でワールド一覧を再確認(2026-07-27時点は伊弗利特/迦樓羅/利維坦/鳳凰/奧汀/巴哈姆特/泰坦の7つ、DC名は未確認だったため要再調査)。DCが複数に分かれていないか(中国版は人口増で4DC化した前例あり)も確認する。DC正式名称が見当たらない場合は`TW`を内部キーとして採用する(表示名は用語辞書側で解決するため内部キーが英語風の仮名でも実害はない)

- [ ] **Step 2: 失敗するテストを書く** — `regionMap.test.ts`に追記(DCキー名・ワールド数はStep 1の調査結果に合わせて数値を調整する):

```ts
describe('TWマスター', () => {
  it('TW DC が ALL_REGIONS に含まれる', () => {
    expect(ALL_REGIONS).toContain('TW');
  });
  it('TW ワールドが DC_SERVER_MAP に登録されている', () => {
    const twDcs = Object.entries(DC_SERVER_MAP).filter(([, v]) => v.region === 'TW');
    expect(twDcs.length).toBeGreaterThan(0);
    const totalWorlds = twDcs.reduce((n, [, v]) => n + v.servers.length, 0);
    expect(totalWorlds).toBeGreaterThanOrEqual(7);
  });
});
```

- [ ] **Step 3: 失敗確認** — Run: `rtk vitest run src/__tests__/housing/regionMap.test.ts` → Expected: FAIL(型エラー/TW不在)

- [ ] **Step 4: 実装** — `dcServerMap.ts`:

```ts
export type Region = 'JP' | 'NA' | 'EU' | 'OCE' | 'KR' | 'CN' | 'TW';
```

`MameshibaCN`行の後に追加(DCキー名・ワールド名はStep1の調査結果に置き換える。以下はStep1時点の暫定値):

```ts
    // 台湾/香港/マカオ/シンガポール/マレーシア (物理分離リージョン・UserJoy運営、2025-12-10開始)。
    // DC名はStep1で公式確認。ワールド名は公式サイト表記(繁体字)をそのまま内部キーにはできないため、
    // 英語表記 (Ifrit/Garuda/Leviathan/Phoenix/Odin/Bahamut/Titan) をローマ字内部キーに採用。
    TW: { region: 'TW', servers: ['Ifrit', 'Garuda', 'Leviathan', 'Phoenix', 'Odin', 'Bahamut', 'Titan'] },
```

```ts
export const ALL_REGIONS: Region[] = ['JP', 'NA', 'EU', 'OCE', 'KR', 'CN', 'TW'];
```

**注意**: `Ifrit`/`Garuda`/`Bahamut`/`Titan`はグローバル(Gaia/Mana)に同名ワールドが既に存在するが、KR(`Carbuncle`等)と同じ理屈で`dc+server`の組が常にキーになるため衝突しない。

- [ ] **Step 5: パス確認** — Run: 同上 → Expected: PASS。ついで`rtk vitest run src/__tests__/housing`で既存回帰がないこと

- [ ] **Step 6: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): Region型にTW追加+dcServerMapへ台湾版サーバー登録"`

---

### Task 3: 型定義へのzh-Hant追加 + ハウジングエリア名のzh-Hant値

**Files:**
- Modify: `src/data/masterData.ts`(`MASTER_LANGS`・`housingAreaMasterData`の5エリア)
- Test: `src/__tests__/housing/masterParity.test.ts`(追記)

**Interfaces:**
- Produces: `MASTER_LANGS = ['ja','en','ko','zh','zh-Hant']`、`LocalizedString = Record<MasterLang, string>`(5言語必須)

- [ ] **Step 1: 失敗するテストを書く** — `masterParity.test.ts`に追記:

```ts
describe('housingAreaMasterData の zh-Hant', () => {
  it('全エリアの name / apartment_name に zh-Hant がある', () => {
    for (const [key, a] of Object.entries(housingAreaMasterData)) {
      expect(a.name['zh-Hant'], `${key} name.zh-Hant`).toBeTruthy();
      expect(a.apartment_name['zh-Hant'], `${key} apartment.zh-Hant`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run src/__tests__/housing/masterParity.test.ts` → Expected: FAIL(型エラー: `zh-Hant`が`MasterLang`に無い)

- [ ] **Step 3: 実装** — `masterData.ts`:

```ts
export const MASTER_LANGS = ['ja', 'en', 'ko', 'zh', 'zh-Hant'] as const;
```

`housingAreaMasterData`の5エリアに`zh-Hant`キーを追加(値はTask1で作成した正典CSVの「ハウジングエリア」「アパルトメント」行のzh-Hant列から転記):

```ts
  "Mist": {
    "name": { ja: "ミスト・ヴィレッジ", en: "Mist", ko: "안갯빛 마을", zh: "海雾村", "zh-Hant": "海霧村" },
    "apartment_name": { ja: "トップマスト", en: "The Topmast", ko: "중층 돛대", zh: "中桅塔", "zh-Hant": "中桅塔" },
    "aliases": ["ミスト", "ミスビレ", "Mist", "Mis", "Topmast", "トップマスト", "안갯빛 마을", "海雾村", "중층 돛대", "中桅塔", "海霧村"]
  },
```

(LavenderBeds/Goblet/Shirogane/Empyreumも同様にTask1のCSV値から`zh-Hant`を追加。aliasesにも繁体字表記を1件追記)

- [ ] **Step 4: パス確認** — Run: `rtk vitest run src/__tests__/housing/masterParity.test.ts src/__tests__/housing` → PASS(住所抽出既存テストの回帰がないこと)

- [ ] **Step 5: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): MASTER_LANGSにzh-Hant追加+housingAreaMasterDataへzh-Hant値"`

---

### Task 4: 用語辞書生成のzh-Hant対応 + TW新規エントリ

**Files:**
- Modify: `scripts/parse-housing-terms.mjs`
- Modify: `src/lib/housing/housingTerms.ts`
- Modify: `src/data/housing/terms-src/housing-terms.csv`(TW DC・7ワールド分の行を追記)
- Test: `src/lib/housing/__tests__/housingTerms.test.ts`(追記・LOCALES更新)

**Interfaces:**
- Produces: `TermLocale = 'ja'|'en'|'ko'|'zh'|'zh-Hant'`。`displayDcName`/`displayWorldName`がTWも辞書名で返す

- [ ] **Step 1: TW新規エントリの正典データ収集** — CSVに「データセンター (台湾)」「ワールド (台湾)」カテゴリの行を追加する。ja/en/ko/zhは便宜上ローマ字読みまたは簡体字変換で埋め(グローバルでは表示に使わないため精度は問わない)、**zh-Hant列は公式サイト`https://www.ffxiv.com.tw/web/worldstatus/index.aspx`の表記をそのまま使う**(伊弗利特/迦樓羅/利維坦/鳳凰/奧汀/巴哈姆特/泰坦。Task2 Step1で再確認した最新一覧に合わせる):

```csv
データセンター (台湾),TW,TW,TW,TW,台服,公式名称未確認のため内部キーそのまま
ワールド (台湾・伊弗利特),Ifrit,Ifrit,Ifrit,伊弗利特,伊弗利特,公式サイト表記
ワールド (台湾・迦樓羅),Garuda,Garuda,Garuda,迦楼罗,迦樓羅,公式サイト表記
ワールド (台湾・利維坦),Leviathan,Leviathan,Leviathan,利维坦,利維坦,公式サイト表記
ワールド (台湾・鳳凰),Phoenix,Phoenix,Phoenix,凤凰,鳳凰,公式サイト表記
ワールド (台湾・奧汀),Odin,Odin,Odin,奥丁,奧汀,公式サイト表記
ワールド (台湾・巴哈姆特),Bahamut,Bahamut,Bahamut,巴哈姆特,巴哈姆特,公式サイト表記
ワールド (台湾・泰坦),Titan,Titan,Titan,泰坦,泰坦,公式サイト表記
```

- [ ] **Step 2: 失敗するテストを書く** — `housingTerms.test.ts`のLOCALESを更新し追記:

```ts
const LOCALES = ['ja', 'en', 'ko', 'zh', 'zh-Hant'] as const;

// 既存の「全DC/全ワールドに4言語名がある」を5言語に拡張(LOCALES変更のみで既存itが自動追従)

describe('TW辞書', () => {
  it('TW DC/ワールドは繁体字辞書名、グローバルはキーのまま', () => {
    expect(displayWorldName('TW', 'Ifrit', 'zh-Hant')).toBe('伊弗利特');
    expect(displayDcName('TW', 'zh-Hant')).toBe('台服');
    expect(displayWorldName('Elemental', 'Carbuncle', 'zh-Hant')).toBe('Carbuncle'); // グローバル現状維持
  });
});
```

- [ ] **Step 3: 失敗確認** — Run: `rtk vitest run src/lib/housing/__tests__/housingTerms.test.ts` → Expected: FAIL(生成物が4言語のまま/TW未登録)

- [ ] **Step 4: パーサ拡張** — `parse-housing-terms.mjs`のCSV列パース部分を、Task1で追加した`zh-Hant`列を含む形に変更(CSVヘッダーが`カテゴリ,ja,en,ko,zh,zh-Hant,備考`になった前提):

```js
const rows = readFileSync(SRC, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).slice(1)
  .map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));

const asciiKey = (en) => en.replace(/[^A-Za-z0-9]/g, '');
const CN_DC_KEYS = { 'Chocobo (China)': 'ChocoboCN', 'Moogle (China)': 'MoogleCN', 'Fat Cat (China)': 'FatCatCN', 'Mameshiba (China)': 'MameshibaCN' };

const out = { dc: {}, world: {}, area: {}, apartment: {}, aetheryte: {}, district: {}, size: {}, tag: {} };
for (const [cat, ja, en, ko, zh, zhHant] of rows) {
  const entry = { ja, en, ko, zh, 'zh-Hant': zhHant };
  if (cat === 'ハウジングエリア') out.area[ja] = entry;
  else if (cat === 'アパルトメント') out.apartment[ja] = entry;
  else if (cat === '区画表記') out.district[ja] = entry;
  else if (cat === 'エーテライト') out.aetheryte[ja] = entry;
  else if (cat === 'データセンター') out.dc[en] = entry;
  else if (cat === 'データセンター (中国)') out.dc[CN_DC_KEYS[en]] = entry;
  else if (cat === 'データセンター (韓国)') out.dc['Korea'] = entry;
  else if (cat === 'データセンター (台湾)') out.dc['TW'] = entry;
  else if (cat.startsWith('ワールド (中国')) out.world[asciiKey(en)] = entry;
  // 台湾ワールドは asciiKey 変換不要 (内部キーが Ifrit 等の素の英語表記のため)、
  // 下のグローバル/韓国と同じ汎用分岐 (out.world[en] = entry) に自然に乗る。
  else if (cat.startsWith('ワールド')) out.world[en] = entry;
  else if (cat === 'サイズ・種別') out.size[ja] = entry;
  else if (cat.startsWith('タグ')) out.tag[ja] = entry;
}
for (const [k, v] of Object.entries(out)) if (!Object.keys(v).length) throw new Error(`empty kind: ${k}`);
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
```

Run: `node scripts/parse-housing-terms.mjs` で再生成

- [ ] **Step 5: ヘルパー拡張** — `housingTerms.ts`:

```ts
export type TermLocale = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';

const isCnKrTw = (dcKey: string) => {
  const r = regionForDC(dcKey);
  return r === 'KR' || r === 'CN' || r === 'TW';
};

export function displayDcName(dcKey: string, locale: TermLocale): string {
  return isCnKrTw(dcKey) ? termLabel('dc', dcKey, locale) : dcKey;
}

export function displayWorldName(dcKey: string, serverKey: string, locale: TermLocale): string {
  return isCnKrTw(dcKey) ? termLabel('world', serverKey, locale) : serverKey;
}
```

(`termLabel`/`searchNamesFor`のシグネチャは変更なし。`TermLocale`が5値になったことで`Entry = Record<TermLocale, string>`も自動的に5値必須になる)

- [ ] **Step 6: パス確認** — Run: `rtk vitest run src/lib/housing/__tests__/housingTerms.test.ts` → PASS。**この時点でTask9(UI表示)相当のUI側コード変更は不要**であることを確認する(`FilterPanel`/`WorldSelectGate`/`RegisterSectionAddress`等は既に`displayDcName`/`displayWorldName`経由の汎用実装になっているため、辞書にTWが増えれば自動的に反映される。念のため`rtk vitest run src/__tests__/housing/FilterPanel.test.tsx`で回帰がないことを確認)

- [ ] **Step 7: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): 用語辞書をzh-Hant対応+TW DC/ワールド追加(UI表示は既存の辞書経由ロジックが自動追従)"`

---

### Task 5: 既存"zh"衝突判定の是正(回帰テスト最優先)

**Files:**
- Modify: `src/data/housing/regionMap.ts`(`pickRegionLocale`)
- Modify: `src/store/useHousingFilterStore.ts`(`applyLocaleDefaultRegions`)
- Modify: `src/lib/housing/areaName.ts`(`toMasterLang`)
- Test: `src/__tests__/housing/regionMap.test.ts` / `src/__tests__/housing/useHousingFilterStore.test.ts` / 既存の`areaName`テスト(追記)

**Interfaces:**
- Produces: `RegionLocale = 'ja'|'en'|'ko'|'zh'|'zh-Hant'`。`pickRegionLocale('zh-Hant')==='zh-Hant'`かつ`pickRegionLocale('zh-CN')==='zh'`(両立)

- [ ] **Step 1: 失敗するテストを書く** — `regionMap.test.ts`の`pickRegionLocale`describeに追記(**既存の`zh-CN`→`zh`のテストは変更しない**):

```ts
it('zh-Hant を zh(簡体字)と区別する', () => {
  expect(pickRegionLocale('zh-Hant')).toBe('zh-Hant');
  expect(pickRegionLocale('zh-Hant-TW')).toBe('zh-Hant');
  expect(pickRegionLocale('zh-CN')).toBe('zh'); // 既存挙動: 変えない
  expect(pickRegionLocale('zh')).toBe('zh'); // 既存挙動: 変えない
});
```

`useHousingFilterStore`の言語別初期値テスト(既存ファイル、Task5-18-KRCN実装時に追加済み)に追記:

```ts
it('zh-Hant は TW、zh(簡体字)は引き続き CN', () => {
  useHousingFilterStore.setState({ regions: [], regionsTouched: false });
  useHousingFilterStore.getState().applyLocaleDefaultRegions('zh-Hant');
  expect(useHousingFilterStore.getState().regions).toEqual(['TW']);
  useHousingFilterStore.setState({ regions: [], regionsTouched: false });
  useHousingFilterStore.getState().applyLocaleDefaultRegions('zh-CN');
  expect(useHousingFilterStore.getState().regions).toEqual(['CN']); // 既存挙動: 変えない
});
```

`areaName.ts`のテスト(`rtk grep -rl "toMasterLang" src/**/__tests__`で既存テストファイルを特定。無ければ`src/lib/housing/__tests__/areaName.test.ts`を新規作成)に追記:

```ts
it('zh-Hant を zh(簡体字)と区別する', () => {
  expect(toMasterLang('zh-Hant')).toBe('zh-Hant');
  expect(toMasterLang('zh-CN')).toBe('zh'); // 既存挙動: 変えない
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run src/__tests__/housing/regionMap.test.ts src/__tests__/housing/useHousingFilterStore.test.ts` → Expected: FAIL(型エラー/zh-Hantがzhに丸められる)

- [ ] **Step 3: 実装** — `regionMap.ts`:

```ts
export type RegionLocale = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';

export const REGION_LABELS: Record<Region, Record<RegionLocale, string>> = {
    JP: { ja: '日本', en: 'Japan', ko: '일본', zh: '日本', 'zh-Hant': '日本' },
    NA: { ja: '北米', en: 'North America', ko: '북미', zh: '北美', 'zh-Hant': '北美' },
    EU: { ja: '欧州', en: 'Europe', ko: '유럽', zh: '欧洲', 'zh-Hant': '歐洲' },
    OCE: { ja: 'オセアニア', en: 'Oceania', ko: '오세아니아', zh: '大洋洲', 'zh-Hant': '大洋洲' },
    KR: { ja: '韓国', en: 'Korea', ko: '한국', zh: '韩国', 'zh-Hant': '韓國' },
    CN: { ja: '中国', en: 'China', ko: '중국', zh: '中国', 'zh-Hant': '中國' },
    TW: { ja: '台湾', en: 'Taiwan', ko: '대만', zh: '台湾', 'zh-Hant': '台灣' },
};

/** i18n.language ("ja" / "en-US" / "zh-Hant" 等) を RegionLocale に正規化。未知/空は ja。
 *  zh-Hant は zh(簡体字)より先に判定すること (順序を変えると zh-Hant が zh に丸め込まれる)。 */
export function pickRegionLocale(language: string): RegionLocale {
    const lang = (language || 'ja').toLowerCase();
    if (lang === 'zh-hant' || lang.startsWith('zh-hant-')) return 'zh-Hant';
    const head = lang.slice(0, 2);
    if (head === 'en' || head === 'ko' || head === 'zh') return head as RegionLocale;
    return 'ja';
}
```

`useHousingFilterStore.ts`の`applyLocaleDefaultRegions`:

```ts
    applyLocaleDefaultRegions: (lang) => set((s) => {
        const head = (lang || 'ja').toLowerCase();
        const localeDefaultRegions = head === 'zh-hant' || head.startsWith('zh-hant-')
            ? ['TW']
            : head.slice(0, 2) === 'ko' ? ['KR']
            : head.slice(0, 2) === 'zh' ? ['CN']
            : ['JP', 'NA', 'EU', 'OCE'];
        if (s.regionsTouched) return { localeDefaultRegions };
        return { regions: localeDefaultRegions, localeDefaultRegions };
    }),
```

`areaName.ts`の`toMasterLang`:

```ts
export function toMasterLang(lang: string | undefined | null): MasterLang {
  if (!lang) return 'ja';
  const primary = lang.toLowerCase();
  if (primary === 'zh-hant' || primary.startsWith('zh-hant-')) return 'zh-Hant';
  const head = primary.split('-')[0];
  return (MASTER_LANGS as readonly string[]).includes(head) ? (head as MasterLang) : 'ja';
}
```

- [ ] **Step 4: パス確認+全回帰** — Run: `rtk vitest run src/__tests__/housing src/lib/housing/__tests__` → PASS(既存のzh/ko/ja/en挙動が一切変わっていないこと。特に`zh-CN`→`zh`・`ko`→`KR`・素の`zh`→`CN`が既存どおりであることを目視確認)

- [ ] **Step 5: Commit** — `rtk git add -A && rtk git commit -m "fix(housing): zh-Hantとzh(簡体字)の言語コード衝突を是正(pickRegionLocale/applyLocaleDefaultRegions/toMasterLang)"`

---

### Task 6: masterDataにTW追加(住所抽出用)

**Files:**
- Modify: `src/data/masterData.ts`(`serverMasterData`)
- Test: `src/__tests__/housing/masterParity.test.ts`(追記)

**Interfaces:**
- Consumes: Task2の`DC_SERVER_MAP`

- [ ] **Step 1: 失敗するテストを書く** — `masterParity.test.ts`の「2マスター整合」describeは既に`Object.keys(serverMasterData).sort()).toEqual(Object.keys(DC_SERVER_MAP).sort())`のような包括チェックのはずなので、Task2でDC_SERVER_MAPにTWを足した時点でこのテストは自動的にFAILする(serverMasterDataにTWが無いため)。念のため専用ケースも追記:

```ts
it('TW の alias は繁体字ワールド名のみ (英名はグローバル同名ワールドと衝突するため入れない)', () => {
  const twAliases = Object.values(serverMasterData['TW'].servers).flat();
  expect(twAliases).not.toContain('Ifrit'); // Gaia の Ifrit と衝突させない
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run src/__tests__/housing/masterParity.test.ts` → FAIL

- [ ] **Step 3: 実装** — `serverMasterData`の`MameshibaCN`の後に追加(alias方針: 一意解決できる繁体字表記のみ、英名は既存グローバルワールドと衝突するため入れない):

```ts
  // --- 台湾/香港/マカオ/星/馬 (TW / 物理分離) --- alias は繁体字のみ (英名はグローバル同名ワールドと衝突するため入れない)
  "TW": {
    "aliases": ["台服", "台灣", "台湾"],
    "servers": {
      "Ifrit": ["伊弗利特"], "Garuda": ["迦樓羅"], "Leviathan": ["利維坦"], "Phoenix": ["鳳凰"],
      "Odin": ["奧汀"], "Bahamut": ["巴哈姆特"], "Titan": ["泰坦"]
    }
  },
```

- [ ] **Step 4: パス確認** — Run: `rtk vitest run src/__tests__/housing/masterParity.test.ts src/__tests__/housing` → PASS(住所抽出既存テストの回帰がないこと)

- [ ] **Step 5: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): serverMasterDataにTW追加(住所抽出用・繁体字alias)"`

---

### Task 7: ツアー地域ガードにTW追加

**Files:**
- Modify: `src/lib/housing/tourCrossing.ts`(`TravelGroup`型・`travelGroupOf`)
- Test: `src/lib/housing/__tests__/tourCrossing.test.ts`(追記)

**Interfaces:**
- Produces: `travelGroupOf('TW') === 'TW'`。`canAddToTour`/`tourRegionConflict`は`travelGroupOf`経由のため型拡張だけで自動適用

- [ ] **Step 1: 失敗するテストを書く** — `tourCrossing.test.ts`に追記:

```ts
describe('TWリージョン分離', () => {
  it('TW アンカーのトレイに JP/KR/CN は追加できない', () => {
    expect(canAddToTour('TW', 'JP')).toBe(false);
    expect(canAddToTour('TW', 'KR')).toBe(false);
    expect(canAddToTour('TW', 'CN')).toBe(false);
  });
  it('JP アンカーのトレイに TW は追加できない', () => {
    expect(canAddToTour('JP', 'TW')).toBe(false);
  });
  it('TW 同士は追加できる', () => {
    expect(canAddToTour('TW', 'TW')).toBe(true);
  });
  it('OCE 候補は常に可(既存仕様)だが TW 候補は弾かれる', () => {
    expect(canAddToTour('TW', 'OCE')).toBe(true); // 既存仕様: candidateRegion==='OCE' は常にtrue
    expect(canAddToTour('OCE', 'TW')).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run src/lib/housing/__tests__/tourCrossing.test.ts` → Expected: FAIL(`travelGroupOf('TW')`が`'GLOBAL'`扱いになる)

- [ ] **Step 3: 実装** — `tourCrossing.ts`:

```ts
export type TravelGroup = 'GLOBAL' | 'KR' | 'CN' | 'TW';

export function travelGroupOf(region: string): TravelGroup {
  return region === 'KR' ? 'KR' : region === 'CN' ? 'CN' : region === 'TW' ? 'TW' : 'GLOBAL';
}
```

(`canAddToTour`/`tourRegionConflict`/`crossingBetween`は`travelGroupOf`を経由する実装のため無改修で自動追従)

- [ ] **Step 4: パス確認** — Run: `rtk vitest run src/lib/housing/__tests__/tourCrossing.test.ts` → PASS

- [ ] **Step 5: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): ツアー地域ガード(travelGroupOf)にTW追加"`

---

### Task 8: 検索の多言語ヒット拡張

**Files:**
- Modify: `src/lib/housing/listingSearch.ts:44-55`付近(KR/CN対応時に追加された`cnkr`判定)
- Test: `src/__tests__/housing/listingSearch.test.ts`(追記)

**Interfaces:**
- Consumes: Task4の`searchNamesFor`

- [ ] **Step 1: 失敗するテストを書く** — `listingSearch.test.ts`の既存ヘルパー流儀に合わせて追記:

```ts
it('TW の家は 伊弗利特 でヒットする', () => {
  const text = buildListingSearchText(twListing /* dc:'TW', server:'Ifrit', region:'TW' */, t, 'ja', 'ja');
  expect(matchesKeyword(text, '伊弗利特')).toBe(true);
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run src/__tests__/housing/listingSearch.test.ts` → FAIL

- [ ] **Step 3: 実装** — `listingSearch.ts`の既存`cnkr`判定を拡張:

```ts
    // 辞書名でも検索可能に (ko/zh/zh-Hant/en)。KR/CN/TW は ja 名を足さない (カタカナ読み非対応)。
    const cnkrtw = listing.region === 'KR' || listing.region === 'CN' || listing.region === 'TW';
    for (const n of searchNamesFor('world', server, !cnkrtw)) parts.push(n);
    for (const n of searchNamesFor('dc', dc, !cnkrtw)) parts.push(n);
```

(`searchNamesFor`はTermLocaleが5値になった影響でzh-Hant名も含めて返すようになるため、コード変更は変数名リネームのみ)

- [ ] **Step 4: パス確認** — Run: `rtk vitest run src/__tests__/housing/listingSearch.test.ts` → PASS

- [ ] **Step 5: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): 検索がTWのDC/ワールド名(繁体字)でもヒットするよう拡張"`

---

### Task 9: 行き方300区画へのzh-Hant翻訳追加

**Files:**
- Create: `src/data/housing/directions-src/translations/zh-Hant/{mist,lavenderbeds,goblet,shirogane,empyreum}.csv`(計5ファイル、列: `番地,行き方補足`)
- Modify: `scripts/parse-ward-directions.mjs`
- Modify: `src/lib/housing/wardDirections.ts`(`getPlotDirectionsText`のlocale型)
- Test: `src/lib/housing/__tests__/wardDirections.test.ts`(追記)

**Interfaces:**
- Produces: `getPlotDirectionsText(area, plot, 'zh-Hant')`が300区画すべてで非空(jaフォールバックあり)

- [ ] **Step 1: 翻訳ルールで5 CSVを生成**(このステップはLLM作業。1ファイルずつ、jaのCSVと同じ60行順):
  - 既存の`translations/zh/{area}.csv`(簡体字版、KR/CN対応時に作成済み)をベースに、`node scripts/convert-zh-to-hant.mjs`と同じ`opencc-js`(`from:'cn', to:'twp'`)で機械変換して下地を作る
  - 固有名詞は自由訳禁止: エーテライト名/エリア名/アパート名 → Task4で更新した`housingTerms.generated.json`の`zh-Hant`値、S/M/L表記は「S號房屋」等の型で統一(繁体字圏の表記に合わせる)
  - **ASCIIカンマ禁止**(パーサが素朴split)。句読点は全角

- [ ] **Step 2: 完全性テストを書く** — `wardDirections.test.ts`に追記:

```ts
it('全300区画に zh-Hant の行き方がある', () => {
  for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
    for (let plot = 1; plot <= 60; plot++) {
      expect(getPlotDirectionsText(area, plot, 'zh-Hant'), `${area}#${plot}`).toBeTruthy();
    }
  }
});
```

- [ ] **Step 3: 失敗確認** — Run: `rtk vitest run src/lib/housing/__tests__/wardDirections.test.ts` → FAIL(zh-Hant訳が無い)

- [ ] **Step 4: パーサ拡張** — `parse-ward-directions.mjs`:

```js
const LANGS = ['en', 'ko', 'zh', 'zh-Hant'];
```

```js
  for (const plot of Object.keys(byPlot)) {
    byPlot[plot].i18n = {
      en: byLang.en[plot],
      ko: byLang.ko[plot],
      zh: byLang.zh[plot],
      'zh-Hant': byLang['zh-Hant'][plot],
    };
  }
```

`wardDirections.ts`の`getPlotDirectionsText`:

```ts
export function getPlotDirectionsText(
  area: string,
  plot: number | null | undefined,
  locale: 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant',
): string | null {
  if (plot == null || !Number.isInteger(plot)) return null;
  const d = TABLE[area]?.[String(plot)];
  if (!d) return null;
  return (locale !== 'ja' && d.i18n?.[locale]) || d.directions;
}
```

Run: `node scripts/parse-ward-directions.mjs`で再生成

- [ ] **Step 5: パス確認** — Run: `rtk vitest run src/lib/housing/__tests__/wardDirections.test.ts src/__tests__/housing/wardPlotSizes.test.ts` → PASS

- [ ] **Step 6: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): 行き方300区画にzh-Hant翻訳を追加"`

---

### Task 10: フルゲート + Firestoreシード + 実機チェックリスト

**Files:** なし(検証と運用のみ)

- [ ] **Step 1: フルゲート** — Run: `rtk npm run build`(exit 0) → `rtk vitest run`(既知のEphemeralAddPanel 7件以外パス)

- [ ] **Step 2: Firestore /master/servers 再シード** — **ユーザーに確認してから** `npx tsx scripts/seed-servers.ts`(本番Firestore書込。masterData追加分をadmin画面等のFirestore読み系へ同期)。実行前にseed-servers.tsがserverMasterDataをそのまま書くことを読んで確認

- [ ] **Step 3: 実機チェックリストをユーザーへ提示**:
  1. `pickRegionLocale('zh-Hant')`と`applyLocaleDefaultRegions('zh-Hant')`をローカルで単体実行し、地域=台湾になることを確認(LanguageSwitcherにzh-Hantが無いため、i18nの言語を一時的に書き換えるデバッグ操作が必要。手順は実施時に相談)
  2. 既存の日本語/英語/韓国語/簡体字ブラウズが従来どおりであること(回帰)
  3. 地域=台湾でDC・ワールド選択肢がTWのものになる(繁体字表示)
  4. テストで台湾の家を登録 → ja既定では出ない・地域=台湾で出る → 確認後削除
  5. トレイにJPの家がある状態で台湾の家が追加できない(理由表示)
  6. 行き方がzh-Hantで表示される(住所は変えず言語だけ切替えて確認)

- [ ] **Step 4: pushはユーザー承認後** — デプロイはバッチ方針(未pushのdocsコミットも同乗)

---

## Self-Review 済みメモ

- スペック§0(正典データ不在)→T1、§1(マスターデータ設計)→T2/T3、§2(用語辞書)→T1/T4、§3(zh衝突是正)→T5(ハウジング関連のみ、非housing 6ファイルはPhase②へ明示的に繰越)、§4(フィルター初期表示)→T5、§5(登録ページ)→T2/T6(登録APIのDC/ワールド実在検証は既存のDC_SERVER_MAP汎用検証がTask2で自動適用されるためコード変更なし・テストのみ)、§6(ツアー地域ガード)→T7、§7(検索)→T8、§8(UI表示名の辞書接続)→T4で自動追従(既存コンポーネントが辞書関数経由の汎用実装のため無改修)、§9(行き方翻訳)→T9、§10(テストと検証)→T10
- 型整合: `TermLocale`(T4)・`RegionLocale`(T5)・`MasterLang`(T3)の3つの型はすべて`'ja'|'en'|'ko'|'zh'|'zh-Hant'`で統一。`displayDcName(dcKey, locale: TermLocale)`のシグネチャはT4定義のまま変更なし
- 既知リスク: Task2 Step1(DC名・ワールド数の最終確認)の結果次第でTask2/4/6のコード例(DCキー`'TW'`・ワールド一覧)を調整する必要がある。複数DCだった場合はKR/CN(4DC)を参考に`TW1`/`TW2`のような命名に分ける
- Phase②(軽減表の画面文言)への繰越事項: `src/types/index.ts`・`MobileContextMenu.tsx`・`LimitResolutionSheet.tsx`・`MitigationSheetPreview.tsx`・`SystemNotificationModal.tsx`・`SystemNotificationBar.tsx`の"zh"衝突判定是正、および`i18n.ts`/`useThemeStore.ts`/`LanguageSwitcher.tsx`へのzh-Hant追加
