# タイムライン 種別クリックループ + デバフ軽減不可 属性 — 設計書

作成日: 2026-06-14
ブランチ想定: `feat/collab-public-release`(または派生)

## 1. 背景・目的

タイムライン上の攻撃イベントには「種別 (damageType)」アイコンが表示されているが、
現状はアイコン表示のみで、編集はイベントモーダルの中でしかできない。直前のセッションで
「対象 (MT/ST)」はタイムライン上のクリックでトグルできるようにした
([TimelineRow.tsx](../../../src/components/TimelineRow.tsx) `PcTargetToggle`)。

本タスクは 2 つ:

1. **要望1**: 種別アイコンも、対象と同じく **タイムライン上のクリックでループ**して切り替えられるようにする。
2. **要望2**: 種別とは **別軸のフラグを 1 つ追加**。物理/魔法/ユニークどれにでも重ねて付けられ、
   ON にするとその攻撃が「**デバフ軽減が効かない**」属性になる(FF14 の外周攻撃など)。

## 2. ゴール / 非ゴール

### ゴール
- 種別アイコンを PC でクリック → `物理 → 魔法 → ユニーク → 物理…` の 3 循環(即時反映)。
- 攻撃イベントに「デバフ軽減不可」フラグを追加し、**デバフ系軽減スキルの % 軽減だけ**を計算から除外する。
- フラグの ON/OFF は **イベント編集モーダルのチェックボックス**で行う(A 案)。
- タイムライン(PC・モバイル両方)で、フラグ ON の攻撃の種別アイコンを **赤い小箱で囲って**可視化する。

### 非ゴール(今回やらない)
- オートプラン([autoPlanner.ts](../../../src/utils/autoPlanner.ts))がフラグを考慮してデバフ系を避ける最適化。
  → 現状はオートプランがデバフ系を置いても「効かない」だけで壊れはしない。将来の改善として別タスク。
- 種別のクリックループにフラグを混ぜる(6 状態化)。ユーザー判断で却下済(フラグは直交属性)。
- モバイルでの種別クリックループ(モバイルは従来どおりモーダルで編集。印の表示のみ対応)。

## 3. 「デバフ系軽減」の定義(計算対象)

ボスに **デバフ**を付与してダメージを下げる 4 スキル(レベルシンク版 `_base` 含む)のみを
デバフ系と定義する。他のタンクバフ・パーティ軽減・バリア・無敵は全て「プレイヤー側」なので影響しない。

| ID | スキル | ジョブ |
|---|---|---|
| `reprisal` / `reprisal_base` | リプライザル | タンク |
| `feint` / `feint_base` | フェイント | 近接DPS |
| `addle` / `addle_base` | アドル | 魔法DPS |
| `dismantle` | ウェポンブレイク (Dismantle) | 機工士 |

データ上は各スキルへフラグを付けて表現する(ハードコードした ID リストで判定しない)。

## 4. データモデル変更

### 4.1 `Mitigation` 型([src/types/index.ts](../../../src/types/index.ts))
```ts
/** ボスにデバフを付与してダメージを下げるタイプの軽減か(リプライザル等)。
 *  true の軽減は、イベントの ignoresDebuffMitigation=true のとき % 軽減計算から除外される。 */
appliesAsDebuff?: boolean;
```
- [src/data/mockData.ts](../../../src/data/mockData.ts) の上記 4 スキル(+`_base`)に `appliesAsDebuff: true` を付与。
- 未指定は `false` 扱い(後方互換・既存データ無影響)。
- **スキルデータ正本は Firestore**。mockData 編集後に `scripts/seed-skills-stats.ts` で Firestore へ同期必須
  (memory `feedback_skill_firestore_sync`)。

### 4.2 `TimelineEvent` 型([src/types/index.ts](../../../src/types/index.ts))
```ts
/** true のとき、デバフ系軽減(appliesAsDebuff)の % 軽減を無効化する(外周攻撃など)。 */
ignoresDebuffMitigation?: boolean;
```
- 未指定は `false` 扱い(後方互換)。
- OFF にするときは `false` を明示セット(`undefined` だと collab の delta upsert で同期されないため。§7 参照)。

## 5. 計算ロジック変更

### 5.1 メイン計算([Timeline.tsx](../../../src/components/Timeline.tsx) の % 軽減ループ 1854-1896 行)
% 軽減を掛ける forEach の冒頭(`def` 取得直後)に 1 行追加:
```ts
// デバフ軽減不可の攻撃には、デバフ系軽減の % を適用しない
if (event.ignoresDebuffMitigation && def.appliesAsDebuff) return;
```
- これにより `currentDamage` も `mitigationMultipliers`(= ▼XX% 表示)も、当該スキル分が反映されなくなる。
- **バリア(シールド)ループ(1901-2053 行)は変更しない**。デバフ 4 スキルは `isShield` ではないので
  そもそもバリアループに入らない。バリア・無敵・プレイヤーバフ % は全て従来どおり効く。

### 5.2 モーダルのダメージプレビュー([EventForm.tsx](../../../src/components/EventForm.tsx) 415-421 行付近)
EventForm は自前で軽減プレビューを計算しているため、同じスキップを入れて
本体計算と一致させる。モーダル内チェックボックスの状態(`ignoresDebuffMitigation` ローカル state)を参照する。

### 5.3 その他の「軽減後ダメージ」表示箇所(実装時に横断確認)
- [CheatSheetView.tsx](../../../src/components/CheatSheetView.tsx) が独自にダメージを再計算している場合は同様の対応が必要。
  実装時に grep で軽減計算箇所を洗い出し、漏れがないか確認する(検証項目)。
- タイムライン各行([TimelineRow.tsx](../../../src/components/TimelineRow.tsx) /
  [MobileTimelineRow.tsx](../../../src/components/MobileTimelineRow.tsx))は Timeline.tsx で計算済みの
  `damages` を props で受け取るだけなので、5.1 の修正で自動的に正しくなる。

## 6. UI 変更

### 6.1 要望1: 種別クリックループ(PC のみ)
- 新コンポーネント `PcTypeToggle`(`PcTargetToggle` と同形)を作る。
  - 種別アイコン(`/icons/type_magic.png` 等)をボタンでラップ。
  - クリックで `updateEvent(event.id, { damageType: next })`。順序 = `physical → magical → unavoidable → physical`。
  - `e.stopPropagation()` で行クリック(モーダル)を抑止。`active:scale-95` 等は既存トグルに合わせる。
  - 純粋閲覧者は store 側ガードで no-op(`updateEvent` 経由なので既存と同一経路)。
- 配置: 種別アイコンは現在イベント名の **左**([TimelineRow.tsx:391-394](../../../src/components/TimelineRow.tsx#L391))。
  右側の対象トグル/コピーのクラスタとは独立。左のアイコンをそのままボタン化する。
- 種別アイコンとフラグ印の描画は、PC・モバイルで共有する小コンポーネント
  `DamageTypeIcon`(props: `damageType`, `ignoresDebuffMitigation`, `size`)に切り出して DRY 化する。
  - PC: `PcTypeToggle` が `DamageTypeIcon` をボタン内に置く(クリック可)。
  - モバイル: `DamageTypeIcon` を直接描画(クリック不可)。

### 6.2 要望2: フラグ編集 UI(モーダル)
- [EventForm.tsx](../../../src/components/EventForm.tsx) の種別 SegmentButton の近くに
  チェックボックス(またはトグル)を追加。ラベルは i18n キー(例 `modal.ignores_debuff_mitigation`)。
  - 補足テキスト(短い説明)を添える: 「リプライザル等のデバフ系軽減が効かない攻撃」。
- 既存の `damageType` ローカル state と同様に、`ignoresDebuffMitigation` のローカル state を持ち、
  `initialData` から復元・onSubmit(589 行付近)で `ignoresDebuffMitigation` を含めて保存。

### 6.3 要望2: フラグの可視化(印・PC + モバイル)
- `DamageTypeIcon` 内で `ignoresDebuffMitigation` が true のとき、アイコンを **赤い小箱**で囲う:
  - 既存の対象バッジ(`bg-cyan-400/10` 等)と同じ作法 = 淡い赤背景 + 赤リング + `rounded-sm` + 内側 1px 余白。
  - 目安クラス: `bg-red-500/10 ring-1 ring-red-500/40 rounded-sm p-px`(**最終的な濃さ・余白は実機で 1 つずつ調整**)。
  - LoPo トンマナ: 赤は「危険・不可」の機能色なので使用可(白黒ルールの例外、`ui-design.md` 準拠)。
- マウスホバーで Tooltip「デバフ軽減無効」(i18n `timeline.debuff_immune_hint` 等)を表示。
- 実機確認をユーザーと 1 つずつ行ってから確定(memory `feedback_one_fix_one_verify` / UI 承認フロー)。

### 6.4 i18n(4 言語)
新規キーを ja/en/ko/zh に追加(zh/ko は ja コピーでも可、後で訳):
- 種別トグルのヒント(必要なら): `timeline.toggle_type_hint`
- フラグ印の Tooltip: `timeline.debuff_immune_hint`
- モーダルのチェックボックスラベル + 補足: `modal.ignores_debuff_mitigation`(+ `_desc`)

## 7. collab(共同編集)同期

- events は [yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts) の `recordToYMap` / `applyUpsert` が
  **オブジェクトの全フィールドを走査**して同期する(68-80 行)。`updateEvent` 経由の変更は
  既存の対象トグルと同じ経路で collab に乗るため、`ignoresDebuffMitigation` も **自動的に同期される**。
- 注意: `applyUpsert` の部分更新は `v !== undefined` のフィールドのみ set する。
  フラグを OFF にするときは `undefined` でなく `false` を明示セットすること(§4.2)。
- `appliesAsDebuff` はスキル**定義**側(Firestore/mockData)であり、プラン間で同期するデータではないので collab 無関係。
- 実装後に **2 ブラウザでフラグ ON/OFF が伝播するか検証**(公開直後ブランチのため必須)。

## 8. テスト

- **計算(最重要)**: `ignoresDebuffMitigation=true` のイベントで、
  - リプライザル等(`appliesAsDebuff:true`)の % が無効化される。
  - 通常のタンクバフ・パーティ %・バリア・無敵は従来どおり効く。
  - フラグ false(既定)では全軽減が従来どおり効く(回帰)。
- **種別トグル**: クリックで damageType が 3 循環し `updateEvent` が呼ばれる(閲覧者は no-op)。
- **後方互換**: フラグ未設定の既存イベント/`appliesAsDebuff` 未設定スキルで挙動が変わらない。
- 既存テストの緑維持(既知 5 失敗のみ)。`npm run build`(tsc 厳密) + `vitest run` を push 前に必須
  (memory `feedback_vercel_tsc_strict`)。

## 9. 実装順序(目安)

1. 型追加(`Mitigation.appliesAsDebuff` / `TimelineEvent.ignoresDebuffMitigation`)。
2. mockData の 4 スキルにフラグ付与 → seed-skills-stats.ts で Firestore 同期。
3. 計算ロジック(Timeline.tsx の % ループに 1 行 + EventForm プレビュー)。テスト緑。
4. `DamageTypeIcon` 切り出し + `PcTypeToggle`(要望1)。
5. EventForm にチェックボックス(要望2 編集)。
6. 赤い小箱の印(要望2 可視化)+ i18n。実機で見た目調整。
7. collab 2 ブラウザ検証 + 軽減後ダメージ表示箇所の横断確認。

## 10. リスク・留意

- スキルデータ正本は Firestore。mockData だけ直して同期を忘れると本番で反映されない。
- 軽減後ダメージを再計算している箇所が複数あると表示不整合になりうる(§5.3 で横断確認)。
- 赤い印が 12px アイコンで埋もれる/汚く見えるリスク → 実機調整前提。
- push/deploy は本ブランチの方針に従い、まとめて 1 回(直近のコピー UI と同梱・TODO.md 参照)。
