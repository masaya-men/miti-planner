# テンプレート技名 zh/ko 翻訳機能 設計書

## 概要

管理画面のテンプレート編集画面で、FFLogsレポートURLを使って中国語(zh)・韓国語(ko)の技名翻訳をテンプレートに追加する機能。

## 背景

- テンプレートの `TimelineEvent.name` は `LocalizedString`（ja/en必須、zh/ko任意）
- 現在テンプレートにはja/enしか入っていない
- FFLogs APIの `translate` パラメータで、レポートのネイティブ言語の技名を取得可能
  - 中国語サーバーのレポート → 中国語技名
  - 韓国語サーバーのレポート → 韓国語技名

## 管理者のワークフロー

1. テンプレート編集画面でツールバーの翻訳ボタンを押す
2. モーダルで **言語を選択**（zh / ko）
3. 該当言語サーバーの **FFLogsレポートURL** を入力
4. 「取得」ボタンを押す
5. マッチ結果が表示される（例: 「12件の技名をマッチしました」）
6. テンプレートの `name.zh` または `name.ko` に一括反映される

毎回同じ操作。GUIDは裏側で自動保存され、管理者が意識する必要はない。

## 技術設計

### 1. `TimelineEvent` に `guid` フィールド追加

**ファイル**: `src/types/index.ts`

```typescript
export interface TimelineEvent {
    id: string;
    time: number;
    name: LocalizedString;
    guid?: number;           // ← 追加: FFLogs ability GUID
    damageType: 'magical' | 'physical' | 'unavoidable' | 'enrage';
    damageAmount?: number;
    target?: 'AoE' | 'MT' | 'ST';
    warning?: boolean;
    /** @deprecated */
    mechanicGroup?: LocalizedString;
}
```

- optional なので既存テンプレートに影響なし
- Firestoreの既存データもそのまま動く

### 2. `fflogsMapper.ts` で GUID を保存

**ファイル**: `src/utils/fflogsMapper.ts`

TimelineEvent 生成時に、`Norm` オブジェクトの `guid` を `TimelineEvent.guid` にコピーする。
具体的には damage event と cast event の両方の TimelineEvent 生成箇所で対応。

これにより、今後 FFLogs からインポートされるテンプレートには自動的に GUID が付く。

### 3. `FflogsTranslationModal` の拡張

**ファイル**: `src/components/admin/FflogsTranslationModal.tsx`

#### Props変更

```typescript
interface FflogsTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 変更: 言語とマッチ結果を返す
  onMatched: (result: TranslationMatchResult) => void;
  // 追加: 現在のテンプレートイベント（GUIDマッチ用）
  events: TimelineEvent[];
}

interface TranslationMatchResult {
  lang: 'en' | 'zh' | 'ko';
  // eventId → 翻訳名のマップ
  translations: Map<string, string>;
  // eventId → GUID のマップ（GUIDがなかったイベントに保存用）
  guids: Map<string, number>;
}
```

#### マッチングロジック

1. FFLogsから **英語イベント**（translate=false）と **対象言語イベント**（translate=true）を並行取得
2. GUIDをキーにして `guid → enName` と `guid → targetLangName` のマップを構築
3. テンプレートの各イベントとマッチ:
   - **GUIDあり**: テンプレートの `event.guid` で直接マッチ（高精度）
   - **GUIDなし**: FFLogsの `enName` とテンプレートの `event.name.en` で文字列マッチ → GUIDも取得
4. マッチしたイベントの翻訳名 + GUID を返す

#### 言語選択時の挙動

- `en` 選択: 従来の ja→en マッチ動作（後方互換）
- `zh` / `ko` 選択: 上記の2段階マッチ

#### UI変更

- URL入力の上に言語選択ボタン（en / zh / ko）を追加
- URLラベルに「中国語サーバーのFFLogsレポートURL」等のヒントを表示
- ステータスメッセージは既存のスタイルを踏襲

### 4. `useTemplateEditor.ts` に翻訳適用関数を追加

**ファイル**: `src/hooks/useTemplateEditor.ts`

```typescript
const applyTranslation = useCallback(
  (result: TranslationMatchResult) => {
    setState((prev) => {
      const newCurrent = structuredClone(prev.current);
      const newAutoFilled = new Set(prev.autoFilled);

      for (const ev of newCurrent) {
        if (prev.deleted.has(ev.id)) continue;

        // 翻訳を適用
        const translation = result.translations.get(ev.id);
        if (translation) {
          ev.name[result.lang] = translation;
          newAutoFilled.add(`${ev.id}:name.${result.lang}`);
        }

        // GUIDを保存（なかった場合のみ）
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

### 5. `AdminTemplates.tsx` の接続

**ファイル**: `src/components/admin/AdminTemplates.tsx`

- `FflogsTranslationModal` に `events={editor.visibleEvents}` を追加
- `handleFflogsMatched` を `TranslationMatchResult` 対応に変更
  - `lang === 'en'` → 既存の `autoFillEnNames` を呼ぶ
  - `lang === 'zh' | 'ko'` → 新しい `applyTranslation` を呼ぶ

### 6. i18nキー追加

**ファイル**: `src/locales/{ja,en,zh,ko}.json`

- `admin.tpl_fflogs_lang_label`: 言語選択ラベル
- `admin.tpl_fflogs_lang_en` / `_zh` / `_ko`: 各言語ボタンラベル
- `admin.tpl_fflogs_url_hint_zh` / `_ko`: URLヒントテキスト

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/types/index.ts` | `TimelineEvent` に `guid?: number` 追加 |
| `src/utils/fflogsMapper.ts` | GUID を TimelineEvent に保存 |
| `src/components/admin/FflogsTranslationModal.tsx` | 言語選択UI + 2段階マッチロジック |
| `src/hooks/useTemplateEditor.ts` | `applyTranslation` 関数追加 |
| `src/components/admin/AdminTemplates.tsx` | props接続変更 |
| `src/locales/*.json` | i18nキー追加 |

## 既存機能への影響

- `guid` はoptionalなので既存テンプレート・ユーザープランに影響なし
- 既存の en 翻訳フロー（`autoFillEnNames`）はそのまま動く
- `lang === 'en'` 選択時は従来と同じ挙動
