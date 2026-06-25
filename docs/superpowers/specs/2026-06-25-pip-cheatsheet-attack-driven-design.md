# PiP カンペを「攻撃の全リスト基準」に変更 — 設計書

作成: 2026-06-25 / 状態: 設計確定（ユーザー承認済み）

## 背景・目的
PiP カンペ（`PipView`・PC別ウィンドウ / スマホ全画面）は現状**軽減ドリブン**で、
「選択メンバーが軽減を置いた時刻」だけを行にしている（[src/utils/pipViewLogic.ts](../../../src/utils/pipViewLogic.ts) の `computeCueItems`）。
そのため「軽減を置いていない攻撃」がカンペに出ず、戦闘全体の流れが見えない。

本変更で**攻撃ドリブン**に切り替え、カンペを「戦闘の攻撃一覧＋自分の軽減メモ」にする。
本番プレイ中に、軽減を押す瞬間だけでなく攻撃の全体の流れを目印にできるようにする。

## 現状の事実（実コードで確認済み）
- タイムラインには AA（オートアタック）イベントが含まれる。
  [generateAAEvents](../../../src/utils/fflogsMapper.ts#L541-L547) が `name: { ja: 'AA', en: 'AA' }`・target=MT/ST・damageType='physical'・guid無し で追加する。
- AA は数秒おきに大量にあるため、攻撃を全部出すなら AA は除外しないとカンペが埋もれる。
- 現状の `computeCueItems` は「軽減を置いた時刻 ∩ イベントがある時刻」だけを返す。
  - 軽減を置いた時刻にイベントが無いと、その行は落ちる（`eventsByTime` を起点に返すため）。
  - AA は特別扱いされていない（軽減を置いた時刻に AA があれば AA 名が出る）。

## 変更後の表示ルール（新 `computeCueItems`）
行 = 次の2集合を時刻順（昇順）にマージしたもの:

1. **非AA攻撃イベントがある全時刻** — 軽減の有無・メンバー選択に関係なく全部。
2. **選択メンバーの軽減が置かれた時刻**のうち、そこに非AA攻撃が無いもの（AAだけ or 何も無い時刻）。

各行（CueGroup）の中身:
- `events`: その時刻の**非AA**イベントのみ（優先度順は現状維持: AoE > 単体 > 未設定、同列 id 昇順）。空配列もありうる。
- `mitigations`: その時刻の**選択メンバー分**の軽減（現状どおり `selectedMemberIds` でフィルタ済みを受け取る）。

### AA 判定
`name.ja === 'AA' || name.en === 'AA'` を AA とみなして `events` から除外する。
- 同時刻に実攻撃 + AA がある場合: 実攻撃だけ残る（AA は events から除外。+N バッジにも数えない）。
- 実攻撃が名前として 'AA' を持つ可能性は実質ゼロ（generateAAEvents 専用名）。同名なら同様に除外で許容。

### メンバー選択の役割（変更点）
- 攻撃行は**常に全部出る**（選択に依存しない）。
- メンバー選択は「どの軽減アイコンを出すか」だけを切り替える。
- 全員未選択 → 攻撃一覧は出る・アイコンは消える・**軽減だけの行は消える**
  （集合2が空になるため自然に消滅。集合1の攻撃行だけが残る）。

## ビュー側の追従（PipView.tsx）
- **空欄行**: `events` が空の行は攻撃名欄を空にする（時刻 + 軽減アイコンのみ）。
  現状コードは `const event = events[idx]` を無条件参照しているので、`events.length === 0` のガードを追加する。
- **メモ編集**: メモは `event.id` 紐づけ（[usePipNotes](../../../src/hooks/usePipNotes.ts)）。
  攻撃イベントのある行は現状どおり編集可。空欄行は紐づけ先が無いので**編集不可**（メモ UI を出さない）。
- **+N 切替バッジ / スマホ編集モーダル**: `events.length >= 1` 前提の箇所は空配列を考慮（バッジは `events.length > 1` のときだけなので空配列では非表示=現状ロジックのままで安全だが、`event` 未定義参照を避けるガードは必要）。
- **空状態メッセージ**: 現状 `t('timeline.pip_no_mitigations')`（「軽減がありません」系）。
  新方式では「攻撃が1件も無い時」だけ空になるため、文言を「表示する攻撃がありません」系へ変更する（4言語）。
  i18n キーは既存 `pip_no_mitigations` を流用せず新キー（例 `timeline.pip_no_events`）を追加し、ja/en/ko/zh を入れる（ko/zh は ja コピー可）。

## データフロー
```
useMitigationStore: timelineEvents, timelineMitigations, partyMembers, myMemberId
  → filterCheatSheetMitigations(timelineMitigations)        // 非表示軽減を除外（現状どおり）
  → computeCueItems(timelineEvents, filteredMitigations, selectedMemberIds)  // ★新ロジック
  → hydrate（mitigationId → definition 解決）               // 現状どおり
  → PipView 描画（空欄行・空状態文言を追従）                 // ★追従
```

## 影響範囲 / 非対象
- 変更: `src/utils/pipViewLogic.ts`（`computeCueItems` 本体）
- 追従: `src/components/PipView.tsx`（空欄行ガード・空状態文言）、`src/__tests__/pipViewLogic.test.ts`（テスト書き換え）、i18n（新空状態キー）
- **非対象**: メインの Timeline 表示、ダメージ計算（damageMap）、`fflogsMapper`（AA 生成ロジックは触らない）
  - `computeCueItems` の利用箇所は `PipView.tsx` とその単体テストのみ（確認済み）。他コンポーネントへの波及なし。

## テスト方針（TDD）
新 `computeCueItems` の単体テスト（既存テストを置き換え）:
1. 非AA攻撃が全て行になる（軽減ゼロでも）。
2. AA だけの時刻は行にならない（軽減も無いとき）。
3. AA だけの時刻に選択メンバーの軽減がある → 空欄行として出る。
4. 何も無い時刻に選択メンバーの軽減がある → 空欄行として出る。
5. 実攻撃 + AA が同時刻 → 実攻撃だけ events に残る（AA 除外）。
6. メンバー選択は攻撃行に影響しない・軽減アイコンのみ絞る。全員未選択 → 攻撃行のみ・軽減だけの行は消える。
7. 時刻昇順ソート / 同時刻イベントの優先度順（現状仕様維持）。
8. 非選択メンバーの軽減はアイコンに出ない（現状仕様維持）。

ビュー側は実機確認（PC PiP・スマホ全画面の両方で空欄行・空状態・メモ編集可否）。

## 実機検証
- 攻撃を全部出す（軽減未配置の攻撃も見える）。
- AA が行として出ない。
- AA / 空時刻に置いた軽減が空欄行で出る。
- メンバー絞りでアイコンだけ変わり、攻撃行は不変。
- スマホ全画面でも同様。
