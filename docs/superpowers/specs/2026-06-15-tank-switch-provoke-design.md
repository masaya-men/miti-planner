# タンクスイッチ機能（挑発スキル）設計書

- 日付: 2026-06-15
- ステータス: 設計確定（実装前）
- 関連: タイムライン種別/対象表示、軽減計算、collab 同期

## 1. 目的

タンクスイッチ（MT と ST の入れ替え）をタイムライン上で表現できるようにする。
手段として **「挑発（Provoke）」スキルをタンクに追加**し、挑発を置くと
**挑発より後・同じフェーズ内の攻撃の「on 対象」を MT⇄ST 反転**させる。

ユースケース: ヘイト1位に連続して来るタンクバスターを、間に挑発を挟んで
2発目を別タンクで受ける —— このとき2発目が「受けた側のタンクの軽減」で
正しく計算される必要がある。

## 2. 事実（調査済み）

- 挑発 = タンクロールアクション、Lv15 習得、**リキャスト30秒**、射程25y。
  **ダメージ・軽減効果なし**（敵対心を最上位にするだけ）。
  2タンク時はオフタンクが挑発して受け渡す＝タンクスイッチそのもの。
  出典: FFXIV Wiki / 公式ジョブガイド。
- 既存コードの事実:
  - イベントの対象は `TimelineEvent.target?: 'AoE' | 'MT' | 'ST'`（[src/types/index.ts:103](../../../src/types/index.ts#L103)）。
  - ダメージのタンク振り分けは `event.target` 1点で決まる
    （[src/components/Timeline.tsx:1841-1843](../../../src/components/Timeline.tsx#L1841-L1843)）。
    MT なら MT の軽減のみ、ST なら ST の軽減のみが計算に乗る。
  - リキャスト表示は `def.recast` と配置時刻だけで計算し **duration 非依存**
    （[src/utils/recastRow.ts:56](../../../src/utils/recastRow.ts#L56)）。
  - 軽減アイコン描画は固定 24px で **duration 非依存**
    （[src/components/Timeline.tsx:476](../../../src/components/Timeline.tsx#L476)）。
  - スキルは `useMitigations()` が **Firestore 優先 → 無ければ mockData フォールバック**
    （[src/hooks/useSkillsData.ts:22-25](../../../src/hooks/useSkillsData.ts#L22-L25)）。
    本番は Firestore を読むため、mockData 追加だけでは本番に反映されない。
  - ロールアクションは `['pld','war','drk','gnb'].map(...)` で全タンク分を生成
    （rampart/reprisal の既存パターン、[src/data/mockData.ts:743-755](../../../src/data/mockData.ts#L743-L755)）。
  - `seed-skills-stats.ts` は既定 ADDITIVE（新規 id のみ追加・既存は上書きしない、
    [scripts/seed-skills-stats.ts:6-12](../../../scripts/seed-skills-stats.ts#L6-L12)）。

## 3. 確定した方針（ユーザー承認済み）

1. **動的（derived）方式**: 元のイベントデータ（target）は書き換えない。
   挑発マーカーから「実効ターゲット」を都度計算する。挑発を消す/動かす/
   フェーズをまたぐと自動で計算し直し。元データ非破壊。
2. **単純反転トグル**: どのタンクが挑発を押しても効果は同じ（反転）。
   同一フェーズ内、あるイベントより前にある挑発の数が **奇数なら反転・偶数なら元のまま**。
   挑発1個なら「そこから後ろ全部反転」と同義。AoE は常に不変。
3. **タンク専用**: 挑発はタンクジョブにしか出ない（jobId フィルタで自動達成）。
4. **表示は素の入れ替え（案1）**: 入れ替わったら「on MT」→「on ST」をそのまま表示。
   切り替わる瞬間と、挑発を外して戻る瞬間に **アニメーション**（framer-motion、
   100〜200ms、prefers-reduced-motion 尊重）。
5. **リキャスト30秒付きの普通のスキル**: ヒールスキル等と同じく recast で
   クールダウン表示。強制ブロックはしない（既存スキルもしていない＝一貫）。
6. **挑発は「特殊な軽減スキル」として実装**: value:0 / duration:0 / recast:30 /
   `isTankSwap:true`。配置・collab同期・Undo・セレクター表示は AppliedMitigation の
   既存仕組みをそのまま流用。

## 4. データモデル

### 4.1 型の追加

`Mitigation` 型に1フラグ追加（[src/types/index.ts](../../../src/types/index.ts)）:

```ts
/** タンクスイッチ用マーカー（挑発）。軽減効果は持たず、
 *  これ以降・同一フェーズ内のイベントの MT⇄ST を反転させる。 */
isTankSwap?: boolean;
```

> 既存の Mitigation フラグ（軽減/バリア/ヒール/デバフ/スタック）はすべて
> 「ダメージ・回復への作用」であり、対象を入れ替える概念は存在しない。
> よって `isTankSwap` が本機能で**唯一の新規概念**。他はすべて既存の再利用。

### 4.2 挑発スキル定義（mockData.ts、ロールアクション節に追記）

```ts
// Provoke (Tanks) — タンクスイッチ用マーカー（軽減効果なし）
...['pld', 'war', 'drk', 'gnb'].map(job => ({
    id: `provoke_${job}`, jobId: job,
    name: { ja: "挑発", en: "Provoke", zh: "挑衅", ko: "도발" },
    icon: "/icons/Provoke.png",
    recast: 30, duration: 0, type: "all" as const, value: 0,
    isShield: false, scope: "self" as const, minLevel: 15,
    isTankSwap: true, family: "role_action"
})),
```

- `duration: 0` のため軽減計算フィルタ（`m.time <= event.time < m.time + duration`）に
  **絶対に入らない** = 誤って軽減として数えられない。
- value:0 の非軽減スキルは既存（オーロラ/ボーライド）なので前例あり。
- 多言語名は実装時に公式ジョブガイド（中/韓）で最終確認する
  （memory `reference_ff14_jobguide_urls`）。

### 4.3 表示順（MITIGATION_DISPLAY_ORDER）

`provoke_*` をタンクのロールアクション付近に追加（rampart/reprisal の近く）。
セレクターでの並び順のため。

## 5. 実効ターゲットの計算（中核ロジック）

### 5.1 共通純粋関数（新規 util）

`src/utils/effectiveTarget.ts`（新規）:

```ts
import type { TimelineEvent, AppliedMitigation, Phase, Mitigation } from '../types';

/**
 * 挑発（isTankSwap マーカー）を考慮した「実効ターゲット」を返す純粋関数。
 * - target が MT/ST 以外（AoE 等）はそのまま返す（不変）。
 * - 挑発が1個も無ければ必ず元の target を返す = 既存挙動と完全一致。
 * - 同一フェーズ内・当該イベントより前（time 厳密に小さい）にある挑発の数が
 *   奇数なら MT⇄ST 反転、偶数なら元のまま。
 * - フェーズをまたいだ挑発は影響しない（各フェーズ頭で素に戻る）。
 */
export function getEffectiveTarget(
    event: TimelineEvent,
    swapMarkers: AppliedMitigation[],  // isTankSwap のものだけ（事前フィルタ）
    phases: Phase[],
): 'AoE' | 'MT' | 'ST' | undefined;
```

- フェーズ判定: イベント time が属する Phase（`startTime <= time < endTime`）。
  同じ Phase に属する挑発のみを数える。
- 「より前」の定義: **`marker.time < event.time`（厳密に小さい）**。
  同時刻（同秒）の挑発はそのイベントには効かない（その瞬間の攻撃は旧タンクが受けた、
  という解釈。エッジケースの確定仕様）。
- どの挑発も ownerId を問わず一律にカウント（単純反転）。
- 呼び出し側は `swapMarkers = timelineMitigations.filter(m => defOf(m).isTankSwap)` を
  渡す。判定は def の `isTankSwap` フラグで行う（id 文字列に依存しない）。

### 5.2 ヘルパー（一覧から実効ターゲットを引く）

各計算サイトで毎回フィルタしないよう、`buildEffectiveTargetMap(events, swapMarkers, phases)`
で `Map<eventId, effectiveTarget>` を1回作って配るユーティリティも用意する
（メモ化前提・軽量）。

## 6. 適用箇所（event.target を読むダメージ計算/表示すべて）

ダメージ計算が複数箇所に重複しているため、**すべてで実効ターゲットを使う**。
ここを漏らすと表示と計算が食い違う（既存機能破壊と同等の事故）。

| 箇所 | 内容 | 対応 |
|---|---|---|
| [Timeline.tsx:1841](../../../src/components/Timeline.tsx#L1841) | PC ダメージ計算（target → displayContext/affectedContexts） | `event.target` を実効ターゲットに差し替え |
| [TimelineRow.tsx PcTargetToggle](../../../src/components/TimelineRow.tsx#L164) | PC「on MT/ST」表示 + クリックトグル | 表示は実効ターゲット。クリックは従来どおり**元 target を編集**（base+overlay） |
| [TimelineRow.tsx MobileTargetBadge](../../../src/components/TimelineRow.tsx#L76) | スマホ対象バッジ | 実効ターゲット |
| [TimelineRow.tsx 致死判定](../../../src/components/TimelineRow.tsx#L576) | どのメンバーの HP と比較するか | 実効ターゲット |
| MobileTimelineRow.tsx | スマホのダメージ計算/表示 | 実効ターゲット |
| CheatSheetView.tsx | チートシートの計算/表示 | 実効ターゲット |
| PipView.tsx / pipViewLogic.ts | PiP の表示/計算 | 実効ターゲット |

> 重複計算自体の一本化（大リファクタ）は本タスクの範囲外。
> 既存の各計算サイトに「`event.target` を読む箇所を実効ターゲットへ差し替える」
> 最小限の外科的変更に留める（既存機能破壊リスクを最小化）。

## 7. 表示・アニメーション

- 表示は実効ターゲット（案1：素の MT/ST、特別な印は付けない）。
- 対象アイコン（ジョブアイコン or MT=シアン/ST=アンバーのバッジ）が
  挑発で切り替わる瞬間・挑発除去で戻る瞬間に **framer-motion でアニメ**。
  - 例: 旧アイコンが小さく退場 → 新アイコンが入場（fade + scale or flip）。
  - 100〜200ms、`prefers-reduced-motion` 時はアニメ無効（即切替）。
  - マウス追従ではない離散変化なので「マウス追従UI禁止」規約に抵触しない。
- 挑発マーカー自体は他の軽減と同じ固定 24px アイコンで表示（duration:0 でも潰れない）。

## 8. 手動トグルとの整合（base + overlay モデル）

- **元 target（データ・クリックで編集可）＋ 挑発（生きてる間だけのオーバーレイ）
  ＝ 実効 target（表示）**。ステータスの「素の値＋バフ＝実効値」と同型。
- クリックトグル（[TimelineRow.tsx:177](../../../src/components/TimelineRow.tsx#L177)）は
  従来どおり **元 target を編集**。表示は実効値なので「クリック＝見えている値を反転」
  となり直感的。両者は役割が違うため**両方残す**（クリック=本来担当の修正、
  挑発=スイッチ）。既存挙動を壊さない。

## 9. オートプランナー / collab / 永続化

- **オートプランナー**: 自動配置対象から `isTankSwap` を**除外**（手動専用）。
  [src/utils/autoPlanner.ts](../../../src/utils/autoPlanner.ts) で挑発を候補から外す。
- **collab**: 挑発は `AppliedMitigation` なので既存の timelineMitigations 同期に
  そのまま乗る（追加配線なし）。duration:0 が round-trip で壊れないことを確認。
- **永続化/圧縮/共有URL**: AppliedMitigation の既存経路をそのまま使う。

## 10. ずれ防止（Firestore / アイコン）— 必須手順

1. mockData.ts に `provoke_*` を追加 + DISPLAY_ORDER に追加。
2. `npx tsx scripts/seed-skills-stats.ts`（ADDITIVE）で Firestore に新規 id を追加。
   → 本番（Firestore 読み込み）に挑発が出る。既存編集は無傷。
3. `Provoke.png` を icons ソースへ配置し `scripts/seed-icons.ts` で
   Firebase Storage にアップロード（/icons/* は本番で Storage に rewrite される）。
   memory `feedback_icon_firebase_upload`。
4. 上記を怠ると「ローカルでは出るが本番で出ない/アイコン欠け」のずれが起きる。

## 11. テスト方針（TDD）

- `getEffectiveTarget` 純粋関数の単体テスト（最重要）:
  - 挑発0個 → 元 target そのまま（既存一致）。
  - 挑発1個（前） → 反転。
  - 挑発2個（前） → 元に戻る。
  - 別フェーズの挑発 → 影響なし。
  - 同時刻の挑発 → 影響なし（厳密 `<`）。
  - AoE → 常に不変。
- 連続タンクバスター + 間に挑発のシナリオで、2発目が ST の軽減で計算される
  ことを計算サイト（Timeline）レベルで検証。
- 既存テスト（damage 計算・collab・autoPlanner）が緑のままであること（非破壊確認）。

## 12. 既存機能破壊の防止（チェックリスト）

- 挑発0個のとき `getEffectiveTarget` が常に元 target を返す（恒等）。
- duration:0 が軽減計算フィルタに入らない（軽減値として混入しない）。
- recast 表示は既存スキルと同経路（特別扱いなし）。
- 手動クリックトグルの既存挙動を変えない（元 target 編集のまま）。
- push 前に `npm run build` + `vitest run`（memory `feedback_vercel_tsc_strict`）。

## 13. 未確定・実装フェーズで確認する事項

- `family: "role_action"` でのジョブ変更マイグレーション挙動
  （rampart/reprisal と family 重複時に `provoke_pld → provoke_war` が正しく
  写るか）を実装前に検証。問題があれば family の扱いを調整。
- MobileTimelineRow / CheatSheetView / pipViewLogic の正確な差し替え箇所の特定。
- セレクター（MitigationSelector）で挑発が意図通り表示・配置できるか。
- 多言語名（中/韓）の公式表記の最終確認。
