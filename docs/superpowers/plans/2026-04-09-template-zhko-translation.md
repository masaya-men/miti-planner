# テンプレート技名 zh/ko 翻訳機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面のテンプレート編集画面で、FFLogsレポートURLから中国語・韓国語の技名翻訳を一括追加できるようにする。

**Architecture:** 既存の `FflogsTranslationModal` を拡張し、言語選択UIを追加。FFLogsから英語+対象言語のイベントを取得し、GUIDベースまたは英語名マッチでテンプレートの各イベントに翻訳を適用する。`TimelineEvent` に `guid` フィールドを追加し、`fflogsMapper` で自動保存する。

**Tech Stack:** React, TypeScript, Vitest, react-i18next, FFLogs GraphQL API

**Spec:** `docs/superpowers/specs/2026-04-09-template-zhko-translation-design.md`

---

### Task 1: `TimelineEvent` に `guid` フィールド追加

**Files:**
- Modify: `src/types/index.ts:78-88`

- [ ] **Step 1: `TimelineEvent` に `guid?: number` を追加**

```typescript
// src/types/index.ts — TimelineEvent interface（L78-88）
// damageAmount の次の行に追加:
export interface TimelineEvent {
    id: string;
    time: number; // seconds from start
    name: LocalizedString;
    guid?: number; // FFLogs ability GUID
    damageType: 'magical' | 'physical' | 'unavoidable' | 'enrage';
    damageAmount?: number;
    target?: 'AoE' | 'MT' | 'ST';
    warning?: boolean; // Indicates mitigation is insufficient
    /** @deprecated 旧データ互換用。新データはlabels[]を使用。読み込み時のみ参照される */
    mechanicGroup?: LocalizedString;
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし（optional フィールドなので既存コードに影響なし）

- [ ] **Step 3: コミット**

```bash
git add src/types/index.ts
git commit -m "feat: TimelineEvent に guid フィールド追加"
```

---

### Task 2: `fflogsMapper` で GUID を TimelineEvent に保存

**Files:**
- Modify: `src/utils/fflogsMapper.ts:270-370,518-524,572-581`
- Test: `src/utils/__tests__/fflogsMapper.test.ts`

- [ ] **Step 1: テスト追加 — ダメージイベントに GUID が保存される**

`src/utils/__tests__/fflogsMapper.test.ts` の末尾に追加:

```typescript
describe('guid保存', () => {
  it('ダメージイベントにGUIDが保存される', () => {
    const rawEn = [
      dmg(10, 12345, 'Holy', 3, 50000),
      dmg(10, 12345, 'Holy', 4, 50000),
      dmg(10, 12345, 'Holy', 5, 50000),
    ];
    const rawJp = [
      jpDmg(10, 12345, 'ホーリー', 3, 50000),
      jpDmg(10, 12345, 'ホーリー', 4, 50000),
      jpDmg(10, 12345, 'ホーリー', 5, 50000),
    ];
    const r = mapFFLogsToTimeline(rawEn, rawJp, makeFight(), [], [], [], makePlayers());
    const ev = r.events.find(e => e.name.en === 'Holy');
    expect(ev).toBeDefined();
    expect(ev!.guid).toBe(12345);
  });

  it('キャストイベントにGUIDが保存される', () => {
    const castEn = [cast(5, 99999, 'Divination')];
    const castJp = [cast(5, 99999, 'ディヴィネーション')];
    const r = mapFFLogsToTimeline([], [], makeFight(), [], castEn, castJp, makePlayers());
    const ev = r.events.find(e => e.name.en === 'Divination');
    expect(ev).toBeDefined();
    expect(ev!.guid).toBe(99999);
  });

  it('AAイベントにはGUIDが保存されない', () => {
    const rawEn = [
      dmg(10, 8888, 'Attack', 1, 30000),
      dmg(11, 8888, 'Attack', 1, 30000),
    ];
    const r = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    const aaEv = r.events.find(e => e.name.en === 'AA');
    if (aaEv) {
      expect(aaEv.guid).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗を確認**

Run: `npx vitest run src/utils/__tests__/fflogsMapper.test.ts`
Expected: `guid` が `undefined` で FAIL

- [ ] **Step 3: `buildName` を `buildEvent` ヘルパーに変更し GUID を含める**

`fflogsMapper.ts` の `buildName` 関数（L475-484）の直後に、GUID 付き TimelineEvent オブジェクトを生成するヘルパーを追加:

```typescript
/** GUID付きTimelineEventの基本プロパティを構築 */
function buildEventBase(
    src: { jpName: string; enName: string; guid: number },
    isEnglishOnly: boolean,
    overrides: Partial<TimelineEvent> & { id: string; time: number; damageType: TimelineEvent['damageType'] },
    nameSuffix: string = '',
): TimelineEvent {
    return {
        ...overrides,
        name: buildName(src, isEnglishOnly, nameSuffix),
        guid: src.guid,
    };
}
```

- [ ] **Step 4: ダメージイベント生成箇所（L271-369）で `guid: f.guid` を追加**

各 `tl.push({ ... })` に `guid: f.guid` を追加する。全ての分岐（composite TB, composite AoE, AoE 3+, 両タンクTB, タンク1人TB, 非タンク1人, 2人AoE）に対応。

例（L271-277の composite TB の場合）:

```typescript
tl.push({
    id: genId(), time: f.timeSec,
    name: buildName(f, isEnglishOnly, ' (TB)'),
    guid: f.guid,
    damageType: mapDamageType(f.aType),
    damageAmount: tankDmg > 0 ? roundDamageCeil(tankDmg) : undefined,
    target: tid === stId ? 'ST' : 'MT',
});
```

同様に以下のすべての `tl.push` に `guid: f.guid` を追加:
- L280-286（composite AoE）
- L291-298（composite タンクのみ）
- L304-310（composite パーティのみ）
- L315-321（AoE 3+）
- L327-333（両タンクTB）
- L340-346（タンク1人TB）
- L351-357（非タンク1人）
- L362-368（2人AoE）

- [ ] **Step 5: キャストイベント生成箇所（L572-581）で GUID を追加**

`addNonDamageCasts` 関数内の `tl.push` に `guid: g` を追加:

```typescript
tl.push({
    id: genId(), time: timeSec,
    name: buildName(
        { jpName: isAutoAttackName(jpName) ? 'AA' : jpName, enName },
        isEnglishOnly,
    ),
    guid: g !== -1 ? g : undefined,
    damageType: 'magical',
    target: 'AoE',
});
```

- [ ] **Step 6: テスト実行 — パスを確認**

Run: `npx vitest run src/utils/__tests__/fflogsMapper.test.ts`
Expected: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add src/utils/fflogsMapper.ts src/utils/__tests__/fflogsMapper.test.ts
git commit -m "feat: fflogsMapper で GUID を TimelineEvent に保存"
```

---

### Task 3: `useTemplateEditor` に `applyTranslation` 関数追加

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts:225-243,428-448`
- Test: `src/hooks/__tests__/useTemplateEditor.test.ts`

- [ ] **Step 1: `TranslationMatchResult` 型を定義**

`src/hooks/useTemplateEditor.ts` の先頭（import の後）に追加:

```typescript
/** FFLogs翻訳マッチ結果 */
export interface TranslationMatchResult {
  lang: 'en' | 'zh' | 'ko';
  /** eventId → 翻訳名 */
  translations: Map<string, string>;
  /** eventId → GUID（GUIDが未設定だったイベント用） */
  guids: Map<string, number>;
}
```

- [ ] **Step 2: テスト追加 — `applyTranslation` で zh 翻訳が適用される**

`src/hooks/__tests__/useTemplateEditor.test.ts` の末尾に追加:

```typescript
import type { TranslationMatchResult } from '../useTemplateEditor';

describe('applyTranslation', () => {
  it('zh翻訳をイベントに適用する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));

    const translations = new Map([['ev1', '测试攻击'], ['ev3', '第二击']]);
    const guids = new Map([['ev1', 1001], ['ev3', 1002]]);
    const matchResult: TranslationMatchResult = { lang: 'zh', translations, guids };

    act(() => result.current.applyTranslation(matchResult));

    const ev1 = result.current.state.current.find(e => e.id === 'ev1');
    expect(ev1?.name.zh).toBe('测试攻击');
    expect(ev1?.guid).toBe(1001);

    const ev3 = result.current.state.current.find(e => e.id === 'ev3');
    expect(ev3?.name.zh).toBe('第二击');
    expect(ev3?.guid).toBe(1002);
  });

  it('既存GUIDがある場合は上書きしない', () => {
    const { result } = renderHook(() => useTemplateEditor());
    const events = makeEvents();
    events[0].guid = 9999;
    act(() => result.current.loadEvents(events, makePhases()));

    const translations = new Map([['ev1', '测试攻击']]);
    const guids = new Map([['ev1', 1001]]);
    const matchResult: TranslationMatchResult = { lang: 'zh', translations, guids };

    act(() => result.current.applyTranslation(matchResult));

    const ev1 = result.current.state.current.find(e => e.id === 'ev1');
    expect(ev1?.name.zh).toBe('测试攻击');
    expect(ev1?.guid).toBe(9999); // 既存GUIDを維持
  });

  it('削除済みイベントはスキップする', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.deleteEvent('ev1'));

    const translations = new Map([['ev1', '测试攻击']]);
    const guids = new Map<string, number>();
    const matchResult: TranslationMatchResult = { lang: 'zh', translations, guids };

    act(() => result.current.applyTranslation(matchResult));

    // 削除済みなので visibleEvents に含まれない
    expect(result.current.visibleEvents.find(e => e.id === 'ev1')).toBeUndefined();
  });
});
```

- [ ] **Step 3: テスト実行 — 失敗を確認**

Run: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: `applyTranslation` が存在しないため FAIL

- [ ] **Step 4: `applyTranslation` を実装**

`src/hooks/useTemplateEditor.ts` の `autoFillEnNames` の後（L243 付近）に追加:

```typescript
  // 翻訳を一括適用（zh/ko + GUID保存）
  const applyTranslation = useCallback(
    (result: TranslationMatchResult) => {
      setState((prev) => {
        const newCurrent = structuredClone(prev.current);
        const newAutoFilled = new Set(prev.autoFilled);

        for (const ev of newCurrent) {
          if (prev.deleted.has(ev.id)) continue;

          const translation = result.translations.get(ev.id);
          if (translation) {
            ev.name[result.lang] = translation;
            newAutoFilled.add(`${ev.id}:name.${result.lang}`);
          }

          const guid = result.guids.get(ev.id);
          if (guid && !ev.guid) {
            ev.guid = guid;
          }
        }

        return { ...prev, current: newCurrent, autoFilled: newAutoFilled };
      });
    },
    [],
  );
```

return オブジェクト（L428-448）に `applyTranslation` を追加:

```typescript
  return {
    state,
    visibleEvents,
    untranslatedCount,
    hasChanges,
    loadEvents,
    updateCell,
    deleteEvent,
    undo,
    autoFillEnNames,
    applyTranslation,  // ← 追加
    replaceAll,
    // ... 以降既存のまま
  };
```

- [ ] **Step 5: テスト実行 — パスを確認**

Run: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/hooks/useTemplateEditor.ts src/hooks/__tests__/useTemplateEditor.test.ts
git commit -m "feat: useTemplateEditor に applyTranslation 追加"
```

---

### Task 4: `FflogsTranslationModal` を拡張（言語選択 + 2段階マッチ）

**Files:**
- Modify: `src/components/admin/FflogsTranslationModal.tsx`

- [ ] **Step 1: Props と型を変更**

```typescript
import type { TimelineEvent } from '../../types';
import type { TranslationMatchResult } from '../../hooks/useTemplateEditor';

interface FflogsTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatched: (result: TranslationMatchResult) => void;
  /** 現在のテンプレートイベント（GUIDマッチ/英語名マッチ用） */
  events: TimelineEvent[];
}

type TargetLang = 'en' | 'zh' | 'ko';
```

- [ ] **Step 2: state に `lang` を追加**

```typescript
const [lang, setLang] = useState<TargetLang>('en');
```

`handleClose` で `setLang('en')` もリセット。

- [ ] **Step 3: `handleFetch` のマッチングロジックを書き換え**

en選択時は従来ロジック（jaName→enNameマッチ）、zh/ko選択時は2段階マッチ:

```typescript
const handleFetch = async () => {
    const reportCode = extractReportCode(url);
    if (!reportCode) {
      setStatus({ phase: 'error' });
      return;
    }

    setStatus({ phase: 'loading' });

    try {
      const fight = await resolveFight(reportCode, 'last');
      if (!fight) {
        setStatus({ phase: 'error' });
        return;
      }

      // 英語イベント（translate=false）+ ネイティブ言語イベント（translate=true）を並行取得
      const [enEvents, nativeEvents] = await Promise.all([
        fetchFightEvents(reportCode, fight, false),
        fetchFightEvents(reportCode, fight, true),
      ]);

      // guid → enName マップ
      const guidToEn = new Map<number, string>();
      for (const ev of enEvents) {
        if (ev.ability && !guidToEn.has(ev.ability.guid)) {
          guidToEn.set(ev.ability.guid, ev.ability.name);
        }
      }

      // guid → nativeName マップ
      const guidToNative = new Map<number, string>();
      for (const ev of nativeEvents) {
        if (ev.ability && !guidToNative.has(ev.ability.guid)) {
          guidToNative.set(ev.ability.guid, ev.ability.name);
        }
      }

      if (lang === 'en') {
        // 従来ロジック: jaName → enName マッチ
        const translations = new Map<string, string>();
        const guids = new Map<string, number>();

        // guid → jaName マップ（nativeEvents が日本語の場合）
        const guidToJa = guidToNative;

        for (const ev of events) {
          // GUIDベースマッチ
          if (ev.guid && guidToEn.has(ev.guid)) {
            const enName = guidToEn.get(ev.guid)!;
            if (enName !== ev.name.ja && !ev.name.en.trim()) {
              translations.set(ev.id, enName);
            }
            continue;
          }
          // 英語名がない場合、日本語名でGUID検索
          for (const [guid, jaName] of guidToJa) {
            if (jaName === ev.name.ja && !ev.name.en.trim()) {
              const enName = guidToEn.get(guid);
              if (enName && enName !== jaName) {
                translations.set(ev.id, enName);
                guids.set(ev.id, guid);
              }
              break;
            }
          }
        }

        if (translations.size > 0) {
          onMatched({ lang: 'en', translations, guids });
          setStatus({ phase: 'success', count: translations.size });
        } else {
          setStatus({ phase: 'no_match' });
        }
      } else {
        // zh/ko: 英語名 or GUIDベースで2段階マッチ
        const translations = new Map<string, string>();
        const guids = new Map<string, number>();

        // enName → guid の逆引き
        const enToGuid = new Map<string, number>();
        for (const [guid, enName] of guidToEn) {
          if (!enToGuid.has(enName)) enToGuid.set(enName, guid);
        }

        for (const ev of events) {
          let matchedGuid: number | undefined;

          // 1) GUIDベースマッチ（高精度）
          if (ev.guid && guidToNative.has(ev.guid)) {
            matchedGuid = ev.guid;
          }
          // 2) 英語名マッチ（GUIDなしフォールバック）
          if (!matchedGuid && ev.name.en) {
            matchedGuid = enToGuid.get(ev.name.en);
            // suffixed name マッチ（" (TB)" 等）
            if (!matchedGuid) {
              const base = ev.name.en.replace(/ \(TB\)$/, '');
              if (base !== ev.name.en) {
                matchedGuid = enToGuid.get(base);
              }
            }
          }

          if (matchedGuid) {
            let nativeName = guidToNative.get(matchedGuid);
            if (nativeName) {
              // TB suffixの復元
              if (ev.name.en.endsWith(' (TB)') && !nativeName.endsWith(' (TB)')) {
                nativeName += ' (TB)';
              }
              translations.set(ev.id, nativeName);
              if (!ev.guid) {
                guids.set(ev.id, matchedGuid);
              }
            }
          }
        }

        if (translations.size > 0) {
          onMatched({ lang, translations, guids });
          setStatus({ phase: 'success', count: translations.size });
        } else {
          setStatus({ phase: 'no_match' });
        }
      }
    } catch {
      setStatus({ phase: 'error' });
    }
  };
```

- [ ] **Step 4: UI に言語選択ボタンを追加**

URL入力の上に、言語選択ボタングループを追加:

```tsx
{/* 言語選択 */}
<div className="flex items-center gap-2">
  <span className="text-app-base text-app-text-muted">
    {t('admin.tpl_fflogs_lang_label')}
  </span>
  {(['en', 'zh', 'ko'] as const).map((l) => (
    <button
      key={l}
      type="button"
      onClick={() => setLang(l)}
      className={`px-3 py-1 text-app-lg rounded border cursor-pointer transition-colors ${
        lang === l
          ? 'border-purple-500/60 bg-purple-500/15 text-purple-400'
          : 'border-app-text/20 text-app-text-muted hover:bg-app-text/10'
      }`}
    >
      {t(`admin.tpl_fflogs_lang_${l}`)}
    </button>
  ))}
</div>
```

- [ ] **Step 5: モーダルタイトルとヒント文言を言語に応じて変更**

タイトル部分:
```tsx
<h2 className="text-app-2xl font-bold text-app-text">
  {t('admin.tpl_fflogs_title')}
</h2>
```

URLラベル部分 — 言語に応じたヒント:
```tsx
<span className="text-app-base text-app-text-muted">
  {lang === 'en'
    ? t('admin.tpl_fflogs_url_label')
    : t('admin.tpl_fflogs_url_hint_zhko', {
        lang: t(`admin.tpl_fflogs_lang_${lang}`),
      })
  }
</span>
```

- [ ] **Step 6: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/admin/FflogsTranslationModal.tsx
git commit -m "feat: FflogsTranslationModal に言語選択 + zh/ko マッチング追加"
```

---

### Task 5: `AdminTemplates.tsx` の接続変更

**Files:**
- Modify: `src/components/admin/AdminTemplates.tsx`
- Modify: `src/components/admin/TemplateEditorToolbar.tsx` — 変更不要（ボタンは既存のまま）

- [ ] **Step 1: `handleFflogsMatched` を `TranslationMatchResult` 対応に変更**

```typescript
import type { TranslationMatchResult } from '../../hooks/useTemplateEditor';

// 既存の handleFflogsMatched を置き換え:
const handleFflogsMatched = (result: TranslationMatchResult) => {
  if (result.lang === 'en') {
    // 後方互換: enの場合は既存の autoFillEnNames を使う
    const jaToEn = new Map<string, string>();
    for (const [evId, enName] of result.translations) {
      const ev = editor.visibleEvents.find(e => e.id === evId);
      if (ev) jaToEn.set(ev.name.ja, enName);
    }
    editor.autoFillEnNames(jaToEn);
  } else {
    editor.applyTranslation(result);
  }
};
```

- [ ] **Step 2: `FflogsTranslationModal` に `events` prop を追加**

```tsx
<FflogsTranslationModal
  isOpen={showFflogsModal}
  onClose={() => setShowFflogsModal(false)}
  onMatched={handleFflogsMatched}
  events={editor.visibleEvents}
/>
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/AdminTemplates.tsx
git commit -m "feat: AdminTemplates を TranslationMatchResult 対応に接続"
```

---

### Task 6: i18n キー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: 日本語キー追加**

`src/locales/ja.json` の `tpl_fflogs_btn` の後に追加:

```json
"tpl_fflogs_lang_label": "言語",
"tpl_fflogs_lang_en": "English",
"tpl_fflogs_lang_zh": "中文",
"tpl_fflogs_lang_ko": "한국어",
"tpl_fflogs_url_hint_zhko": "{{lang}}サーバーのFFLogsレポートURLを貼り付けてください",
```

既存キーを汎用化:
- `tpl_fflogs_title`: `"FFLogsから翻訳を取得"` に変更
- `tpl_fflogs_matched`: `"{{count}}件の翻訳を自動入力しました"` に変更
- `tpl_fflogs_btn`: `"FFLogs翻訳"` に変更

- [ ] **Step 2: 英語キー追加**

`src/locales/en.json` に同様に追加:

```json
"tpl_fflogs_lang_label": "Language",
"tpl_fflogs_lang_en": "English",
"tpl_fflogs_lang_zh": "中文",
"tpl_fflogs_lang_ko": "한국어",
"tpl_fflogs_url_hint_zhko": "Paste an FFLogs report URL from a {{lang}} server",
```

既存キーを汎用化:
- `tpl_fflogs_title`: `"Get translations from FFLogs"` に変更
- `tpl_fflogs_matched`: `"Auto-filled {{count}} translations"` に変更
- `tpl_fflogs_btn`: `"FFLogs Translation"` に変更

- [ ] **Step 3: 中国語キー追加**

`src/locales/zh.json` に同様:

```json
"tpl_fflogs_lang_label": "语言",
"tpl_fflogs_lang_en": "English",
"tpl_fflogs_lang_zh": "中文",
"tpl_fflogs_lang_ko": "한국어",
"tpl_fflogs_url_hint_zhko": "请粘贴{{lang}}服务器的 FFLogs 报告 URL",
```

既存キーを汎用化:
- `tpl_fflogs_title`: `"从 FFLogs 获取翻译"`
- `tpl_fflogs_matched`: `"自动填充了 {{count}} 个翻译"`
- `tpl_fflogs_btn`: `"FFLogs 翻译"`

- [ ] **Step 4: 韓国語キー追加**

`src/locales/ko.json` に同様:

```json
"tpl_fflogs_lang_label": "언어",
"tpl_fflogs_lang_en": "English",
"tpl_fflogs_lang_zh": "中文",
"tpl_fflogs_lang_ko": "한국어",
"tpl_fflogs_url_hint_zhko": "{{lang}} 서버의 FFLogs 리포트 URL을 붙여넣으세요",
```

既存キーを汎用化:
- `tpl_fflogs_title`: `"FFLogs에서 번역 가져오기"`
- `tpl_fflogs_matched`: `"{{count}}개 번역 자동 입력됨"`
- `tpl_fflogs_btn`: `"FFLogs 번역"`

- [ ] **Step 5: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: FFLogs翻訳モーダルの i18n キー追加（4言語）"
```

---

### Task 7: ビルド + 全テスト実行

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 2: プロダクションビルド**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 最終コミット（必要な場合のみ）**

テストやビルドで修正が必要だった場合のみコミット。
