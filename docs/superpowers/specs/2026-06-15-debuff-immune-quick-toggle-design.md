# デバフ軽減不可 ワンタッチ設定 — 設計書

- 日付: 2026-06-15
- 関連: [2026-06-14-timeline-damage-type-and-debuff-immune-design.md](./2026-06-14-timeline-damage-type-and-debuff-immune-design.md)（`ignoresDebuffMitigation` 本体機能の設計）
- ステータス: 設計確定（ユーザー承認済 2026-06-15）

## 背景・目的

`ignoresDebuffMitigation`（イベント単位の「デバフ系軽減（リプライザル/フェイント/アドル/ディスマントル）の % 軽減を無効化」フラグ）は、現在 **アプリ内のイベント編集モーダル（[EventForm.tsx](../../../src/components/EventForm.tsx) のチェックボックス）でしか設定できない**。種別アイコンの赤枠を付けたいだけでもモーダルを開く必要があり手数が多い。また **管理画面のテンプレ編集には設定 UI が無い**ため、公式ボステンプレに最初から印を付けられない。

本タスクで以下の 2 経路を追加する：

1. **タイムラインで種別アイコンを右クリック**するとフラグを即トグル（PC のみ）
2. **管理画面テンプレ編集**にチェック列を追加し、公式データに保存可能にする

## スコープ

### 含む
- タイムライン（PC）の種別アイコン右クリックトグル
- 種別アイコンのツールチップ更新（左右クリックの操作説明＋現在状態）
- 管理画面テンプレ編集テーブルへの「デバフ軽減不可」チェック列追加
- i18n 4 言語（ja/en/ko/zh）

### 含まない（今回やらない）
- モバイル長押しトグル（将来のスマホ/タブレット一括改善で対応）
- 管理画面の一括編集（[BulkEditPopover.tsx](../../../src/components/admin/BulkEditPopover.tsx)）への追加
- EventForm モーダルのチェックボックス（既存のまま＝発見しやすい正規経路として維持）

## 現状の事実確認（実装の根拠）

- 種別アイコンの左クリック循環は `PcTypeToggle`（[TimelineRow.tsx:127](../../../src/components/TimelineRow.tsx#L127)）。`updateEvent(event.id, { damageType: nextDamageType(...) })` で即トグルし、collab 同期・Undo・ダメージ再計算はモーダル変更と同一経路。`damageType` が無い/`enrage` のときは `null`（クリック領域を作らない）。
- 赤枠表示は [DamageTypeIcon.tsx](../../../src/components/DamageTypeIcon.tsx)。`ignoresDebuffMitigation=true` のとき赤背景＋赤リングの箱で囲む。**ON のとき内部で自前 `Tooltip`（`timeline.debuff_immune_hint`）をレンダリングする** → PC では `PcTypeToggle` のツールチップと二重になる。
- 管理画面テンプレ編集テーブル（[TemplateEditor.tsx](../../../src/components/admin/TemplateEditor.tsx)）は種別を `DropdownCell` で編集し、`onUpdateCell(evId, 'damageType', val)` を呼ぶ。`onUpdateCell` の型は `(eventId, field, value: any)`。`ignoresDebuffMitigation` のセルは存在しない。
- セル更新の実体は `updateCell`（[useTemplateEditor.ts:125](../../../src/hooks/useTemplateEditor.ts#L125)）。**`switch(field)` で明示 case のみ処理し、`default: return prev`**（[useTemplateEditor.ts:160](../../../src/hooks/useTemplateEditor.ts#L160)）＝未知フィールドは無視される。汎用書き込みではない。
- 保存は `getSaveData`（[useTemplateEditor.ts:439](../../../src/hooks/useTemplateEditor.ts#L439)）が `state.current` のイベントをそのまま返す → `updateCell` がイベントに書き込めば全フィールド（`ignoresDebuffMitigation` 含む）が保存される。
- 既存 i18n キー：`modal.ignores_debuff_mitigation`=「デバフ軽減不可」、`modal.ignores_debuff_mitigation_desc`、`timeline.toggle_type_hint`=「クリックでタイプ切替(物理→魔法→ユニーク)」、`timeline.debuff_immune_hint`=「デバフ軽減無効」（4 言語とも存在）。

## 詳細設計

### ① タイムライン 右クリックトグル（PC）

`PcTypeToggle`（[TimelineRow.tsx:127](../../../src/components/TimelineRow.tsx#L127)）の `<button>` に `onContextMenu` を追加：

```tsx
onContextMenu={(e) => {
    e.preventDefault();   // ブラウザ標準の右クリックメニューを抑止
    e.stopPropagation();  // 行クリック(編集モーダル)を抑止
    updateEvent(event.id, { ignoresDebuffMitigation: !event.ignoresDebuffMitigation });
}}
```

- 左クリックと同一の `updateEvent` 経路なので、collab 同期・Undo・ダメージ再計算・赤枠の即時反映はすべて自動で正しく動く。
- 純粋閲覧者は `updateEvent` の store ガードで no-op（既存挙動を継承）。
- 右クリック対象は種別アイコンが描画される `physical / magical / unavoidable` のみ（`enrage`/未設定は `PcTypeToggle` が `null` を返すため対象外）。デバフ軽減はダメージイベントにのみ意味を持つので妥当。

### ② ツールチップ（操作＋現在状態）

`PcTypeToggle` のボタンのツールチップを 2 行に更新（現在状態を含む）：

```
左クリック: 種別を変更
右クリック: デバフ軽減不可 を切替（現在: OFF）   ← フラグONのとき「現在: ON」
```

- ツールチップ内容は現在状態（ON/OFF）で動的に変わるため、コード側で組み立てる（i18n キー＋ `event.ignoresDebuffMitigation` から ON/OFF を差し込む）。
- ON/OFF の表記は 4 言語とも `ON`/`OFF`（汎用的に通じる）で統一。

**二重ツールチップの整理**：`DamageTypeIcon` に「内部ツールチップを出さない」オプション（例 `withTooltip?: boolean`、既定 `true`）を追加する。`PcTypeToggle` 内の `DamageTypeIcon` には `withTooltip={false}` を渡し、**PC ではボタン側の 2 行ツールチップ 1 つに統一**。モバイル（`md:hidden` の表示専用アイコン）・カンペ（CheatSheetView）は従来どおり内部ツールチップ（`timeline.debuff_immune_hint`）を維持。

i18n キー（新設、4 言語）案：
- `timeline.type_action_left` = 「左クリック: 種別を変更」
- `timeline.type_action_right` = 「右クリック: デバフ軽減不可 を切替（現在: {{state}}）」（`{{state}}` に `ON`/`OFF`）

### ③ 管理画面 テンプレ編集 チェック列

[TemplateEditor.tsx](../../../src/components/admin/TemplateEditor.tsx) のテーブルに「デバフ軽減不可」列を **種別ドロップダウン列と対象列の間（種別のすぐ右）** に追加：

- `<colgroup>`（[TemplateEditor.tsx:455](../../../src/components/admin/TemplateEditor.tsx#L455) 付近）に `<col>` を 1 本追加
- `<thead>` に `<th>{t('admin.tpl_editor_debuff_immune')}</th>` を追加
- 各行に `<td>` チェックボックスセルを追加：
  ```tsx
  <input
    type="checkbox"
    data-testid="tpl-ignores-debuff-mit"
    checked={!!event.ignoresDebuffMitigation}
    onChange={(e) => onUpdateCell(evId, 'ignoresDebuffMitigation', e.target.checked)}
    className="w-4 h-4 accent-red-500 cursor-pointer"
  />
  ```
- `updateCell`（[useTemplateEditor.ts:125](../../../src/hooks/useTemplateEditor.ts#L125)）の `switch` に case を追加：
  ```ts
  case 'ignoresDebuffMitigation':
    ev.ignoresDebuffMitigation = value as boolean;
    break;
  ```
  → `getSaveData` がそのまま運ぶので公式テンプレに保存される。
- 列ヘッダー i18n キー新設：`admin.tpl_editor_debuff_immune` = 「デバフ軽減不可」（4 言語）。

### i18n 一覧（新設キー）

| キー | ja | en | ko | zh |
|---|---|---|---|---|
| `timeline.type_action_left` | 左クリック: 種別を変更 | Left-click: Change type | 좌클릭: 타입 변경 | 左键: 切换类型 |
| `timeline.type_action_right` | 右クリック: デバフ軽減不可 を切替（現在: {{state}}） | Right-click: Toggle "Ignores debuff mitigation" (now: {{state}}) | 우클릭: '디버프 경감 불가' 전환 (현재: {{state}}) | 右键: 切换"无视减益减伤"(当前: {{state}}) |
| `admin.tpl_editor_debuff_immune` | デバフ軽減不可 | Ignores debuff mit. | 디버프 경감 불가 | 无视减益减伤 |

（訳は実装時に既存キーのトーンに合わせて最終確認する。`{{state}}` は ON/OFF を差し込む。）

## テスト計画（TDD）

- **タイムライン右クリック**：`PcTypeToggle` を右クリック（`contextMenu` イベント）すると `updateEvent` が `{ ignoresDebuffMitigation: 反転値 }` で呼ばれる。`preventDefault`/`stopPropagation` が呼ばれる。閲覧者ガードで no-op になる（store 側既存テストで担保される範囲は流用）。
- **DamageTypeIcon `withTooltip`**：`withTooltip={false}` のとき内部ツールチップを描画しない。既定（`true`）では従来どおり描画する。
- **updateCell 新 case**：`updateCell(id, 'ignoresDebuffMitigation', true/false)` でイベントの該当フィールドが更新され、`modified` に記録される（[useTemplateEditor.test.ts](../../../src/hooks/__tests__/useTemplateEditor.test.ts) に追加）。
- **admin セル描画**：TemplateEditor テーブルにチェックボックス列が描画され、変更で `onUpdateCell` が `'ignoresDebuffMitigation'` を呼ぶ。
- `npm run build`（tsc 厳密）+ `vitest run` を push 前に必須実行。

## 検証（実機）

本番デプロイ後：
1. タイムラインで種別アイコンを右クリック → 赤枠が即 ON/OFF、ツールチップに現在状態が出る
2. 右クリックで ON にしたイベントでデバフ系軽減（リプライザル等）の % が効かないことを確認
3. 管理画面テンプレ編集でチェック → 保存 → 反映先で赤枠が出ることを確認

## リスク・留意

- `DamageTypeIcon` の `withTooltip` 追加は CheatSheetView / MobileTimelineRow の既存呼び出しに影響しない（既定 `true` のため）。各呼び出し箇所を確認し、回帰がないことを確認する。
- 右クリックは PWA/モバイルでは発火しない（=モバイル無影響）。意図どおり。
- 管理画面の列追加でテーブル幅が増える。デスクトップ前提なので許容。横スクロール有無を実機確認。
