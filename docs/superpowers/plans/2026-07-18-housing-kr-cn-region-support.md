# ハウジング中韓リージョン対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 韓国(1DC/5鯖)・中国(4DC/28鯖)のハウジングを登録・閲覧・ツアーできるようにし、グローバルと構造的に混在不可能にする。

**Architecture:** 静的マスター2系統(dcServerMap=閲覧/ツアー用、masterData=登録/住所抽出用)の両方に KR/CN を追加し、整合テストで恒久的にドリフトを防ぐ。訳語は正典CSV→生成スクリプト→JSON辞書。既存のツアー地域ガード(canAddToTour)は Region 型拡張だけで自動適用される。

**Tech Stack:** React+TS+Vite / vitest / 生成スクリプト=Node mjs / Firestore(スキーマ変更なし・/master/servers 再シードのみ)

**Spec:** `docs/superpowers/specs/2026-07-18-housing-kr-cn-region-support-design.md`

## Global Constraints

- 内部キー(dc/server)は一度決めたら**変更不可**(Firestore listing に保存されるため)
- `src/utils/housingValidation.ts` は api からも import される → そこへの新規 import は **`.js` 拡張子必須**(Vercel Node ESM)。生成 JSON を api 側から import しない(Vercel Node は JSON import 不可)
- ロケール JSON は該当ブロックのみ textual 編集(全体 parse→stringify 禁止・4言語 parity 維持)
- 住所抽出の alias は「一意に解決できる名前」のみ追加(造語・衝突する名前は追加しない)。**衝突既知: CN ワールド Shirogane の zh「白银乡」/ko「시로가네」はエリア名と衝突するため alias に入れない**
- vitest は対象ファイル指定で実行、フルは push 前ゲートのみ。出力をパイプしない
- コミットは各タスク末尾で1回。push はしない(最後にユーザー承認後まとめて)
- UI 表示ルール: **KR/CN の DC/ワールドは全ロケールで辞書表示名、グローバルは現状表示(内部キー=英名)を変えない**

---

### Task 1: dcServerMap / regionMap 拡張 (Region 型 + KR/CN + グローバル最新化)

**Files:**
- Modify: `src/data/housing/dcServerMap.ts`
- Modify: `src/data/housing/regionMap.ts`
- Test: `src/lib/housing/__tests__/tourCrossing.test.ts` (追記) / `src/__tests__/housing/regionMap.test.ts` (追記)

**Interfaces:**
- Produces: `Region = 'JP'|'NA'|'EU'|'OCE'|'KR'|'CN'`、DC キー `Korea / ChocoboCN / MoogleCN / FatCatCN / MameshibaCN`、`regionForDC('Shadow')==='EU'`

- [ ] **Step 1: 失敗するテストを書く** — `src/lib/housing/__tests__/tourCrossing.test.ts` に追記:

```ts
describe('KR/CN リージョン分離', () => {
  it('KR アンカーのトレイに JP は追加できない', () => {
    expect(canAddToTour('KR', 'JP')).toBe(false);
  });
  it('JP アンカーのトレイに KR/CN は追加できない', () => {
    expect(canAddToTour('JP', 'KR')).toBe(false);
    expect(canAddToTour('JP', 'CN')).toBe(false);
  });
  it('CN 同士は追加できる(4DC を 1 地域として扱う)', () => {
    expect(canAddToTour('CN', 'CN')).toBe(true);
  });
  it('KR/CN と OCE の混在は許さない方向のみ許可される(OCE 候補は常に可の既存仕様)', () => {
    // 既存仕様: candidateRegion==='OCE' は常に true。KR アンカーに OCE 候補が乗るのは
    // ゲーム的に誤りだが、既存 OCE 例外の挙動変更はスコープ外 (spec §4)。KR 候補側は弾かれることを固定。
    expect(canAddToTour('OCE', 'KR')).toBe(false);
  });
});
```

`src/__tests__/housing/regionMap.test.ts` に追記:

```ts
import { DC_SERVER_MAP, regionForDC, ALL_REGIONS } from '../../data/housing/dcServerMap';
import { REGION_LABELS } from '../../data/housing/regionMap';

describe('KR/CN マスター', () => {
  it('Shadow は EU、Dynamis は 8 ワールド', () => {
    expect(regionForDC('Shadow')).toBe('EU');
    expect(DC_SERVER_MAP['Dynamis'].servers).toHaveLength(8);
  });
  it('Korea は KR で 5 ワールド、CN は 4DC 計 28 ワールド', () => {
    expect(regionForDC('Korea')).toBe('KR');
    expect(DC_SERVER_MAP['Korea'].servers).toHaveLength(5);
    const cnDcs = ['ChocoboCN', 'MoogleCN', 'FatCatCN', 'MameshibaCN'];
    expect(cnDcs.every((d) => regionForDC(d) === 'CN')).toBe(true);
    expect(cnDcs.reduce((n, d) => n + DC_SERVER_MAP[d].servers.length, 0)).toBe(28);
  });
  it('全リージョンに 4 言語ラベルがある', () => {
    for (const r of ALL_REGIONS) {
      for (const l of ['ja', 'en', 'ko', 'zh'] as const) {
        expect(REGION_LABELS[r][l]).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run src/lib/housing/__tests__/tourCrossing.test.ts src/__tests__/housing/regionMap.test.ts` → Expected: FAIL (型エラー/Korea 不在)

- [ ] **Step 3: 実装** — `dcServerMap.ts`:

```ts
export type Region = 'JP' | 'NA' | 'EU' | 'OCE' | 'KR' | 'CN';
```

`Dynamis` 行を差し替え、`Materia` の後に追加:

```ts
    Dynamis: { region: 'NA', servers: ['Halicarnassus', 'Maduin', 'Marilith', 'Seraph', 'Cuchulainn', 'Golem', 'Kraken', 'Rafflesia'] },
    // ...(既存 Chaos/Light はそのまま)
    Shadow: { region: 'EU', servers: ['Innocence', 'Pixie', 'Titania', 'Tycoon'] },
    Materia: { region: 'OCE', servers: ['Bismarck', 'Ravana', 'Sephirot', 'Sophia', 'Zurvan'] },
    // 韓国 (物理分離リージョン)。ワールド名はグローバルと同名だが dc+server の組で常に区別される。
    Korea: { region: 'KR', servers: ['Carbuncle', 'Chocobo', 'Moogle', 'Tonberry', 'Fenrir'] },
    // 中国 (物理分離リージョン)。内部キーは正典 CSV の en 列を英数字のみに詰めた CamelCase。
    ChocoboCN: { region: 'CN', servers: ['RubySea', 'Yanxia', 'Haimaochaya', 'CosmicHarmony', 'PhantomIslands', 'TheHolyGround', 'SproutPond', 'AmberPlains'] },
    MoogleCN: { region: 'CN', servers: ['Shirogane', 'RhalgrsReach', 'PlatinumMirage', 'TravelersDock', 'TheDawnChamber', 'TheAery', 'DreamfeatherRealm', 'HaukkeManor'] },
    FatCatCN: { region: 'CN', servers: ['AmethystShallows', 'MorDhona', 'TheGreatWall', 'BreezyBeach', 'TheAurumVale', 'CrescentCove', 'TheLostCity'] },
    MameshibaCN: { region: 'CN', servers: ['TheCrystalTower', 'SilvertearLake', 'CostaDelSol', 'Ishgard', 'BlackTeaRiver'] },
```

```ts
export const ALL_REGIONS: Region[] = ['JP', 'NA', 'EU', 'OCE', 'KR', 'CN'];
```

`regionMap.ts` の `REGION_LABELS` に追加:

```ts
    KR: { ja: '韓国', en: 'Korea', ko: '한국', zh: '韩国' },
    CN: { ja: '中国', en: 'China', ko: '중국', zh: '中国' },
```

- [ ] **Step 4: パス確認** — Run: 同上 → Expected: PASS。ついで `rtk vitest run src/__tests__/housing` で既存回帰がないこと(REGION_LABELS を列挙するスナップショット系があれば追従修正)
- [ ] **Step 5: Commit** — `rtk git add -A && rtk git commit -m "feat(housing): Region型にKR/CN追加+Korea/中国4DC+Shadow/Dynamis8のグローバル最新化"`

---

### Task 2: 用語辞書 (正典 CSV → 生成 JSON + ヘルパー)

**Files:**
- Create: `src/data/housing/terms-src/housing-terms.csv` (正典。`docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv` をコピー。公式ゲーム用語のみで機密なし=コミット可)
- Create: `scripts/parse-housing-terms.mjs`
- Create: `src/data/housing/housingTerms.generated.json`
- Create: `src/lib/housing/housingTerms.ts`
- Test: `src/lib/housing/__tests__/housingTerms.test.ts`

**Interfaces:**
- Produces: `termLabel(kind: 'dc'|'world'|'area'|'apartment'|'aetheryte'|'district', key: string, locale: 'ja'|'en'|'ko'|'zh'): string`(未登録キーはそのまま返す)/ `displayDcName(dcKey, locale)` / `displayWorldName(dcKey, serverKey, locale)`(**KR/CN のみ辞書名・グローバルはキーのまま**)/ `searchNamesFor(kind, key): string[]`
- Consumes: Task 1 の `regionForDC`

- [ ] **Step 1: CSV を配置** — `mkdir src/data/housing/terms-src` 後、`cp docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv src/data/housing/terms-src/housing-terms.csv`
- [ ] **Step 2: 失敗するテストを書く** — `housingTerms.test.ts`:

```ts
import { DC_SERVER_MAP } from '../../../data/housing/dcServerMap';
import terms from '../../../data/housing/housingTerms.generated.json';
import { termLabel, displayWorldName, displayDcName } from '../housingTerms';

const LOCALES = ['ja', 'en', 'ko', 'zh'] as const;

describe('housingTerms 完全性', () => {
  it('全 DC / 全ワールドに 4 言語名がある', () => {
    for (const [dc, { servers }] of Object.entries(DC_SERVER_MAP)) {
      for (const l of LOCALES) expect((terms as any).dc[dc]?.[l], `dc ${dc} ${l}`).toBeTruthy();
      for (const s of servers) for (const l of LOCALES) expect((terms as any).world[s]?.[l], `world ${s} ${l}`).toBeTruthy();
    }
  });
  it('KR/CN は辞書名、グローバルはキーのまま表示', () => {
    expect(displayWorldName('Korea', 'Carbuncle', 'ko')).toBe('카벙클');
    expect(displayWorldName('ChocoboCN', 'RubySea', 'ja')).toBe('紅玉海');
    expect(displayDcName('MameshibaCN', 'zh')).toBe('豆豆柴');
    expect(displayWorldName('Elemental', 'Carbuncle', 'ko')).toBe('Carbuncle'); // グローバル現状維持
    expect(displayDcName('Elemental', 'ja')).toBe('Elemental');
  });
  it('エーテライト名は ja キーで引ける', () => {
    expect(termLabel('aetheryte', 'ミストゲート・スクエア', 'zh')).toBe('雾门广场');
    expect(termLabel('aetheryte', '未知の名前', 'zh')).toBe('未知の名前'); // フォールバック
  });
});
```

- [ ] **Step 3: 失敗確認** — Run: `rtk vitest run src/lib/housing/__tests__/housingTerms.test.ts` → FAIL (生成物なし)
- [ ] **Step 4: パーサ実装** — `scripts/parse-housing-terms.mjs`(素朴 comma split・`parse-ward-directions.mjs` と同流儀):

```js
// 使い方: node scripts/parse-housing-terms.mjs
// 正典: src/data/housing/terms-src/housing-terms.csv → src/data/housing/housingTerms.generated.json
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'src/data/housing/terms-src/housing-terms.csv';
const OUT = 'src/data/housing/housingTerms.generated.json';
// CSV は素朴に , split (本文にASCIIカンマ禁止)。BOM を剥がす。
const rows = readFileSync(SRC, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).slice(1)
  .map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));

const asciiKey = (en) => en.replace(/[^A-Za-z0-9]/g, ''); // 中国ワールド内部キー
const CN_DC_KEYS = { 'Chocobo (China)': 'ChocoboCN', 'Moogle (China)': 'MoogleCN', 'Fat Cat (China)': 'FatCatCN', 'Mameshiba (China)': 'MameshibaCN' };

const out = { dc: {}, world: {}, area: {}, apartment: {}, aetheryte: {}, district: {}, size: {}, tag: {} };
for (const [cat, ja, en, ko, zh] of rows) {
  const entry = { ja, en, ko, zh };
  if (cat === 'ハウジングエリア') out.area[ja] = entry;
  else if (cat === 'アパルトメント') out.apartment[ja] = entry;
  else if (cat === '区画表記') out.district[ja] = entry;
  else if (cat === 'エーテライト') out.aetheryte[ja] = entry;
  else if (cat === 'データセンター') out.dc[en] = entry;                       // グローバル: キー=en
  else if (cat === 'データセンター (中国)') out.dc[CN_DC_KEYS[en]] = entry;
  else if (cat === 'データセンター (韓国)') out.dc['Korea'] = entry;
  else if (cat.startsWith('ワールド (中国')) out.world[asciiKey(en)] = entry;   // CN: キー=en詰め
  else if (cat.startsWith('ワールド')) out.world[en] = entry;                   // グローバル/韓国: キー=en (韓国5鯖は同名同訳で共存OK)
  else if (cat === 'サイズ・種別') out.size[ja] = entry;
  else if (cat.startsWith('タグ')) out.tag[ja] = entry;
}
for (const [k, v] of Object.entries(out)) if (!Object.keys(v).length) throw new Error(`empty kind: ${k}`);
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('housingTerms.generated.json:', Object.entries(out).map(([k, v]) => `${k}=${Object.keys(v).length}`).join(' '));
```

Run: `node scripts/parse-housing-terms.mjs` → Expected: 各 kind の件数表示 (dc=17, world≥85, aetheryte≈92 目安)

- [ ] **Step 5: ヘルパー実装** — `src/lib/housing/housingTerms.ts`:

```ts
import terms from '../../data/housing/housingTerms.generated.json';
import { regionForDC } from '../../data/housing/dcServerMap';

export type TermLocale = 'ja' | 'en' | 'ko' | 'zh';
export type TermKind = 'dc' | 'world' | 'area' | 'apartment' | 'aetheryte' | 'district' | 'size' | 'tag';
type Entry = Record<TermLocale, string>;
const TABLE = terms as Record<TermKind, Record<string, Entry>>;

/** 辞書名。未登録キーはそのまま返す (壊さないフォールバック)。 */
export function termLabel(kind: TermKind, key: string, locale: TermLocale): string {
  return TABLE[kind]?.[key]?.[locale] ?? key;
}

const isCnKr = (dcKey: string) => { const r = regionForDC(dcKey); return r === 'KR' || r === 'CN'; };

/** DC 表示名: KR/CN のみ全ロケール辞書名、グローバルは現状表示 (内部キー=英名) を維持。 */
export function displayDcName(dcKey: string, locale: TermLocale): string {
  return isCnKr(dcKey) ? termLabel('dc', dcKey, locale) : dcKey;
}

/** ワールド表示名: 所属 DC が KR/CN のときのみ辞書名。 */
export function displayWorldName(dcKey: string, serverKey: string, locale: TermLocale): string {
  return isCnKr(dcKey) ? termLabel('world', serverKey, locale) : serverKey;
}

/** 検索用の別名 (キー自身と ja を除く en/ko/zh。ja を含めたい場合は includeJa)。 */
export function searchNamesFor(kind: TermKind, key: string, includeJa = false): string[] {
  const e = TABLE[kind]?.[key];
  if (!e) return [];
  const names = includeJa ? [e.ja, e.en, e.ko, e.zh] : [e.en, e.ko, e.zh];
  return [...new Set(names)].filter((n) => n && n !== key);
}
```

- [ ] **Step 6: パス確認** — Run: `rtk vitest run src/lib/housing/__tests__/housingTerms.test.ts` → PASS
- [ ] **Step 7: Commit** — `feat(housing): 用語辞書(正典CSV→生成JSON+termLabel/display*ヘルパー)`

---

### Task 3: masterData に KR/CN 追加 (登録フォーム/住所抽出) + 2 マスター整合テスト

**Files:**
- Modify: `src/data/masterData.ts` (`serverMasterData` に 5 DC 追加 / `housingAreaMasterData` の ko・zh 実値化)
- Test: `src/__tests__/housing/masterParity.test.ts` (新規)

**Interfaces:**
- Consumes: Task 1 の `DC_SERVER_MAP`
- Produces: 登録フォームの DC/サーバー選択肢に KR/CN が出る (RegisterSectionAddress は `serverMasterData` の keys を直接列挙するため追加だけで反映)

- [ ] **Step 1: 失敗するテストを書く** — `masterParity.test.ts`:

```ts
import { DC_SERVER_MAP } from '../../data/housing/dcServerMap';
import { serverMasterData, housingAreaMasterData } from '../../data/masterData';

describe('2マスター整合 (dcServerMap ⟷ masterData)', () => {
  it('DC 集合とワールド集合が完全一致する (ドリフト防止)', () => {
    expect(Object.keys(serverMasterData).sort()).toEqual(Object.keys(DC_SERVER_MAP).sort());
    for (const [dc, { servers }] of Object.entries(DC_SERVER_MAP)) {
      expect(Object.keys(serverMasterData[dc].servers).sort(), `dc ${dc}`).toEqual([...servers].sort());
    }
  });
  it('エリア名 ko/zh が実値 (ja のままの placeholder が残っていない)', () => {
    for (const [key, a] of Object.entries(housingAreaMasterData)) {
      expect(a.name.ko, `${key} name.ko`).not.toBe(a.name.ja);
      expect(a.name.zh, `${key} name.zh`).not.toBe(a.name.ja);
      expect(a.apartment_name.ko, `${key} apartment.ko`).not.toBe(a.apartment_name.ja);
      expect(a.apartment_name.zh, `${key} apartment.zh`).not.toBe(a.apartment_name.ja);
    }
  });
  it('alias はグローバル既存 alias と衝突しない (KR 英名 / CN 白银乡 を入れていない)', () => {
    const krAliases = Object.values(serverMasterData['Korea'].servers).flat();
    expect(krAliases).not.toContain('Carbuncle');
    const cnMoogleAliases = Object.values(serverMasterData['MoogleCN'].servers).flat();
    expect(cnMoogleAliases).not.toContain('白银乡');
    expect(cnMoogleAliases).not.toContain('시로가네');
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run src/__tests__/housing/masterParity.test.ts` → FAIL
- [ ] **Step 3: 実装** — `serverMasterData` の `Materia` の後に追加。**alias 方針: 一意解決できる名前のみ**(KR=ハングル名のみ・CN=中文名のみ・例外として `Shirogane`(莫古力) はエリア名と衝突するため alias 空):

```ts
  // --- 韓国 (KR / 物理分離) --- alias はハングルのみ (英名はグローバル同名ワールドと衝突するため入れない)
  "Korea": {
    "aliases": ["한국", "韓国"],
    "servers": {
      "Carbuncle": ["카벙클"],
      "Chocobo": ["초코보"],
      "Moogle": ["모그리"],
      "Tonberry": ["톤베리"],
      "Fenrir": ["펜리르"]
    }
  },
  // --- 中国 (CN / 物理分離) --- alias は中文のみ。白银乡はエリア名と衝突するため alias なし
  "ChocoboCN": {
    "aliases": ["陆行鸟"],
    "servers": {
      "RubySea": ["红玉海"], "Yanxia": ["延夏"], "Haimaochaya": ["海猫茶屋"], "CosmicHarmony": ["宇宙和音"],
      "PhantomIslands": ["幻影群岛"], "TheHolyGround": ["神意之地"], "SproutPond": ["萌芽池"], "AmberPlains": ["琥珀原"]
    }
  },
  "MoogleCN": {
    "aliases": ["莫古力"],
    "servers": {
      "Shirogane": [], "RhalgrsReach": ["神拳痕"], "PlatinumMirage": ["白金幻象"], "TravelersDock": ["旅人栈桥"],
      "TheDawnChamber": ["拂晓之间"], "TheAery": ["龙巢神殿"], "DreamfeatherRealm": ["梦羽宝境"], "HaukkeManor": ["静语庄园"]
    }
  },
  "FatCatCN": {
    "aliases": ["猫小胖"],
    "servers": {
      "AmethystShallows": ["紫水栈桥"], "MorDhona": ["摩杜纳"], "TheGreatWall": ["墙壁江山"], "BreezyBeach": ["柔风海滩"],
      "TheAurumVale": ["黄金谷"], "CrescentCove": ["月牙湾"], "TheLostCity": ["异界遗迹"]
    }
  },
  "MameshibaCN": {
    "aliases": ["豆豆柴"],
    "servers": {
      "TheCrystalTower": ["水晶塔"], "SilvertearLake": ["银泪湖"], "CostaDelSol": ["太阳海岸"], "Ishgard": ["伊修加德"], "BlackTeaRiver": ["红茶川"]
    }
  },
```

`housingAreaMasterData` の ko/zh を正典 CSV の実値へ差し替え(name と apartment_name の両方。値は `src/data/housing/terms-src/housing-terms.csv` の「ハウジングエリア」「アパルトメント」行から転記。例: Mist → ko `안갯빛 마을` / zh `海雾村`、Topmast → ko `중층 돛대` / zh `中桅塔`)。aliases に ko/zh 公式名を追記 (例 Mist: `"안갯빛 마을", "海雾村", "중층 돛대", "中桅塔"`)。

- [ ] **Step 4: パス確認** — Run: `rtk vitest run src/__tests__/housing/masterParity.test.ts src/__tests__/housing` → PASS (住所抽出既存テストの回帰がないこと)
- [ ] **Step 5: Commit** — `feat(housing): masterDataにKR/CN追加(登録/住所抽出)+2マスター整合テスト+エリア名ko/zh実値`

---

### Task 4: 登録 API の DC/ワールド実在検証

**Files:**
- Modify: `src/utils/housingValidation.ts:98-100` 付近
- Modify: `src/locales/{ja,en,ko,zh}.json` (エラーキー追加・textual 編集)
- Test: `src/__tests__/housing/housingValidation.test.ts` があれば追記、無ければ `src/__tests__/housing/addressExistsValidation.test.ts` 新規

**Interfaces:**
- Consumes: Task 1 の `DC_SERVER_MAP` / `serversForDC` (**import は `.js` 拡張子**: `../data/housing/dcServerMap.js`)
- Produces: `validateAddress` が `errors.dc='unknown'` / `errors.server='unknown'` を返す

- [ ] **Step 1: 失敗するテストを書く**:

```ts
import { validateAddress } from '../../utils/housingValidation';

const base = { area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'S' } as const;

describe('DC/ワールド実在検証', () => {
  it('実在しない DC を弾く', () => {
    const r = validateAddress({ ...base, dc: 'Nonexistent', server: 'Aegis' });
    expect(r.ok).toBe(false); expect(r.errors.dc).toBe('unknown');
  });
  it('DC 配下に無いワールドを弾く (KR の Carbuncle を JP DC で名乗る等)', () => {
    const r = validateAddress({ ...base, dc: 'Korea', server: 'Aegis' });
    expect(r.ok).toBe(false); expect(r.errors.server).toBe('unknown');
  });
  it('KR/CN の正しい組は通る', () => {
    expect(validateAddress({ ...base, dc: 'Korea', server: 'Carbuncle' }).ok).toBe(true);
    expect(validateAddress({ ...base, dc: 'ChocoboCN', server: 'RubySea' }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `rtk vitest run <上記テスト>` → FAIL
- [ ] **Step 3: 実装** — `housingValidation.ts` 冒頭に `import { DC_SERVER_MAP, serversForDC } from '../data/housing/dcServerMap.js';` を追加し、`validateAddress` の必須チェック直後へ:

```ts
  // DC/ワールドの実在検証 (2026-07-18 中韓対応)。未知 DC は登録させない。
  if (!errors.dc && !DC_SERVER_MAP[addr.dc]) errors.dc = 'unknown';
  if (!errors.dc && !errors.server && !serversForDC(addr.dc).includes(addr.server)) errors.server = 'unknown';
```

- [ ] **Step 4: エラーメッセージ i18n** — `rtk grep "out_of_range" src/locales/ja.json` で登録エラーのキー名前空間を特定し、同じ場所に `unknown` 用の文言を 4 言語 textual 追記 (ja例: 「存在しないデータセンター/ワールドです。選択肢から選んでください」)。エラー表示コンポーネントが `errors.dc` のコード値をキーに変換している箇所も grep で確認して追従。
- [ ] **Step 5: パス確認+回帰** — Run: `rtk vitest run src/__tests__/housing` → PASS
- [ ] **Step 6: Commit** — `feat(housing): 登録のDC/ワールド実在検証(dc+server組をマスター照合)`

---

### Task 5: 地域フィルターの言語別初期値

**Files:**
- Modify: `src/store/useHousingFilterStore.ts`
- Modify: `src/components/housing/shell/HousingShell.tsx` (mount effect 追加。ファイル位置は `rtk grep -l "HousingShell" src/components/housing/shell` で確定)
- Modify: `src/components/housing/workspace/FilterPanel.tsx:101` (アクティブ判定を `regionsTouched` ベースに)
- Test: `src/__tests__/housing/useHousingFilterStore.test.ts` (追記)

**Interfaces:**
- Produces: `applyLocaleDefaultRegions(lang: string): void` / `regionsTouched: boolean`(store)
- 初期値: ko→`['KR']` / zh→`['CN']` / それ以外→`['JP','NA','EU','OCE']`(現状の見え方維持)

- [ ] **Step 1: 失敗するテストを書く** — store テストに追記:

```ts
describe('言語別の地域初期値', () => {
  beforeEach(() => useHousingFilterStore.getState().clearAll()); // 注: clearAll は touched を立てるので直接 setState でリセット
  it('ko は KR、zh は CN、ja/en は全グローバル', () => {
    useHousingFilterStore.setState({ regions: [], regionsTouched: false });
    useHousingFilterStore.getState().applyLocaleDefaultRegions('ko');
    expect(useHousingFilterStore.getState().regions).toEqual(['KR']);
    useHousingFilterStore.setState({ regions: [], regionsTouched: false });
    useHousingFilterStore.getState().applyLocaleDefaultRegions('ja');
    expect(useHousingFilterStore.getState().regions).toEqual(['JP', 'NA', 'EU', 'OCE']);
  });
  it('ユーザーが触った後は言語切替で上書きしない', () => {
    useHousingFilterStore.setState({ regions: [], regionsTouched: false });
    useHousingFilterStore.getState().toggleRegion('JP');
    useHousingFilterStore.getState().applyLocaleDefaultRegions('ko');
    expect(useHousingFilterStore.getState().regions).toEqual(['JP']);
  });
});
```

- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装** — store:

```ts
    regionsTouched: false,
    // 言語→地域の初期値 (spec: B案=言語は初期値のみ)。ユーザー操作後 (touched) は何もしない。
    applyLocaleDefaultRegions: (lang) => set((s) => {
        if (s.regionsTouched) return {};
        const head = (lang || 'ja').slice(0, 2).toLowerCase();
        const regions = head === 'ko' ? ['KR'] : head === 'zh' ? ['CN'] : ['JP', 'NA', 'EU', 'OCE'];
        return { regions };
    }),
    toggleRegion: (region) => set((s) => ({ regions: toggleInArray(s.regions, region), regionsTouched: true })),
```

`clearAll` にも `regionsTouched: true` を追加。interface に 2 メンバー追記。
HousingShell の mount effect:

```tsx
const { i18n } = useTranslation();
const applyLocaleDefaultRegions = useHousingFilterStore((s) => s.applyLocaleDefaultRegions);
useEffect(() => { applyLocaleDefaultRegions(i18n.language); }, [i18n.language, applyLocaleDefaultRegions]);
```

FilterPanel:101 のアクティブ判定: `regions.length > 0` を `useHousingFilterStore((s) => s.regionsTouched)` 由来の `regionsTouched` に置換(言語既定の 4 地域選択で「フィルター中」バッジを常時点灯させない)。

- [ ] **Step 4: パス確認** — store テスト+ `rtk vitest run src/__tests__/housing/FilterPanel.test.tsx src/__tests__/housing/HousingShell.test.tsx`(既存が regions=[] 前提なら追従修正)→ PASS
- [ ] **Step 5: Commit** — `feat(housing): 言語別の地域フィルター初期値(ko=韓国/zh=中国/ja,en=全グローバル)`

---

### Task 6: 検索の多言語ヒット

**Files:**
- Modify: `src/lib/housing/listingSearch.ts:44-55`
- Test: `src/__tests__/housing/listingSearch.test.ts` (追記)

**Interfaces:**
- Consumes: Task 2 の `searchNamesFor`

- [ ] **Step 1: 失敗するテストを書く**(既存テストのヘルパー流儀に合わせて listing を組む):

```ts
it('KR の家は 카벙클 でヒットし、カーバンクル では(地域名以外で)ヒットさせない', () => {
  const text = buildListingSearchText(krListing /* dc:'Korea', server:'Carbuncle', region:'KR' */, t, 'ja', 'ja');
  expect(matchesKeyword(text, '카벙클')).toBe(true);
  expect(matchesKeyword(text, 'カーバンクル')).toBe(false); // spec §5: KR にカタカナ読みを足さない
});
it('CN の家は 红玉海 でも RubySea でもヒットする', () => {
  const text = buildListingSearchText(cnListing /* dc:'ChocoboCN', server:'RubySea', region:'CN' */, t, 'ja', 'ja');
  expect(matchesKeyword(text, '红玉海')).toBe(true);
});
it('グローバルの家は ko/zh 名でもヒットする (卡邦克鲁 → JP Carbuncle)', () => {
  const text = buildListingSearchText(jpListing, t, 'ja', 'ja');
  expect(matchesKeyword(text, '卡邦克鲁')).toBe(true);
});
```

- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装** — `listingSearch.ts` の kana push の直後に:

```ts
    // 辞書名でも検索可能に (ko/zh/en)。KR/CN は ja 名を足さない (カタカナ読み非対応・spec §5)。
    const cnkr = listing.region === 'KR' || listing.region === 'CN';
    for (const n of searchNamesFor('world', server, !cnkr)) parts.push(n);
    for (const n of searchNamesFor('dc', dc, !cnkr)) parts.push(n);
```

(`searchNamesFor(kind, key, includeJa)` — includeJa=true はグローバルのみ。import 追加: `import { searchNamesFor } from './housingTerms';`)

- [ ] **Step 4: パス確認** — Run: `rtk vitest run src/__tests__/housing/listingSearch.test.ts` → PASS
- [ ] **Step 5: Commit** — `feat(housing): 検索がDC/ワールドの多言語名でヒット(KR/CNはja読みを意図的に除外)`

---

### Task 7: UI 表示名の辞書接続 (DC/ワールド選択肢 + エーテライト表示)

**Files:**
- Modify: `src/components/housing/workspace/FilterPanel.tsx` (DC/サーバー選択肢の label)
- Modify: `src/components/housing/browse/map/WorldSelectGate.tsx:46` (DC/ワールド label)
- Modify: `src/components/housing/register/RegisterSectionAddress.tsx:51-52` (DC/サーバー option の label)
- Modify: エーテライト表示 7 箇所 — `TourNavPage.tsx:103` / `TourPhaseZone.tsx:60` / `JoinTourPage.tsx:44` (teleport_to 補間) + `HousingDetailMap.tsx:67` / `RegisterAddressMap.tsx:86` / `useTourRenderModel.ts:102` / `buildTourMapPlacements.ts:85` 由来の描画 (originName)
- Test: `src/__tests__/housing/FilterPanel.test.tsx` 追記

**Interfaces:**
- Consumes: Task 2 の `displayDcName` / `displayWorldName` / `termLabel('aetheryte', jaName, locale)`
- 原則: **モデル/キー/地図 lookup は ja・内部キーのまま。表示直前でのみ変換**(plotOrigin/plotBearing の `norm(dir.aetheryte)` は触らない)

- [ ] **Step 1: 失敗するテストを書く** — FilterPanel テストに「locale=zh で DC 選択肢に 陆行鸟 が表示される」「locale=ja でグローバル DC は Elemental のまま」を追記(既存のレンダーテスト流儀に従う)
- [ ] **Step 2: 失敗確認** → FAIL
- [ ] **Step 3: 実装** — 各選択肢の label 生成を差し替え(value は内部キーのまま!):

```tsx
// FilterPanel (DC): options={filteredDCs.map((d) => ({ value: d, label: displayDcName(d, locale) }))}
// FilterPanel (server): options={availableServers.map((s) => ({ value: s, label: displayWorldName(dc!, s, locale) }))}
// RegisterSectionAddress: <option value={k}>{displayDcName(k, pickRegionLocale(i18n.language))}</option> 等
```

エーテライト: teleport_to の 3 箇所を `{ aetheryte: termLabel('aetheryte', directions.aetheryte, locale) }` に。originName は**描画コンポーネント側**(HousingDetailMap:67 / RegisterAddressMap:86 と、useTourRenderModel の originName を受けて描く TourNavMap 系)で `termLabel('aetheryte', name, locale)` を通す。locale は `pickRegionLocale(i18n.language)`。

- [ ] **Step 4: パス確認** — `rtk vitest run src/__tests__/housing/FilterPanel.test.tsx src/__tests__/housing` → PASS(既存スナップショット追従)
- [ ] **Step 5: Commit** — `feat(housing): KR/CNのDC/ワールド表示名とエーテライト名を4言語辞書で表示`

---

### Task 8: 行き方 300 区画の en/ko/zh 翻訳

**Files:**
- Create: `src/data/housing/directions-src/translations/{en,ko,zh}/{mist,lavenderbeds,goblet,shirogane,empyreum}.csv` (計 15 ファイル。列: `番地,行き方補足`)
- Modify: `scripts/parse-ward-directions.mjs`
- Modify: `src/lib/housing/wardDirections.ts`
- Modify: 行き方本文の表示箇所 (`rtk grep -n "\.directions" src/components/housing src/lib/housing` で特定される描画箇所、useTourRenderModel/TourPhaseZone/TourNavPage/HousingDetailMap 系)
- Test: `src/lib/housing/__tests__/wardDirections.test.ts` (追記)

**Interfaces:**
- Produces: `getPlotDirectionsText(area: string, plot: number, locale: 'ja'|'en'|'ko'|'zh'): string | null`(ja フォールバック)。既存 `getPlotDirections` の返り値 `{aetheryte, directions}` は**無変更**(ja のまま・plotOrigin 等の lookup を壊さない)

- [ ] **Step 1: 翻訳ルールで 15 CSV を生成**(このステップは LLM 作業。1 ファイルずつ・ja の CSV と同じ 60 行順):
  - 固有名詞は自由訳禁止: エーテライト名/エリア名/アパート名 → `housingTerms.generated.json` の該当ロケール値。S/M/L 表記は「S house / S형 주택 / S号房屋」の型で統一
  - 定型語彙: 東西南北=East…/동쪽…/东…、「道なり」=follow the road/길을 따라/沿路、「呼び鈴」=doorbell/초인종/门铃、「階段」=stairs/계단/楼梯、「すぐ」=right there/바로/就在
  - **ASCII カンマ禁止**(パーサが素朴 split)。句読点は全角。機械品質で OK(ユーザー確認済・自作文のため)
- [ ] **Step 2: 完全性テストを書く** — wardDirections.test.ts 追記:

```ts
it('全 300 区画に en/ko/zh の行き方がある', () => {
  for (const area of ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum']) {
    for (let plot = 1; plot <= 60; plot++) {
      for (const l of ['en', 'ko', 'zh'] as const) {
        expect(getPlotDirectionsText(area, plot, l), `${area}#${plot} ${l}`).toBeTruthy();
      }
    }
  }
});
it('ja は従来値、未知 locale 系はフォールバック', () => {
  expect(getPlotDirectionsText('Mist', 1, 'ja')).toBe(getPlotDirections('Mist', 1)!.directions);
});
```

- [ ] **Step 3: パーサ拡張** — `parse-ward-directions.mjs`: 各エリア処理後に `translations/{lang}/{file}` を読み、`out[area][plot].i18n = { en, ko, zh }` を付与。行数 60 でなければ throw。`wardDirections.ts`:

```ts
export function getPlotDirectionsText(area: string, plot: number | null | undefined, locale: 'ja' | 'en' | 'ko' | 'zh'): string | null {
  if (plot == null || !Number.isInteger(plot)) return null;
  const d = TABLE[area]?.[String(plot)] as (PlotDirections & { i18n?: Record<string, string> }) | undefined;
  if (!d) return null;
  return (locale !== 'ja' && d.i18n?.[locale]) || d.directions;
}
```

- [ ] **Step 4: 表示切替** — 行き方本文を描画している箇所 (`.directions` の JSX 使用箇所) を `getPlotDirectionsText(area, plot, pickRegionLocale(i18n.language))` に切替。`node scripts/parse-ward-directions.mjs` 再実行で JSON 再生成
- [ ] **Step 5: パス確認** — `rtk vitest run src/lib/housing/__tests__/wardDirections.test.ts src/__tests__/housing/wardPlotSizes.test.ts` → PASS
- [ ] **Step 6: Commit** — `feat(housing): 行き方300区画のen/ko/zh翻訳(正典CSV+localeフォールバック)`

---

### Task 9: タグ/サイズ訳語の locale JSON 突合

**Files:**
- Modify: `src/locales/ko.json` / `src/locales/zh.json` (差分箇所のみ textual 編集)

- [ ] **Step 1: 突合** — `src/data/housingTags.ts` の各タグ i18nKey を列挙し、正典 CSV のタグ行 (ja 名で対応付け) と ko/zh JSON の現在値を比較する使い捨てスクリプトを scratchpad で実行(リポジトリに残さない)。サイズ・種別 (S/M/L/アパルトメント/FC個室) の表示キーも同様
- [ ] **Step 2: 差分のみ textual 反映** — ja と同値のまま残っている・訳が正典と異なるキーだけを CSV の値へ更新。**機械 parse→stringify で書き直さない**
- [ ] **Step 3: 確認** — `rtk vitest run src/locales/__tests__` (キー parity テストがあれば) + `rtk npm run build` の型チェック通過
- [ ] **Step 4: Commit** — `fix(housing): タグ/サイズのko・zh訳を正典CSVと突合して更新`

---

### Task 10: フルゲート + Firestore シード + 実機チェックリスト

**Files:** なし (検証と運用のみ)

- [ ] **Step 1: フルゲート** — `rtk npm run build` (exit 0) → `rtk vitest run` (既知の EphemeralAddPanel 7 件以外パス)
- [ ] **Step 2: Firestore /master/servers 再シード** — **ユーザーに確認してから** `npx tsx scripts/seed-servers.ts` (本番 Firestore 書込。masterData 追加分を admin 画面等の Firestore 読み系へ同期)。実行前に seed-servers.ts が serverMasterData をそのまま書くことを読んで確認
- [ ] **Step 3: 実機チェックリストをユーザーへ提示** (spec §8 の 7 項目):
  1. 言語 ko → 探すの初期地域=韓国 / 2. zh → 中国 / 3. ja/en → 従来どおり
  4. 地域=韓国/中国で DC・ワールド選択肢がその地域のものになる
  5. テストで韓国の家を登録 → ja 既定では出ない・地域=韓国で出る → 確認後削除
  6. トレイに JP の家がある状態で KR の家が追加できない(理由表示)
  7. 行き方が en/ko/zh で表示される
- [ ] **Step 4: push はユーザー承認後** — デプロイはバッチ方針(未 push の docs コミットも同乗)

---

## Self-Review 済みメモ

- spec §1-§8 の全要件にタスクが対応 (§1→T1/T2/T3、§2→T5、§3→T3/T4、§4→T1テスト、§5→T6、§6→T8、§7→T7、§8→T10)
- 型整合: `searchNamesFor(kind, key, includeJa)` を T2 定義と T6 消費で統一 / `getPlotDirectionsText` は T8 のみ / `displayDcName(dcKey, locale)`・`displayWorldName(dcKey, serverKey, locale)` を T2 定義と T7 消費で統一
- 既知リスク: 既存テストが `ALL_REGIONS`=4 地域や regions=[] 初期値を前提にしている場合は各タスクの Step 4 で追従修正する
