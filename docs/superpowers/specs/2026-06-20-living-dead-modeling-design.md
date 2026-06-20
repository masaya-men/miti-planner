# リビングデッド (Living Dead / DRK) 正確モデル化 — 設計書

- 日付: 2026-06-20
- 状態: 設計合意済み (ユーザー承認待ち → writing-plans へ)
- 関連: `docs/.private/2026-06-20-skill-modeling-notes.md` (仕様控え・本書が確定版), TODO.md「バグ・不具合 > ユーザー投下 2026-06-20 ①」

---

## 1. 背景と目的

### 現状
リビングデッド (`living_dead` / 暗黒騎士) は、他の無敵スキル 3 種 (インビンシブル `hallowed_ground` / ホルムギャング `holmgang` / ボーライド `superbolide`) と**完全に同一**に扱われている。すなわち `isInvincible: true` フラグ 1 つで「効果時間 10 秒の間、対象が受ける全イベントのダメージを 0 にする (＝丸ごと無敵)」。

- 型: `src/types/index.ts:51` `isInvincible?: boolean;`
- データ: `src/data/mockData.ts:315` `living_dead ... isInvincible: true`
- 計算: `src/components/Timeline.tsx:1959` / `src/components/CheatSheetView.tsx:95` で「無敵が有効なら `currentDamage=0` にして以降の軽減・バリア計算を短絡」

### 実際のゲーム仕様 (公式 Job Guide 確認済み)
- **リビングデッド**: リキャスト 300s、効果時間 **10 秒**。この 10 秒は無敵ではない。普通にダメージを受ける。HP が 0 になる被弾をした瞬間だけ、戦闘不能にならず HP1 で生存し「ウォーキングデッド」へ移行する。
- **ウォーキングデッド**: 効果時間 **10 秒**。ほとんどの攻撃で HP が 1 未満にならない (＝この 10 秒が実質「死なない窓」)。ただし 10 秒以内に最大 HP 相当の回復を受けないと時間切れで戦闘不能。

### このプロジェクトでやること (ユーザー合意)
現状の「丸ごと 10 秒無敵」を、実仕様に沿った**二段階モデル**へ置き換える。
**回復要否 (最大 HP 相当の回復が間に合うか) はモデル化しない**。「死なない窓」だけを正確に表現し、ヒラ回復は前提として扱う。

---

## 2. ゴール / 非ゴール

### ゴール
- リビデを「リビデ窓内で最初に致死になる被弾を起点に、そこからウォーキングデッド 10 秒だけ生存」として計算する。
- リビデ窓内でも**致死でない被弾は通常どおりダメージを表示**する (現状の「窓内一律 Invuln」を廃止)。
- タイムライン上で、ウォーキングデッド発動時点から**白黒のリビングデッドアイコン**を効果時間バー付きで表示する (既存のアーサリースター→巨星と同じ仮想アイテム方式)。
- 他の無敵 3 種 (インビンシブル / ホルムギャング / ボーライド) の挙動は**一切変えない**。

### 非ゴール
- ウォーキングデッド中の「最大 HP 相当の回復が間に合うか」の判定 (回復モデル化しない)。
- HP の経時追跡 (残 HP のシミュレーション) の導入。既存のイベント単位の致死判定 (`軽減後ダメ ≥ 対象 maxHp`) をそのまま使う。
- ダメージ列の文言変更。表示ラベルは現状の `timeline.invuln`「無敵 / Invuln」を据え置く (i18n キー追加なし)。
- 他の無敵スキルの仕様変更、複数無敵の優先度ルールの新設。

---

## 3. 計算モデル (A)

### 用語
- `t` = リビデ配置時刻、リビデ窓 `W1 = [t, t + duration)` (duration=10)。
- `tT` = 引き金時刻 = W1 内で「**リビデの無敵効果を除いた**軽減後ダメージ」が初めて対象の最大 HP 以上になるイベントの時刻。
- `WD` = ウォーキングデッド効果時間 (=10、§5 のデータフィールド `walkingDeadDuration` から取得)。
- ウォーキングデッド窓 `W2 = [tT, tT + WD)`。

### 判定順序 (案 A: 致死判定を先行)
現状は「無敵フラグ → 即 `currentDamage=0`」が先に走り、致死判定 (`mitigated ≥ maxHp`) が常に false になる (`Timeline.tsx:1959-1964`, `TimelineRow.tsx:621`)。これを次の順序に組み替える:

イベントを**時刻順**に走査 (既存の `sortedEvents`。`Timeline.tsx:1881` / `CheatSheetView.tsx:52`) し、各イベントについて:

1. **リビデの無敵を除いた軽減後ダメージ**を計算する (他の軽減・バリア・他の無敵はこれまでどおり適用する)。
2. そのイベントを覆うリビデ (`ld.time ≤ event.time < ld.time + ld.duration`) があり、**まだ引き金が立っていない**場合:
   - 手順 1 の値 ≥ 対象 maxHp (かつ damage>0) なら → このイベントが引き金。`tT = event.time` を記録し、**このイベントは生存**扱い (`DamageInfo.isInvincible = true`、表示ダメージ 0、バリア計算スキップ)。
   - 致死でなければ → **通常の軽減後ダメージ**を表示 (生存扱いにしない)。
3. リビデの引き金が立っていて `event.time < tT + WD` (＝ W2 内) なら → **生存**扱い (`isInvincible = true`)。
4. `event.time ≥ tT + WD` (ウォーキングデッド切れ) 以降は通常ダメージ。
5. W1 内に致死イベントが 1 つも無ければ、そのリビデは**何もしない** (どのイベントも生存扱いにしない)。

> 注: 「生存」扱いのイベントは、現状の無敵と同じく `DamageInfo.isInvincible = true` を立てるだけ。表示側 (§4) は無改修でそのまま「Invuln」を出す。

### 対象 maxHp の解決 (既存ロジック流用)
`getEffectiveTarget(event, swapMarkers, phases)` (`src/utils/effectiveTarget.ts:22`) で実効ターゲット (タンクスワップ後の MT↔ST 反転を含む) を求め、

```
maxHp = (effTarget === 'MT' || effTarget === 'ST')
  ? partyMembers.find(m => m.id === effTarget)?.stats.hp || 1
  : partyMembers.find(m => m.id === 'H1')?.stats.hp || 1
```

(現行 `CheatSheetView.tsx:221-224` / `TimelineRow.tsx:617-620` / `MobileTimelineRow.tsx:161-164` と同一。`|| 1` フォールバックも踏襲。)

### tT を 1 箇所で計算し共有する (重複防止)
ダメージ計算は **Timeline.tsx** と **CheatSheetView.tsx** に独立して 2 本ある (`Timeline.tsx:1879-2168` / `CheatSheetView.tsx:50-199`)。さらにタイムラインの白黒アイコン描画 (§4) も `tT` を必要とする。`tT` を別々に計算すると**表とタイムラインで挙動がズレる**ため、リビデの引き金検出を**単一の責務に集約**する。

- 新規ユーティリティ (例: `src/utils/livingDead.ts`) に、配置済みリビデごとの引き金を求める純粋関数を置く。出力イメージ:
  ```
  computeLivingDeadWindows(events, mitigations, partyMembers, phases, MITIGATIONS)
    → Map<ldInstanceId, { ownerId, start: number, triggerTime: number | null, walkingDeadEnd: number | null }>
  ```
- これを Timeline / CheatSheetView 両方のダメージ計算と、Timeline の仮想アイテム生成が**共通利用**する。
- 「リビデを除いた軽減後ダメージ」を求める部分は、既存のダメージ計算ロジックと**同一の結果**を返さなければならない。実装手段 (既存インライン計算を共有関数へ抽出して呼び出す / 各 damageMap のループ内で状態機械として算出する) は writing-plans で確定する。
- **制約 (厳守)**: 表 (CheatSheetView)・タイムライン (Timeline)・白黒アイコンの 3 者で、同一プランに対する生存判定が**完全に一致**すること。共有計算へ抽出する場合は実行時総点検を行う (§8 リスク参照)。

### autoPlanner の扱い (スコープ判断)
`src/utils/autoPlanner.ts:117` の `simDamage` も無敵で `return 0`、`:536` でスコア加点 (+300) する独立ロジックを持つ。autoPlanner は「軽減の自動配置を**提案**する」用途で、表示ダメージの正本ではない。本タスクでは autoPlanner の simDamage は**現状維持** (リビデを保守的に「全生存」とみなしたスコアリングのまま) とする。理由: ユーザーが見るダメージは表/タイムラインで正確化されること、autoPlanner は無敵スキルを基本的に自動配置対象にしないこと。autoPlanner のリビデ精緻化は**任意のフォローアップ**として記録 (本書 §9)。

---

## 4. 表示モデル (B)

### ダメージ列 (表 / タイムライン / モバイル) — 無改修
生存イベントは §3 で `DamageInfo.isInvincible = true` が条件付きで立つ。表示側は既存のまま:
- `CheatSheetView.tsx:336` … `isInvincible ? t('timeline.invuln') : 数値`
- `TimelineRow.tsx:627` / `MobileTimelineRow.tsx:314` … 同様に Invuln 表示
- ラベル文言・i18n キーは**変更しない**。

→ 引き金前の非致死イベントは `isInvincible=false` なので通常ダメージが出る。W2 内のイベントは `isInvincible=true` なので Invuln が出る。**表示コードの改修は不要**。

### タイムラインの白黒アイコン (仮想アイテム) — 新規
既存の「効果時間途中で見た目が変わるスキル」= アーサリースター→巨星 / ホロスコープ→ヘリオス の**仮想アイテム方式**を流用する (`Timeline.tsx:3152-3192` の `displayItems` 生成、`:3320-3334` の親バー切り詰め、`MitigationItem` の `isVirtual`/`iconOverride` props)。

リビデ向けに追加する挙動:
1. **引き金がある場合のみ** (`triggerTime !== null`)、`tT` に仮想アイテムを 1 つ生成する:
   - `time = tT`、`duration = WD` (10。**リビデ窓 `t+10` を超えてよい** = 最大で実質 20 秒近くまで伸びる)
   - `iconOverride` = リビングデッドのアイコン (`/icons/Living_Dead.png` と同一画像)
   - 白黒化フラグを立てる (下記)。`isVirtual: true`、`parentId` = リビデの配置 id
2. **親リビデバーを `tT` で切る** (アーサリースターが `m.time+10` で `height` を切るのと同じ。`Timeline.tsx:3330-3333` に倣う)。引き金が無ければ親バーは通常どおり 10 秒フル。
3. **白黒化**は CSS フィルタで行う (新規画像アセット不要)。`MitigationItem` の `<img>` (`Timeline.tsx:529-540`) の className に、白黒フラグ時 `grayscale` (Tailwind) を加える。
   - `filter: grayscale()` は主要ブラウザ (Safari 6+ 含む) で対応済み。監査で挙がった「Safari<15.4 非対応」は `backdrop-filter` の話であり本件には当たらない。
4. **白黒フラグの渡し方**: 既存の `iconOverride` は URL 文字列なので、白黒は別フラグで渡す。`MitigationItemProps` に `grayscale?: boolean` (名称は実装時に決定) を追加し、仮想アイテム → `MitigationItem` 描画 (`Timeline.tsx:3338-3360`) で受け渡す。

> `tT` は §3 の共有ユーティリティの結果を読む。`displayItems` 生成は Timeline コンポーネント内 (`Timeline.tsx:3132-` の IIFE) にあり、同コンポーネントで先に計算される `tT`/damageMap をクロージャ参照できる。

### モバイルのタイムライン
モバイルのタイムライン描画 (`isMobileTimeline`) が仮想アイテムを描くかは実装時に確認する。最低限、ダメージ列の Invuln 表示はモバイルでも正しく出る (§4 冒頭・無改修)。白黒アイコンのモバイル対応有無は writing-plans で判断する。

---

## 5. データモデル (C) — データフィールド方式

ユーザー方針: **mockData と Firestore を常に一致させる** (スキル正本は Firestore。`feedback_skill_firestore_sync` / `feedback_content_firestore_sync`)。コード定数方式ではなく、**データフィールド方式**を採用する。

1. **型**: `src/types/index.ts` の `Mitigation` に `walkingDeadDuration?: number;` を追加 (`isInvincible` の近辺)。optional なので tsc strict (`noUnusedLocals` 等) でも既存コードに影響なし。
2. **mockData**: `src/data/mockData.ts:315` の `living_dead` に `walkingDeadDuration: 10` を追加。
3. **二段階の判定はデータ駆動**: 「`isInvincible: true` **かつ** `walkingDeadDuration` が設定されている」スキルだけを二段階モデルにする。`living_dead` という id をコードに決め打ちしない (ハードコーディング回避)。他の無敵 3 種はこのフィールドを持たないので、従来どおり無条件 Invuln。
4. **未設定時フォールバック**: フィールドが無い無敵スキルは従来挙動。Firestore 同期前で `living_dead` にフィールドが届いていない間は、リビデも従来の「丸ごと 10 秒無敵」のまま動く (＝**壊れない**)。同期完了後に二段階が有効化される。

### Firestore 同期 (デプロイ手順)
- seed (`scripts/seed-skills-stats.ts`) は既定 ADDITIVE モードで「新規 id のみ追加」。**既存 `living_dead` ドキュメントのフィールドは更新しない** (`seed-skills-stats.ts:110`)。
- したがって本番反映には、`living_dead` に `walkingDeadDuration` を**明示的に書き込む**必要がある。手段は次のいずれか (実装/デプロイ時に安全な方を選択。Claude が実行する):
  - (推奨) 管理画面または小さな targeted スクリプトで `living_dead` の 1 フィールドだけ更新 (外科的・他スキル無影響)
  - `seed --force-overwrite` (mockData が Firestore の正本ミラーである前提でのみ。全スキル上書きのため影響範囲が広い)
- 書き込み後は `dataVersion` が増え、クライアントキャッシュは自動無効化される。
- **共有/コピーは追加対応不要**: 共有プランは `AppliedMitigation` (mitigationId 参照のみ) で運ばれ、スキル定義は受信側が Firestore/mockData から解決する (`src/lib/sharePrivacy.ts` / `buildShareImportItems.ts`)。`walkingDeadDuration` の特別処理は不要。

### 管理画面 (任意)
`SkillFormModal.tsx:344` の無敵チェックボックス周辺に `walkingDeadDuration` の数値入力欄を足すかは任意。足さなくても mockData 初期値で機能する。足す場合は `update('walkingDeadDuration', n)` (`SkillFormModal.tsx:73`) で型安全に追加でき、`showCommon`/`showAdvanced` の表示判定 (`:61`) に含めるか検討する。

---

## 6. 共同編集 / 永続化

- ウォーキングデッド (仮想アイテム) は**計算結果 (派生)** であり、保存しない。
- `AppliedMitigation` に状態フィールドを**追加しない**。Yjs/Firestore へは従来どおり配置済みリビデ (id/mitigationId/time/duration/ownerId 等) のみ同期される (`src/lib/collab/yjsMitigations.ts:8`)。`isVirtual`/`parentId` が保存されない既存設計と整合。
- 再読込時は、イベント群と配置済みリビデから §3 の計算で都度復元される。→ 共同編集・共有・リロードいずれも追加対応不要。

---

## 7. エッジケースと解決方針

| ケース | 方針 |
|---|---|
| W1 内に致死イベントが無い | リビデは何もしない (生存扱いゼロ・白黒アイコンも出さない)。正しい挙動。 |
| W1 内に致死イベントが複数 | **最初**の致死を引き金 (`tT`)。以降は W2 内なら生存。ゲーム挙動 (最初に死ぬ被弾で発動) と一致。 |
| 同一オーナーがリビデを複数配置 | リキャスト 300s で実戦では稀。各リビデを**独立**に評価し、それぞれの W1 で最初の致死を引き金にする。 |
| W1 が他の無敵 (インビンシブル等) と重複 | 他の無敵が覆うイベントはそちらで damage 0 → 致死にならない → リビデの引き金にならない。整合的 (二重無敵は実戦で無い)。 |
| シールド / healingIncrease | 生存イベントは従来の無敵同様バリア計算をスキップ (`Timeline.tsx:1999` の `if (!isInvincibleForEvent)`)。非致死イベントは通常どおりバリア適用。 |
| `showPreStart` の -10 秒 | 描画座標のみのオフセットで時刻計算には不使用 (`Timeline.tsx:747,3284`)。窓/致死計算に影響なし。 |
| `hideEmptyRows` (空行圧縮) | 仮想アイテム/バーは既存の仮想アイテム処理に従う。実機で ON/OFF の表示安定性を確認 (テスト項目)。 |
| FFLogs インポートイベント | 通常の `TimelineEvent`。特別処理不要。リビデ窓内の致死被弾も同じ計算で扱える。 |
| `maxHp` 未設定/0 | 既存の `|| 1` フォールバックを踏襲 (現状と同じ挙動)。本タスクで新たな対処はしない。 |
| `PartyMember.mode` 'reborn'/'evolved' (8.0準備) | 現在 'reborn' 固定 (`mitigationResolver.ts:17,26`)。本タスクは現状の resolve 結果に対して動く。8.0 のモード切替は別タスク。 |

---

## 8. テスト戦略

ユニット (vitest) を中心に、リビデの計算を純粋関数 (`computeLivingDeadWindows` 等) に寄せて検証する。

- 引き金あり: W1 内に致死イベント → 引き金イベントと W2 内イベントが生存 (`isInvincible=true`)、引き金前の非致死イベントは通常ダメージ。
- 引き金なし: W1 内に致死イベントが無い → 生存ゼロ (全イベント通常ダメージ)、白黒アイコンを生成しない。
- 引き金が窓終盤: `tT` が `t+9` 付近 → W2 が `t+19` 付近まで伸び、リビデ窓外のイベントも生存する。
- 他の無敵 3 種の回帰: インビンシブル/ホルムギャング/ボーライドは従来どおり窓内一律 Invuln (挙動不変)。
- 表とタイムラインの一致: 同一プランで CheatSheetView と Timeline の生存判定が一致する。
- タンクスワップ: 挑発後の実効ターゲットの maxHp で致死判定される。
- 既存テストの非破壊: `RecastRow.test.tsx` (holmgang 等) / `skillModeCompatibility.test.ts` が緑のまま。
- 実機確認 (ユーザー): タイムラインで白黒アイコン + バーがウォーキングデッドとして出る / `hideEmptyRows` ON/OFF で崩れない / モバイル表示。

> push 前に `npm run build` + `vitest run` 必須 (`feedback_vercel_tsc_strict` / vitest 実行手順は `reference_vitest_*` を遵守)。

---

## 9. 改修対象まとめ (実装地点)

- **データ**: `src/types/index.ts:51` (型) / `src/data/mockData.ts:315` (living_dead)
- **計算 (共有)**: 新規 `src/utils/livingDead.ts` (引き金検出) + それを使う `src/components/Timeline.tsx:1879-2168` と `src/components/CheatSheetView.tsx:50-199`
- **表示 (新規分のみ)**: `src/components/Timeline.tsx:3152-3192` (仮想アイテム生成) / `:3320-3334` (親バー切り詰め) / `:529-540`・`MitigationItemProps` (白黒フラグ + grayscale className)
- **表示 (無改修・確認のみ)**: `TimelineRow.tsx:627` / `MobileTimelineRow.tsx:314` / `CheatSheetView.tsx:336`
- **デプロイ**: Firestore の `living_dead` に `walkingDeadDuration` を反映 (Claude が実行)
- **任意フォローアップ (本タスク対象外)**: `src/utils/autoPlanner.ts:117,536` のリビデ精緻化

### リスク
- **共有計算の改修は実行時に壊れやすい**: ダメージ計算は表/タイムラインで独立 2 本 + autoPlanner。共有関数へ抽出する場合、テスト/レビュー通過でも実機挙動 (バリア・スタック・タンクスワップ・hideEmptyRows) が崩れうる。`feedback_structural_refactor_runtime_audit` に従い、必要なら多エージェントで実機総点検する。
- **Firestore 同期忘れ**: 同期しないと本番でリビデが二段階化しない (が、旧挙動のままで壊れはしない)。デプロイ手順に同期を明記。

---

## 10. 確定した設計判断 (ユーザー合意)

1. モデル化の深さ = **(b) 生存窓を正確に**。回復要否 (c) はやらない。
2. 引き金 = **窓内で最初に致死になる被弾** (案 1)。
3. ダメージ列の文言 = **Invuln 据え置き** (i18n 変更なし)。
4. ウォーキングデッドの可視化 = **白黒リビングデッドアイコンの仮想アイテム** (アーサリースター方式)。新規画像不要 (CSS grayscale)。
5. データ表現 = **`walkingDeadDuration` データフィールド** (mockData↔Firestore 一致方針)。判定はフィールド有無で行い id 決め打ちしない。
6. 他の無敵 3 種は不変。autoPlanner 精緻化は任意フォローアップ。
