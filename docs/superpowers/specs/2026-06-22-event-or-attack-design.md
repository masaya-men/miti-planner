# 敵攻撃 "or"（2択攻撃）設計書

- **日付**: 2026-06-22
- **対象**: ボス技イベント（`TimelineEvent`）が「A or B」の2択（名前が変わる攻撃）を表現できるようにする
- **元要望**: 機能ブラッシュアップ案⑦（`docs/.private/2026-06-15-feature-ideas-batch.md`）+ ユーザー個人メモ（2026/06/10）。「高難度の2択攻撃（ホリゾンタル or ヴァーティカル等）。イベント追加モーダルも管理画面も、常に "or なになに" 欄があり、空欄なら通常・入れたい時だけ入れる」
- **ブランチ**: `feat/event-or-attack`（main=本番デプロイ済から分岐）
- **位置づけ**: タイムラインのイベント表現拡張。データモデルに任意の代替名を1つ持たせるだけの小〜中規模。

---

## 1. 確定した設計判断（brainstorming 2026-06-22・ユーザー承認済）

- **名前だけ変わる**: 2択は名前のみ。ダメージ量・属性(`damageType`)・対象(`target`)・時刻(`time`)は**1つの枠で共通**（A も B も同じダメージ）。→ 軽減計算・配置ロジックは一切変更不要。
- **最大2択**: 代替名は**1つだけ**（`altName`）。3択以上は対象外（YAGNI・出たら将来配列化）。
- **表示**: **「攻撃1 or 攻撃2」**（連結語は "or"）。
- **編集できる場所**: ユーザー側イベントフォーム **と** 管理画面テンプレートエディタの**両方**。空欄＝通常イベント。
- **スプシ取り込みの "or" 自動分割は v1 スコープ外**（main 投入後の follow-up）。

---

## 2. 現状（実コード・grounding 済）

- 型: `TimelineEvent`（`src/types/index.ts:108-121`）= `{ id; time; name: LocalizedString; guid?; damageType; damageAmount?; target?; ignoresDebuffMitigation?; warning?; mechanicGroup? }`。`TemplateData.timelineEvents` も同じ `TimelineEvent[]`（`src/data/templateLoader.ts:18`）→ **型を1箇所直せばユーザー側も管理側も両方効く**。
- ローカライズ取得ヘルパ: `getPhaseName(value: LocalizedString, lang)`（`src/types/index.ts:9-16`・en→ja フォールバック）。独立 `localize` ユーティリティは無く全箇所これを使う。
- ユーザー編集: `src/components/EventForm.tsx`（`EventModal` 内）。`name` 入力 = `EventForm.tsx:641-654`（現言語1言語分のみ）。`damageType`/`target`/`damageAmount`/`ignoresDebuffMitigation` も同フォーム内。
- 管理編集: `src/components/admin/TemplateEditor.tsx`（スプレッドシート型テーブル）。`name` は JA/EN/ZH/KO の4列を `EditableCell` で（`TemplateEditor.tsx:575-615`）。`onUpdateCell(evId, 'name.ja', val)` 形式。colgroup=`:443-455`、thead=`:471-479`。
- 描画: `src/components/TimelineRow.tsx`。`getEventName(ev) = getPhaseName(ev.name, contentLanguage)`（`:279-280`）→ `EventNameSpan`（`:22`・string を受けるだけ）で表示（1件=`:477`、2件=`:533`）。
- スプシ取り込み: `src/lib/sheetImport/buildPlanFromSheets.ts:35` = `name: { ja: row.action, en: row.action }`（"A or B" は分割せずそのまま name に入る）。

---

## 3. 機能設計

### 3.1 データモデル
`TimelineEvent`（`src/types/index.ts`）に追加:
```ts
/** 2択攻撃の代替名（"A or B" の B）。無し/空 = 通常イベント。名前だけ変わりダメージ等は共通。 */
altName?: LocalizedString;
```
- `LocalizedString`（`{ ja; en; zh?; ko? }`）で `name` と同型。
- `TemplateData` は `TimelineEvent` を直接使うため、この1行で管理側にも反映。

### 3.2 タイムライン表示（`TimelineRow.tsx`）
`getEventName` を「altName があれば連結」へ拡張:
```ts
const getEventName = (ev: TimelineEvent) => {
  const main = ev.name ? getPhaseName(ev.name, contentLanguage) : '';
  if (!ev.altName) return main;
  const alt = getPhaseName(ev.altName, contentLanguage);
  if (!alt) return main;
  return `${main} ${t('event.or_connector')} ${alt}`; // 攻撃1 or 攻撃2
};
```
- 連結語はハードコードせず i18n キー `event.or_connector`（= "or"）。
- altName の現言語が空なら `getPhaseName` が en→ja フォールバック（name と同じ挙動）。
- 長くなった場合は既存の省略表示（`EventNameSpan` の clip）にそのまま乗る。**ホバー時マーキーは §5 の別タスク**で全クリップ名に一括対応。

### 3.3 ユーザー編集（`EventForm.tsx`）
攻撃名入力（`:641-654`）の**直下**に「or（別の攻撃名・任意）」入力を1つ追加:
- `useState` に `altName`（`:55` 付近）を追加。`initialData`/リセット（`:122`/`:137` 付近）で `setAltName(initialData?.altName ?? { ja:'', en:'' })`。
- `name` と同じく**現言語1言語分**を編集（`value = contentLanguage==='en' ? altName.en : altName.ja`、onChange で該当言語を更新）。
- `onSave`（`:596-603` 付近）に `altName` を含める。**ただし altName の全言語が空なら `altName` を付けない**（= 通常イベント。`undefined` で保存）。
- ラベルは i18n `event.alt_name_label`。プレースホルダ `event.alt_name_placeholder`。

### 3.4 管理画面編集（`TemplateEditor.tsx`）
技名(JA/EN/ZH/KO)の隣に **altName(JA/EN/ZH/KO) の4列**を追加（`name` と同じ `EditableCell` + `onUpdateCell(evId, 'altName.ja', val)` パターン）:
- colgroup（`:443-455`）に4列、thead（`:471-479`）に「or(JA)」等のヘッダ、td（`:575-615`）に4セル。
- `onUpdateCell` が `'altName.xx'` パスを処理できるよう、ネストキー設定箇所（`useTemplateEditor` の updateCell）に `altName` を許可。空文字コミットで該当言語クリア、全言語空なら `altName` を落とす（任意・最低限は空 LocalizedString のまま保持でも可）。
- **テーブルが横に4列広がる**点はユーザー承認済（v1は素直に4列、将来狭ければポップアップ集約へ）。

### 3.5 i18n（4言語: ja/en/ko/zh）
`src/locales/{ja,en,ko,zh}.json` に追加:

| キー | ja | en | ko | zh |
|---|---|---|---|---|
| `event.or_connector` | or | or | or | or |
| `event.alt_name_label` | or（別の攻撃名・任意） | or (alternate name, optional) | or (다른 공격명·선택) | or（其他攻击名·可选） |
| `event.alt_name_placeholder` | 例: ヴァーティカル | e.g. Vertical | 예: 버티컬 | 例: 垂直 |

（`event` セクションが無ければ新設。`or_connector` は当面全言語 "or"。）

---

## 4. スコープ外（follow-up・別タスク）
- **スプシ取り込みの "A or B" 自動分割 → altName**: `buildPlanFromSheets.ts:35` で action を " or "/"or" で分割し name/altName に振り分け。**本 spec が main に乗った後**に実施（buildPlanFromSheets は取り込み機能側）。分割の正規表現・全角/半角・前後空白・「A or B or C(3つ目)」が来た時の扱い（先頭2つ採用 or 警告）は着手時に詰める。
- **FFLogs マッパー**（`fflogsMapper.ts`）の altName 対応: v1 不要。

---

## 5. 関連・別タスク（決定事項保存）: 見切れ名のホバー・マーキー

⑦とは独立した**全イベント名共通のUX改善**（2択で長名が増えるのが動機だが適用は全クリップ名）。**別タスクとして実施**（⑦の後 or 独立）。ユーザー承認済の方針:

- **対象 = 見切れている（クリップされた）攻撃名すべて**。ホバー中だけ横に流れて戻る（マーキー）。
- **「マウス追従UI禁止」ルールには非該当**（あれは `onMouseMove` 高頻度の話。これはホバー＝低頻度でCSSアニメ）。
- **実装ガードレール（#59 の教訓そのもの・[[reference_perf_forced_reflow_resizeobserver]]）**:
  1. **見切れ判定は ResizeObserver でマウント/リサイズ時に計算**し `data-clipped` 等の印を付ける。`onMouseEnter` で `scrollWidth` を読むのは forced reflow（#59 で 1,200行 hover 連鎖 384ms→0ms になった罠）→**禁止**。
  2. スクロールは **CSS `translateX`**（GPU・reflow無し）。`scrollLeft` 禁止。
  3. **`prefers-reduced-motion` を尊重**（無効ユーザーには流さず静止）。
  4. ホバーは常に1行のみ＝コスト1要素分で軽い。
- **UX**: 「開始前に一拍→ゆっくり流す→端で一拍→戻る」の間を入れて読みやすく。
- 着手時は別途 brainstorming/spec は軽くてよい（方針は本節で確定済み）。

---

## 6. 影響ファイルまとめ
| 対象 | 変更 |
|---|---|
| `src/types/index.ts` | `TimelineEvent.altName?: LocalizedString` 追加（1行） |
| `src/components/EventForm.tsx` | altName 入力（現言語1言語）追加・state/init/onSave 配線 |
| `src/components/admin/TemplateEditor.tsx` | altName 4列（colgroup/thead/td）+ `onUpdateCell('altName.xx')` 許可 |
| `src/components/TimelineRow.tsx` | `getEventName` を「A or B」連結に拡張 |
| `src/hooks/useTemplateEditor.ts` | updateCell が `altName.xx` ネストキーを処理 |
| `src/locales/*.json` | `event.or_connector`/`alt_name_label`/`alt_name_placeholder` |

`name` のローカライズ取得・描画・編集の既存パターンに全て相乗りするため、新規概念はほぼ無し。

---

## 7. テスト計画
- 型/描画ロジック: `getEventName` 相当の純関数化が可能なら unit（altName 有/無/現言語空→フォールバック/連結語）。難しければ TimelineRow のレンダーテストで「A or B」表示を確認。
- EventForm: altName 入力→onSave に乗る／全空なら altName 無しで保存、の挙動。
- 管理 TemplateEditor: `altName.ja` 等のセル編集が `onUpdateCell` を正しく呼ぶ。
- i18n 4言語パリティ（`event.*`）。
- push 前 `npm run build`（Vercel tsc -b 厳密・`import type`・未使用なし）。
- 実機: 2択イベントを作成→タイムラインに「攻撃1 or 攻撃2」表示・編集往復（[[feedback_endpoint_user_verification]]）。

---

## 8. 完了後
v1（手動編集＋表示）を実機確認→OKで main へ merge＋デプロイ。その後 §4（スプシ自動分割）と §5（マーキー）を別タスクで。
