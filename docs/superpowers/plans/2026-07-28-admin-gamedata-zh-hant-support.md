# 管理画面ゲームデータ翻訳 繁体字対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ゲームデータ(技名・コンテンツ名・攻撃名・フェーズ名・その他ラベル)の管理画面編集にzh-Hant(繁体字)対応を追加し、あわせて名前オブジェクトを言語ごとに再構築する際にzh-Hantが欠落する箇所を全て修正する。

**Architecture:** 型(`LocalizedString`)には既に`'zh-Hant'?: string`が定義済み・表示側の汎用`name[lang]`参照も既に対応済みのため、本フェーズは「入力・編集・保存の経路にzh-Hantを通す」ことに専念する。既存のzh/ko列の実装パターンをそのまま複製する形で進め、新規の抽象化は導入しない。

**Tech Stack:** React + TypeScript, vitest + @testing-library/react

## Global Constraints

- 作業ディレクトリは必ず絶対パス `C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support` に `cd` してから全コマンドを実行すること
- 既存の日本語・英語・簡体字・韓国語の翻訳データの読み込み・保存・表示を一切変えないこと(回帰テスト必須)
- コミットはするが、**push はしない**
- 本フェーズでは実際のゲームデータへの繁体字翻訳の流し込み(Firestoreシード等)は行わない(フェーズ⑤)
- ハウジング機能・軽減表の画面文言・住所非公開機能等、本フェーズと無関係な箇所には一切触らない

---

### Task 1: 管理画面 一括翻訳編集(グループA)にzh-Hant列を追加

**Files:**
- Modify: `src/lib/translationDataLoaders.ts`
- Modify: `src/components/admin/AdminTranslations.tsx`
- Modify: `src/components/admin/TranslationTable.tsx`
- Modify: `src/components/admin/TranslationCsvTools.tsx`

**Interfaces:**
- Consumes: なし
- Produces: `TranslationRow`型に`zhHant: string`フィールド(後続タスクなし、本タスクのみで完結)

- [ ] **Step 1: `translationDataLoaders.ts`を修正**

`TranslationRow`インターフェース:
```ts
export interface TranslationRow {
  id: string;           // ユニークキー (例: "pld_reprisal", "m1s", "m1s__tpl_0_6wevbp")
  ja: string;
  en: string;
  zh: string;
  zhHant: string;
  ko: string;
  group?: string;       // フィルタ用 (ジョブID、コンテンツID など)
  groupLabel?: string;  // フィルタ表示ラベル
  subCategory?: string; // "others" カテゴリ内のサブ分類
}
```

`localizedToFields`関数:
```ts
function localizedToFields(name: LocalizedString): { ja: string; en: string; zh: string; zhHant: string; ko: string } {
  return {
    ja: name.ja ?? '',
    en: name.en ?? '',
    zh: name.zh ?? '',
    zhHant: name['zh-Hant'] ?? '',
    ko: name.ko ?? '',
  };
}
```

`getChangedRows`関数:
```ts
function getChangedRows(rows: TranslationRow[], originalRows: TranslationRow[]): TranslationRow[] {
  const originalMap = new Map(originalRows.map(r => [r.id, r]));
  return rows.filter(row => {
    const orig = originalMap.get(row.id);
    if (!orig) return true;
    return (
      row.ja !== orig.ja ||
      row.en !== orig.en ||
      row.zh !== orig.zh ||
      row.zhHant !== orig.zhHant ||
      row.ko !== orig.ko
    );
  });
}
```

`saveSkillTranslations`関数内、jobs更新箇所:
```ts
  const updatedJobs = data.jobs.map((j: Job) => {
    const changedRow = changedMap.get(`job:${j.id}`);
    if (!changedRow) return j;
    return {
      ...j,
      name: {
        ja: changedRow.ja || j.name.ja,
        en: emptyToUndefined(changedRow.en) ?? j.name.en,
        zh: emptyToUndefined(changedRow.zh),
        'zh-Hant': emptyToUndefined(changedRow.zhHant),
        ko: emptyToUndefined(changedRow.ko),
      } as LocalizedString,
    };
  });
```

同関数内、mitigations更新箇所:
```ts
  const updatedMitigations = data.mitigations.map((m: Mitigation) => {
    const changedRow = changedMap.get(m.id);
    if (!changedRow) return m;
    return {
      ...m,
      name: {
        ja: changedRow.ja || m.name.ja,
        en: emptyToUndefined(changedRow.en) ?? m.name.en,
        zh: emptyToUndefined(changedRow.zh),
        'zh-Hant': emptyToUndefined(changedRow.zhHant),
        ko: emptyToUndefined(changedRow.ko),
      } as LocalizedString,
    };
  });
```

`saveContentTranslations`関数内のname再構築箇所:
```ts
          name: {
            ja: row.ja,
            en: emptyToUndefined(row.en),
            zh: emptyToUndefined(row.zh),
            'zh-Hant': emptyToUndefined(row.zhHant),
            ko: emptyToUndefined(row.ko),
          } as LocalizedString,
```

`saveAttackTranslations`関数内のname再構築箇所:
```ts
  const updatedEvents = template.timelineEvents.map(event => {
    const changedRow = changedMap.get(event.id);
    if (!changedRow) return event;
    return {
      ...event,
      name: {
        ja: changedRow.ja || event.name.ja,
        en: emptyToUndefined(changedRow.en) ?? event.name.en,
        zh: emptyToUndefined(changedRow.zh),
        'zh-Hant': emptyToUndefined(changedRow.zhHant),
        ko: emptyToUndefined(changedRow.ko),
      } as LocalizedString,
    };
  });
```

`savePhaseTranslations`関数内のname再構築箇所:
```ts
    const newName: LocalizedString = {
      ja: changedRow.ja,
      en: emptyToUndefined(changedRow.en) ?? '',
      zh: emptyToUndefined(changedRow.zh),
      'zh-Hant': emptyToUndefined(changedRow.zhHant),
      ko: emptyToUndefined(changedRow.ko),
    };
```

`saveOtherTranslations`関数内、カテゴリラベル更新箇所:
```ts
    for (const row of changedCategories) {
      const key = row.id.replace('category__', '') as ContentCategory;
      updatedCategoryLabels[key] = {
        ja: row.ja,
        en: emptyToUndefined(row.en) ?? updatedCategoryLabels[key]?.en ?? '',
        zh: emptyToUndefined(row.zh),
        'zh-Hant': emptyToUndefined(row.zhHant),
        ko: emptyToUndefined(row.ko),
      } as LocalizedString;
    }
```

同関数内、レベルラベル更新箇所:
```ts
    for (const row of changedLevels) {
      const key = row.id.replace('level__', '');
      updatedLevelLabels[key] = {
        ja: row.ja,
        en: emptyToUndefined(row.en) ?? updatedLevelLabels[key]?.en ?? '',
        zh: emptyToUndefined(row.zh),
        'zh-Hant': emptyToUndefined(row.zhHant),
        ko: emptyToUndefined(row.ko),
      } as LocalizedString;
    }
```

同関数内、シリーズ名一括更新箇所:
```ts
  if (changedSeries.length > 0) {
    const seriesUpdates = changedSeries.map(row => ({
      id: row.id.replace('series__', ''),
      name: {
        ja: row.ja,
        en: emptyToUndefined(row.en) ?? '',
        zh: emptyToUndefined(row.zh),
        'zh-Hant': emptyToUndefined(row.zhHant),
        ko: emptyToUndefined(row.ko),
      } as LocalizedString,
    }));
```

- [ ] **Step 2: `AdminTranslations.tsx`を修正**

`handleCellChange`のフィールド型:
```ts
  const handleCellChange = useCallback((rowIndex: number, field: 'ja' | 'en' | 'zh' | 'zhHant' | 'ko', value: string) => {
```

`handleImport`のupdates型:
```ts
  const handleImport = useCallback((updates: Map<string, { ja?: string; en?: string; zh?: string; zhHant?: string; ko?: string }>) => {
```

`hasChanges`:
```ts
  const hasChanges = rows.some((r, i) => {
    const o = originalRows[i];
    return o && (r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.zhHant !== o.zhHant || r.ko !== o.ko);
  });
```

`filteredIndices`の未翻訳フィルタ:
```ts
  const filteredIndices = rows.reduce<number[]>((acc, r, i) => {
    if (selectedGroup && r.group !== selectedGroup) return acc;
    if (untranslatedOnly && r.zh && r.zhHant && r.ko) return acc;
    acc.push(i);
    return acc;
  }, []);
```

進捗表示:
```ts
  // Progress
  const zhDone = rows.filter(r => r.zh.trim()).length;
  const zhHantDone = rows.filter(r => r.zhHant.trim()).length;
  const koDone = rows.filter(r => r.ko.trim()).length;
  const total = rows.length;
  const zhPercent = total ? Math.round((zhDone / total) * 100) : 0;
  const zhHantPercent = total ? Math.round((zhHantDone / total) * 100) : 0;
  const koPercent = total ? Math.round((koDone / total) * 100) : 0;
```

進捗表示のJSX(`actions`内):
```tsx
          {total > 0 && (
            <span className="text-app-sm text-app-text-muted shrink-0">
              zh: {zhDone}/{total} ({zhPercent}%) / zh-Hant: {zhHantDone}/{total} ({zhHantPercent}%) / ko: {koDone}/{total} ({koPercent}%)
            </span>
          )}
```

- [ ] **Step 3: `TranslationTable.tsx`を修正**

Propsとヘルパー関数の型:
```tsx
interface Props {
  rows: TranslationRow[];
  originalRows: TranslationRow[];
  onChange: (rowIndex: number, field: 'ja' | 'en' | 'zh' | 'zhHant' | 'ko', value: string) => void;
}

export function TranslationTable({ rows, originalRows, onChange }: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  const isChanged = useCallback((rowIdx: number, field: 'ja' | 'en' | 'zh' | 'zhHant' | 'ko') => {
    const orig = originalRows[rowIdx];
    if (!orig) return false;
    return rows[rowIdx][field] !== orig[field];
  }, [rows, originalRows]);
```

テーブルヘッダー(`中文`の列の直後に追加):
```tsx
          <tr className="bg-app-text/5 border-b border-app-text/10">
            <th className="px-3 py-2 text-left font-medium w-48">ID</th>
            <th className="px-3 py-2 text-left font-medium">日本語</th>
            <th className="px-3 py-2 text-left font-medium">English</th>
            <th className="px-3 py-2 text-left font-medium">中文</th>
            <th className="px-3 py-2 text-left font-medium">繁體中文</th>
            <th className="px-3 py-2 text-left font-medium">한국어</th>
          </tr>
```

行のフィールドループ(2箇所とも `'ja', 'en', 'zh', 'ko'` → `'ja', 'en', 'zh', 'zhHant', 'ko'` に変更):
```tsx
              {(['ja', 'en', 'zh', 'zhHant', 'ko'] as const).map(field => {
```
および `onKeyDown` 内の Tab 移動:
```tsx
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const fields = ['ja', 'en', 'zh', 'zhHant', 'ko'] as const;
                            const nextField = fields[(fields.indexOf(field) + 1) % fields.length];
                            const nextRow = nextField === 'ja' ? idx + 1 : idx;
                            if (nextRow < rows.length) setEditingCell({ row: nextRow, field: nextField });
                          }
```

- [ ] **Step 4: `TranslationCsvTools.tsx`を修正**

Props/ImportPreview型:
```tsx
interface Props {
  rows: TranslationRow[];
  category: string;
  onImport: (updates: Map<string, { ja?: string; en?: string; zh?: string; zhHant?: string; ko?: string }>) => void;
}

interface ImportPreview {
  added: { lang: string; count: number }[];
  changed: { lang: string; count: number }[];
  unknownIds: string[];
  updates: Map<string, { ja?: string; en?: string; zh?: string; zhHant?: string; ko?: string }>;
}
```

`handleExport`:
```tsx
  const handleExport = () => {
    const header = `ID,${t('admin.translations_csv_header_no_edit')} ja,${t('admin.translations_csv_header_no_edit')} en,zh,zh-Hant,ko`;
    const csvRows = rows.map(r =>
      [r.id, csvEscape(r.ja), csvEscape(r.en), csvEscape(r.zh), csvEscape(r.zhHant), csvEscape(r.ko)].join(',')
    );
```

`parseCSV`:
```tsx
  const parseCSV = (csvText: string) => {
    const result = Papa.parse<Record<string, string>>(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
    });

    const rowMap = new Map(rows.map(r => [r.id, r]));
    const updates = new Map<string, { ja?: string; en?: string; zh?: string; zhHant?: string; ko?: string }>();
    const unknownIds: string[] = [];
    let zhAdded = 0, zhHantAdded = 0, koAdded = 0, jaChanged = 0, enChanged = 0, zhChanged = 0, zhHantChanged = 0, koChanged = 0;

    for (const parsed of result.data) {
      const id = parsed['ID'] || parsed['id'];
      if (!id) continue;

      const existing = rowMap.get(id);
      if (!existing) {
        unknownIds.push(id);
        continue;
      }

      const update: any = {};
      const jaKey = Object.keys(parsed).find(k => k.includes('ja')) || 'ja';
      const enKey = Object.keys(parsed).find(k => k.includes('en')) || 'en';
      const jaVal = parsed[jaKey]?.trim();
      const enVal = parsed[enKey]?.trim();
      const zhVal = parsed['zh']?.trim();
      const zhHantVal = parsed['zh-Hant']?.trim();
      const koVal = parsed['ko']?.trim();

      if (jaVal && jaVal !== existing.ja) { update.ja = jaVal; jaChanged++; }
      if (enVal && enVal !== existing.en) { update.en = enVal; enChanged++; }
      if (zhVal && !existing.zh && zhVal) { update.zh = zhVal; zhAdded++; }
      else if (zhVal && zhVal !== existing.zh) { update.zh = zhVal; zhChanged++; }
      if (zhHantVal && !existing.zhHant && zhHantVal) { update.zhHant = zhHantVal; zhHantAdded++; }
      else if (zhHantVal && zhHantVal !== existing.zhHant) { update.zhHant = zhHantVal; zhHantChanged++; }
      if (koVal && !existing.ko && koVal) { update.ko = koVal; koAdded++; }
      else if (koVal && koVal !== existing.ko) { update.ko = koVal; koChanged++; }

      if (Object.keys(update).length > 0) updates.set(id, update);
    }

    setPreview({
      added: [
        { lang: 'zh', count: zhAdded },
        { lang: 'zh-Hant', count: zhHantAdded },
        { lang: 'ko', count: koAdded },
      ].filter(a => a.count > 0),
      changed: [
        { lang: 'ja', count: jaChanged },
        { lang: 'en', count: enChanged },
        { lang: 'zh', count: zhChanged },
        { lang: 'zh-Hant', count: zhHantChanged },
        { lang: 'ko', count: koChanged },
      ].filter(c => c.count > 0),
      unknownIds,
      updates,
    });
  };
```

- [ ] **Step 5: 既存テストを確認・更新**

`src/components/admin/`配下に`AdminTranslations`/`TranslationTable`/`TranslationCsvTools`の既存テストがあるか確認する:
```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
find src -iname "*AdminTranslations*test*" -o -iname "*TranslationTable*test*" -o -iname "*TranslationCsvTools*test*"
```
既存テストがあれば、zh列と同じ扱いでzhHant列のケースを追加する(列が表示される・編集できる・保存時にペイロードへ含まれる・CSV往復ができる、の4点を最低限カバーする)。既存テストが無ければ、`TranslationTable`に対して「4列目(zh-Hant)が表示され編集できること」を確認する軽量なテストを1つ新規作成する。

- [ ] **Step 6: テストとビルドを実行**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx tsc -b
npx vitest run src/components/admin/ src/lib/translationDataLoaders.ts
```
Expected: 型エラーなし、テスト全件PASS

- [ ] **Step 7: コミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add src/lib/translationDataLoaders.ts src/components/admin/AdminTranslations.tsx src/components/admin/TranslationTable.tsx src/components/admin/TranslationCsvTools.tsx
```
Step5で新規作成または変更したテストファイルがあれば、そのパスも明示的に`git add`に追加すること。
```bash
git commit -m "feat: 管理画面の一括翻訳編集にzh-Hant列を追加"
```

---

### Task 2: 管理画面 個別編集モーダル(グループB)にzh-Hant入力欄を追加

**Files:**
- Modify: `src/components/admin/SkillFormModal.tsx`
- Modify: `src/components/admin/AdminContents.tsx`
- Modify: `src/components/admin/AdminContentForm.tsx`

**Interfaces:**
- Consumes: なし(Task1とは独立、別の編集画面)
- Produces: なし

- [ ] **Step 1: `SkillFormModal.tsx`を修正**

`updateName`関数のシグネチャ:
```ts
    const updateName = (lang: 'ja' | 'en' | 'zh' | 'zh-Hant' | 'ko', value: string) => {
        setForm(prev => ({ ...prev, name: { ...prev.name, [lang]: value } }));
    };
```

JSX(「名前(4言語)」ブロック、中文の直後に繁体字欄を追加):
```tsx
                            <div>
                                <label className={labelClass}>中文</label>
                                <input className={inputClass} value={form.name.zh ?? ''} placeholder="中国語名（任意）"
                                    onChange={e => updateName('zh', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>繁體中文</label>
                                <input className={inputClass} value={form.name['zh-Hant'] ?? ''} placeholder="繁体字名（任意）"
                                    onChange={e => updateName('zh-Hant', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>한국어</label>
                                <input className={inputClass} value={form.name.ko ?? ''} placeholder="韓国語名（任意）"
                                    onChange={e => updateName('ko', e.target.value)} />
                            </div>
```
(このブロックは現状 `grid-cols-2` で4項目=2行のレイアウト。5項目になり2列目の並びが崩れるため、繁体字欄追加後は親divを `grid-cols-2` のまま5項目目が単独で3行目に来る形でよい。見た目の調整は不要、機能優先)

- [ ] **Step 2: `AdminContents.tsx`を修正**

`fetchContents`内のマッピング(`ContentData`部分。Step 3で`nameZhHant`フィールドを追加するので、それに合わせて追加):
```ts
      const mapped = (data.items ?? []).map((item: any) => ({
        ...item,
        nameJa: item.nameJa ?? item.name?.ja ?? '',
        nameEn: item.nameEn ?? item.name?.en ?? '',
        nameZh: item.nameZh ?? item.name?.zh ?? '',
        nameZhHant: item.nameZhHant ?? item.name?.['zh-Hant'] ?? '',
        nameKo: item.nameKo ?? item.name?.ko ?? '',
        shortNameJa: item.shortNameJa ?? item.shortName?.ja ?? '',
        shortNameEn: item.shortNameEn ?? item.shortName?.en ?? '',
      }));
```

`handleSave`内の保存ペイロード:
```ts
      const body: Record<string, unknown> = {
        item: {
          id: data.id,
          name: {
            ja: data.nameJa,
            en: data.nameEn,
            ...(data.nameZh ? { zh: data.nameZh } : {}),
            ...(data.nameZhHant ? { 'zh-Hant': data.nameZhHant } : {}),
            ...(data.nameKo ? { ko: data.nameKo } : {}),
          },
          shortName: { ja: data.shortNameJa, en: data.shortNameEn },
          category: data.category,
          level: data.level,
          patch: data.patch,
          seriesId: data.seriesId,
          order: data.order,
          fflogsEncounterId: data.fflogsEncounterId,
          hasCheckpoint: data.hasCheckpoint ?? false,
        },
      };
```

- [ ] **Step 3: `AdminContentForm.tsx`を修正**

`ContentData`インターフェース(`nameZh`の直後に追加):
```ts
export interface ContentData {
  id: string;
  nameJa: string;
  nameEn: string;
  nameZh: string;
  nameZhHant: string;
  nameKo: string;
  shortNameJa: string;
  shortNameEn: string;
  category: string;
  level: number;
  patch: string;
  seriesId: string;
  order: number;
  fflogsEncounterId: number | null;
  hasCheckpoint: boolean;
}
```

`emptyContent`関数:
```ts
export function emptyContent(): ContentData {
  return {
    id: '',
    nameJa: '',
    nameEn: '',
    nameZh: '',
    nameZhHant: '',
    nameKo: '',
    shortNameJa: '',
    shortNameEn: '',
    category: 'savage',
    level: 100,
    patch: '',
    seriesId: '',
    order: 1,
    fflogsEncounterId: null,
    hasCheckpoint: false,
  };
}
```

JSX(「名前(中国語・韓国語)」ブロックを3列に拡張。中国語の直後に繁体字欄を追加し、grid-cols-2 を grid-cols-3 に変更):
```tsx
        {/* 名前（中国語・繁体字・韓国語）— 任意 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>
              名前（中国語）
              <span className={`${exampleClass} ml-1 font-normal`}>任意</span>
            </label>
            <input
              className={inputClass}
              value={form.nameZh}
              onChange={(e) => set('nameZh', e.target.value)}
              placeholder="例: 阿卡狄亚零式登天斗技场 重量级1"
            />
          </div>
          <div>
            <label className={labelClass}>
              名前（繁体字）
              <span className={`${exampleClass} ml-1 font-normal`}>任意</span>
            </label>
            <input
              className={inputClass}
              value={form.nameZhHant}
              onChange={(e) => set('nameZhHant', e.target.value)}
              placeholder="任意"
            />
          </div>
          <div>
            <label className={labelClass}>
              名前（韓国語）
              <span className={`${exampleClass} ml-1 font-normal`}>任意</span>
            </label>
            <input
              className={inputClass}
              value={form.nameKo}
              onChange={(e) => set('nameKo', e.target.value)}
              placeholder="例: 아르카디아 선수권: 헤비급(영웅) 1"
            />
          </div>
        </div>
```
(元のプレースホルダー文字列に文字化けらしき`�`が含まれていたが、これは既存コードの見た目のまま変更しないこと。今回のタスクでは触らない)

`set`関数のキー型は`keyof ContentData`のままで`nameZhHant`を自動的に受け付けるため変更不要。

- [ ] **Step 4: テストとビルドを実行**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx tsc -b
npx vitest run src/components/admin/
```
Expected: 型エラーなし、テスト全件PASS(既存テストがあれば全てPASS、無ければスキップでよい)

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add src/components/admin/SkillFormModal.tsx src/components/admin/AdminContents.tsx src/components/admin/AdminContentForm.tsx
git commit -m "feat: スキル/コンテンツ個別編集モーダルにzh-Hant入力欄を追加"
```

---

### Task 3: TemplateEditor.tsx にzh-Hant対応を追加

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx`

**Interfaces:**
- Consumes: なし
- Produces: なし

**背景:** このファイルはテンプレート(コンテンツごとの攻撃名・フェーズ名)の一覧編集画面で、768行と大きく、名前関連のUI/ロジックが複数箇所に分散している。既存のzh/ko対応と全く同じパターンを、見つけた箇所それぞれにzh-Hant分として追加する。新しい抽象化やヘルパー関数の導入はしない(既存のコードスタイルを踏襲するのみ)。

- [ ] **Step 1: ファイル内の`zh`/`ko`参照箇所を全て洗い出す**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
grep -n "\bzh\b\|\bko\b\|nameZh\|nameKo\|\.zh\b\|\.ko\b" src/components/admin/TemplateEditor.tsx
```

事前調査で確認済みの主な箇所(実装時に上記grepで最終確認すること):

1. **小型ポップオーバーコンポーネント(約250-320行目付近)**: `labels: { ja: string; en: string; zh: string; ko: string }` という props 型を持ち、`useState`で`zh`/`ko`のローカル状態を持ち、`onApply`に渡す`LocalizedString`を`{ ja, en, ...(zh ? {zh}:{}), ...(ko ? {ko}:{}) }`の形で組み立てている。ここに`zhHant`の`useState`・入力欄・`onApply`ペイロードへの追加が必要。

2. **イベント一覧テーブルの列(約500-670行目付近)**: `name.zh`/`altName.zh`用の`EditableCell`列と、`name.ko`/`altName.ko`用の`EditableCell`列がある。それぞれ`isZhUntranslated`/`isZhAutoFilled`のような判定変数と`highlightClass`/`getCellHighlight`呼び出しが伴う。同じ4点セット(判定変数2つ・highlight変数1つ・`<td><EditableCell>`1つ)を、`name.zh`と`name.ko`の間、`altName.zh`と`altName.ko`の間に`zh-Hant`分として追加する。`onCommit`のキー文字列は既存の`'name.zh'`等の命名規則に倣い`'name.zh-Hant'`とする。

3. **ラベル定義オブジェクト(約745-750行目付近)**: ポップオーバーに渡す`labels`オブジェクトに`zh: t('admin.tpl_label_name_zh')`, `ko: t('admin.tpl_label_name_ko')`がある。同様に`'zh-Hant': t('admin.tpl_label_name_zh_hant')`を追加する(i18nキー`admin.tpl_label_name_zh_hant`は`src/locales/ja.json`等に存在しない場合は新規追加が必要。既存の`admin.tpl_label_name_zh`の値を確認し、同じ命名パターンでja/en/ko/zh/zh-Hant全言語分を追加すること)。

4. **空チェック(約752行目付近)**: `const isEmpty = !value.ja && !value.en && !value.zh && !value.ko;` に `&& !value['zh-Hant']` を追加する。

- [ ] **Step 2: 洗い出した全箇所を修正**

Step1のgrep結果に基づき、上記4種類のパターンをそれぞれ該当箇所全てに適用する。1件でも見落とすと「テンプレート編集画面で繁体字だけ保存できない」不具合になるため、修正後に再度同じgrepを実行し、`zh`/`ko`が出現する行数と`zh-Hant`(またはzhHant)が出現する行数を突き合わせて、対になっていない箇所がないか確認する。

- [ ] **Step 3: i18nキーの追加(必要な場合)**

Step1-3で必要になった新規i18nキー(例: `admin.tpl_label_name_zh_hant`)を、既存の`admin.tpl_label_name_zh`と同じ構造で`src/locales/ja.json`・`en.json`・`ko.json`・`zh.json`・`zh-Hant.json`の5ファイル全てに追加する。値は「繁体字」「Traditional Chinese」等、既存のzh/koラベルの言い回しに倣う。

- [ ] **Step 4: テストとビルドを実行**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx tsc -b
npx vitest run src/components/admin/ src/locales/__tests__/
```
Expected: 型エラーなし、テスト全件PASS(特に`zh-hant-completeness.test.ts`が新規i18nキー追加後も通ること)

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add src/components/admin/TemplateEditor.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json
git commit -m "feat: TemplateEditorにzh-Hant対応を追加(一覧編集・ポップオーバー・ラベル)"
```

---

### Task 4: データ引き継ぎ処理(グループC・残り15ファイル)のzh-Hant欠落を修正

**Files:**
- Modify: `src/utils/templateConversions.ts`
- Modify: `src/utils/phaseMigration.ts`
- Modify: `src/utils/labelMigration.ts`
- Modify: `src/store/usePlanStore.ts`
- Modify: `src/lib/sheetImport/resolveJob.ts`
- Modify: `src/lib/sheetImport/resolveSheetSkill.ts`
- Modify: `src/hooks/useTemplateEditor.ts`
- Modify: `src/data/templateLoader.ts`
- Modify: `src/data/contentRegistry.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/PartyStatusPopover.tsx`
- Modify: `src/components/HeaderMechanicSearch.tsx`
- Modify: `src/components/BoundaryEditModal.tsx`
- Modify: `src/components/EventForm.tsx`
- Modify: `src/components/LimitResolutionSheet.tsx`
- Modify: `src/components/MobileContextMenu.tsx`

**Interfaces:**
- Consumes: なし
- Produces: なし

**背景:** これらのファイルは、技名・フェーズ名・イベント名等の`LocalizedString`を1言語ずつ個別のフィールドとして再構築する処理を持ち、いずれも`ja`/`en`/`zh`/`ko`の4つだけを明示的に扱っていて`zh-Hant`が抜け落ちる。設計書で確認済みの典型パターンは以下:

```ts
{
  ja: x.ja,
  en: x.en,
  ...(x.zh ? { zh: x.zh } : {}),
  ...(x.ko ? { ko: x.ko } : {}),
}
```

これを

```ts
{
  ja: x.ja,
  en: x.en,
  ...(x.zh ? { zh: x.zh } : {}),
  ...(x['zh-Hant'] ? { 'zh-Hant': x['zh-Hant'] } : {}),
  ...(x.ko ? { ko: x.ko } : {}),
}
```

の形に、`zh`と`ko`の間に`zh-Hant`分を挿入する形で直す。既に確認済みの実例:

- `src/utils/phaseMigration.ts`(約278-283行目、約306-311行目): 上記パターンそのもの
- `src/utils/labelMigration.ts`(約18-23行目): 上記パターンそのもの
- `src/utils/templateConversions.ts`(約46-51行目): 上記パターンそのもの
- `src/components/Sidebar.tsx`(約1051-1061行目、`loadSnapshot`呼び出し内のフェーズ名再構築箇所): 上記パターンそのもの

- [ ] **Step 1: 16ファイル全てに対して`zh`/`ko`参照箇所を洗い出す**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
grep -n "\.zh\b\|\.ko\b\|zh:\|ko:\|'zh'\|'ko'" \
  src/utils/templateConversions.ts \
  src/utils/phaseMigration.ts \
  src/utils/labelMigration.ts \
  src/store/usePlanStore.ts \
  src/lib/sheetImport/resolveJob.ts \
  src/lib/sheetImport/resolveSheetSkill.ts \
  src/hooks/useTemplateEditor.ts \
  src/data/templateLoader.ts \
  src/data/contentRegistry.ts \
  src/components/Sidebar.tsx \
  src/components/PartyStatusPopover.tsx \
  src/components/HeaderMechanicSearch.tsx \
  src/components/BoundaryEditModal.tsx \
  src/components/EventForm.tsx \
  src/components/LimitResolutionSheet.tsx \
  src/components/MobileContextMenu.tsx
```

出力された全箇所について、1件ずつ「`LocalizedString`(またはその一部)を1言語ずつ再構築している箇所か」を判定する。判定基準:
- **修正が必要**: 上記の典型パターンのように、名前オブジェクトを`{ ja: ..., en: ..., zh: ..., ko: ... }`の形で新規に組み立てている箇所
- **修正不要**: 単に既存の`LocalizedString`オブジェクトを`{...obj}`のようにスプレッドでコピーしているだけの箇所(この場合zh-Hantも自動的に引き継がれるため対応不要)。既存の言語判定ロジック(`lang === 'zh'`等、表示言語を決めるための比較)で無関係な箇所も対応不要
- 対象が「配列のフィルタ条件」(例: `phase.name.ja || phase.name.en || phase.name.zh || phase.name.ko`のような、名前がどれか1つでも存在するかの判定)の場合は、`|| phase.name['zh-Hant']`をフィルタ条件にも追加する

- [ ] **Step 2: 判定結果に基づき、該当箇所全てを修正**

「修正が必要」と判定した全箇所に、上記パターンの`zh-Hant`分の挿入を行う。TypeScriptの型上、`LocalizedString`のキーに`'zh-Hant'`のようなハイフンを含む文字列は角括弧+クォート記法(`x['zh-Hant']`)でアクセスする必要がある点に注意する。

- [ ] **Step 3: 修正箇所の一覧を記録**

どのファイルのどの箇所を「修正必要」「修正不要」と判定したか、実装レポートに一覧で記録する(最終レビューで見落としがないか確認できるようにするため)。

- [ ] **Step 4: テストとビルドを実行**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx tsc -b
npx vitest run
```
Expected: 型エラーなし。テストは既知の失敗(EphemeralAddPanel.test.tsx 7件、TopBar/HousingWorkspace関連の既知失敗5件)を除き全件PASS。新規の失敗が出ていないことを確認する。

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add src/utils/templateConversions.ts src/utils/phaseMigration.ts src/utils/labelMigration.ts src/store/usePlanStore.ts src/lib/sheetImport/resolveJob.ts src/lib/sheetImport/resolveSheetSkill.ts src/hooks/useTemplateEditor.ts src/data/templateLoader.ts src/data/contentRegistry.ts src/components/Sidebar.tsx src/components/PartyStatusPopover.tsx src/components/HeaderMechanicSearch.tsx src/components/BoundaryEditModal.tsx src/components/EventForm.tsx src/components/LimitResolutionSheet.tsx src/components/MobileContextMenu.tsx
git commit -m "fix: 名前オブジェクト再構築箇所16ファイルのzh-Hant欠落を修正"
```

---

### Task 5: 全体回帰確認(フルゲート)

**Files:** なし(検証のみ)

**Interfaces:**
- Consumes: Task1〜4の全成果
- Produces: なし

- [ ] **Step 1: ビルドを実行する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npm run build
```
Expected: 成功(exit code 0)。

- [ ] **Step 2: テストスイート全体を実行する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run
```
Expected: 既知の失敗(EphemeralAddPanel.test.tsx 7件、TopBar/HousingWorkspace関連5件)を除き全件PASS。新規失敗が増えていないことを確認する。

- [ ] **Step 3: 既存言語の変更箇所を確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git diff <Task1開始前のHEAD>..HEAD -- src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
```
(`<Task1開始前のHEAD>`は本タスク実行時にSDDレジャーの記録から実際のコミットハッシュを確認して置き換えること)
Task3で追加したi18nキー(`admin.tpl_label_name_zh_hant`等)以外に、既存キーの値が変更されていないことを確認する。

- [ ] **Step 4: 最終コミット(必要な場合のみ)**

Step1のビルドエラー対応が発生した場合のみ、その修正をコミットする:
```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add -A
git commit -m "fix: フェーズ④ビルドエラー対応"
```
