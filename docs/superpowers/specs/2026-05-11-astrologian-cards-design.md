# 占星術師カード機構 設計書

**作成日**: 2026-05-11
**対象機能**: 占星術師 (AST) のドロー/カード関連スキル 7 個を軽減シミュレータに追加

## 1. 概要と背景

### 1.1 目的

FF14 軽減シミュレータ (lopoly.app) に、 占星術師 (Astrologian / AST) のカード機構を実装する。 学者のエーテルフロー機構と類似の「ドローでカードを獲得 → カードを使うとバフ発動」 という構造を、 FF14 7.0 (2024 年 6 月リワーク) 以降の現行仕様で正確に再現する。

### 1.2 実装範囲 (7 スキル)

| 内部 ID | 表示名 (日本語) | 公式英名 | 種別 |
|---|---|---|---|
| `astral_draw` | アストラルドロー | Astral Draw | 親 (ドロー) |
| `umbral_draw` | アンブラルドロー | Umbral Draw | 親 (ドロー) |
| `the_arrow` | オシュオンの矢 | The Arrow | 子カード (Astral) |
| `the_spire` | ビエルゴの塔 | The Spire | 子カード (Astral) |
| `the_bole` | 世界樹の幹 | The Bole | 子カード (Umbral) |
| `the_ewer` | サリャクの水瓶 | The Ewer | 子カード (Umbral) |
| `lady_of_crowns` | クラウンレディ | Lady of Crowns | 子カード (Umbral) |

### 1.3 既存実装と触らない範囲

- 既存 AST スキル (`exaltation`, `neutral_sect`, `sun_sign`, `macrocosmos`, `celestial_intersection`, `horoscope`, `celestial_opposition`, `aspected_helios`, `helios_conjunction`, `earthly_star`, `collective_unconscious`) は**一切変更しない**
- The Balance / The Spear / Lord of Crowns は与ダメージバフのため**軽減シミュ対象外**として実装しない

## 2. ゲーム内仕様 (公式 Patch 7.4 準拠)

### 2.1 ドロー機構の正確な挙動

- **アストラルドローとアンブラルドローは同じボタンが交互に切り替わる** (リキャスト 55 秒、共有)
- ドロー使用で **4 枚の手札を獲得** (Astral 側: The Balance / The Arrow / The Spire / Lord of Crowns、 Umbral 側: The Spear / The Bole / The Ewer / Lady of Crowns)
- 手札は**次のドローまで保持される** (リキャストとは独立した概念)
- 次のドロー (Astral でも Umbral でも) を撃つと、 前の手札は破棄され新しい 4 枚に置き換わる
- **戦闘開始前は自然と Astral 4 枚を持った状態でスタート** (戦闘前にドローを撃つ操作は不要)
- ドローのリキャスト 55 秒は実プレイで意識する数値ではない (= 60 秒間隔で交互に使うのが標準ローテーション)

### 2.2 各カードの効果 (Lv 100)

| カード | 軽減シート観点での効果 | 効果量 | 効果時間 | 対象 |
|---|---|---|---|---|
| アストラルドロー | (マーカー - 軽減効果なし) | - | 瞬間 | 自分 |
| アンブラルドロー | (マーカー - 軽減効果なし) | - | 瞬間 | 自分 |
| オシュオンの矢 | 被回復量上昇 | +10% | 15 秒 | 単体 |
| ビエルゴの塔 | バリア | 回復力 400 相当 | 30 秒 | 単体 |
| 世界樹の幹 | 被ダメージ軽減 | -10% | 15 秒 | 単体 |
| サリャクの水瓶 | HoT (regen) | 威力 200/tick × 5 = 計 1,000 | 15 秒 | 単体 |
| クラウンレディ | 範囲回復 (即時) | 回復力 400 | 即時 | 範囲 |

## 3. アーキテクチャ設計

### 3.1 親子関係の表現方法

既存 AST 内の `neutral_sect → sun_sign` パターン (`requires` + `requiresWindow`) を踏襲する。

```
親: astral_draw / umbral_draw (recast: 55, duration: 1)
 ↓ requires
子: the_arrow / the_spire (requires: 'astral_draw')
子: the_bole / the_ewer / lady_of_crowns (requires: 'umbral_draw')
```

### 3.2 「最新ドローが対応種別か」 の専用フィルタロジック

ゲーム内仕様「手札は次のドローまで保持」 を再現するため、 既存の `requires` + `requiresWindow` の固定窓判定 (= 親の duration 内のみ子が打てる) では不十分。 親 (astral_draw) の duration は 1 秒に設定するため、 既存ロジック単体だと子は 1 秒しか使えない。

そこで sun_sign / aspected_helios と同じ位置に **AST カード専用ロジック**を 2 箇所に追加し、 既存の `requires` 標準判定の代わりに「最新のドローが対応する種別か」 を見る:

#### 3.2.1 MitigationSelector.tsx (L139-159 のフィルタ)

```typescript
// AST カード専用: 最新のドローが対応する種別かをチェック
if (m.requires === 'astral_draw' || m.requires === 'umbral_draw') {
    const drawsBeforeNow = activeMitigations
        .filter(am => am.mitigationId === 'astral_draw' || am.mitigationId === 'umbral_draw')
        .filter(am => am.time <= selectedTime)
        .sort((a, b) => b.time - a.time);  // 新しい順
    if (drawsBeforeNow.length === 0) return false;
    return drawsBeforeNow[0].mitigationId === m.requires;
}
```

#### 3.2.2 resourceTracker.ts (L297-332 のバリデーション)

同じロジックを `validateMitigationPlacement()` 内の `m.requires` チェック箇所にも追加 (sun_sign の AST 特例と同じ書き方)。

### 3.3 戦闘開始前ドローの表現: `autoHidden` フラグ

#### 3.3.1 課題

- AST メンバーがパーティに加わると、 t=-3 秒地点に「戦闘前 Astral Draw」 が自動配置される
- しかしシミュレータの行展開ロジック (`hasMitigationStart`) は「スキルが置かれた行を自動展開」 する仕様
- → ユーザーが意図せずタイムラインを開いたら -3 秒の行が見えてしまう

#### 3.3.2 解決策

`AppliedMitigation` 型に **`autoHidden?: boolean`** フラグを新設。
- フラグが立っているスキルは「描画から除外、 計算には含める」
- これにより t=-3 の Astral Draw はタイムライン非表示、 ただし計算ロジックでは「最新のドロー = Astral」 と認識される
- ユーザーが既存の `hideEmptyRows` トグル (展開ボタン) を OFF にすれば、 -3 秒の行と Astral Draw も表示される

```typescript
// types/index.ts
interface AppliedMitigation {
    ...
    autoHidden?: boolean; // 自動配置されたが、行展開トリガーにしない
}
```

### 3.4 自動配置プラン (astrologianAutoInsert.ts)

学者の `scholarAutoInsert.ts` を踏襲した新規ファイル。

#### 3.4.1 配置タイミング

- ① **t=-3 秒**: Astral Draw (`autoHidden: true` で配置)
- ② **t=9 秒**: Umbral Draw
- ③ **t=65 秒**: Astral Draw
- ④ 以降 **60 秒間隔**で Umbral / Astral 交互に最終イベント時刻まで
- ⑤ 既に `astral_draw` または `umbral_draw` が 1 つでも置かれていればユーザー編集尊重で**スキップ**

#### 3.4.2 配線箇所 (学者と同じ 5 箇所)

`useMitigationStore.ts` で学者向けに `buildScholarAutoInserts` が呼ばれている 5 箇所に、 AST 向けの分岐を追加:
- L327-336: マイグレーション時 (旧プラン補完)
- L420-431: オートプラン適用後
- L920-929: メンバー追加時
- L956-971: ジョブ変更時
- L1030-1038: ジョブ別復元時

判定関数 `hasAnyAstrologianDraw()` を `astrologianAutoInsert.ts` 内に新設 (学者の `hasAnyAetherflow` と同じパターン)。

## 4. データ定義

### 4.1 スキル定義 (`src/data/mockData.ts` に追加)

#### 4.1.1 アストラルドロー / アンブラルドロー (親)

```typescript
{
    id: "astral_draw", jobId: "ast",
    name: { ja: "アストラルドロー", en: "Astral Draw", zh: "星极抽卡", ko: "별빛 점지" },
    icon: "/icons/Astral_Draw.png",
    recast: 55, duration: 1, type: "all", value: 0, isShield: false,
    minLevel: 30, family: "ast_draw_astral",
    note: "アストラル4枚を獲得 (Balance/Arrow/Spire/Lord)。次のドローまで保持。"
},
{
    id: "umbral_draw", jobId: "ast",
    name: { ja: "アンブラルドロー", en: "Umbral Draw", zh: "灵极抽卡", ko: "그림자 점지" },
    icon: "/icons/Umbral_Draw.png",
    recast: 55, duration: 1, type: "all", value: 0, isShield: false,
    minLevel: 30, family: "ast_draw_umbral",
    note: "アンブラル4枚を獲得 (Spear/Bole/Ewer/Lady)。次のドローまで保持。"
}
```

#### 4.1.2 オシュオンの矢 (`the_arrow`) - クラーシス型

```typescript
{
    id: "the_arrow", jobId: "ast",
    name: { ja: "オシュオンの矢", en: "The Arrow", zh: "放浪神之箭", ko: "오쉬온의 화살" },
    icon: "/icons/The_Arrow.png",
    recast: 1, duration: 15, type: "all", value: 0, isShield: false,
    scope: "target", healingIncrease: 10,
    requires: "astral_draw",
    note: "対象の被回復+10%",
    minLevel: 30, family: "healer_ogcd_target_buff"
}
```

#### 4.1.3 ビエルゴの塔 (`the_spire`) - 単体バリア (celestial_intersection と同パターン)

```typescript
{
    id: "the_spire", jobId: "ast",
    name: { ja: "ビエルゴの塔", en: "The Spire", zh: "建筑神之塔", ko: "비레고의 탑" },
    icon: "/icons/The_Spire.png",
    recast: 1, duration: 30, type: "all", value: 0, isShield: true,
    valueType: 'potency', shieldPotency: 400, scope: "target",
    requires: "astral_draw",
    note: "バリア (回復力400相当) / 30秒",
    minLevel: 30, family: "ph_target_shield"
}
```

#### 4.1.4 世界樹の幹 (`the_bole`) - 被ダメ-10% (exaltation と同パターン)

```typescript
{
    id: "the_bole", jobId: "ast",
    name: { ja: "世界樹の幹", en: "The Bole", zh: "世界树之干", ko: "세계수의 줄기" },
    icon: "/icons/The_Bole.png",
    recast: 1, duration: 15, type: "all", value: 10, isShield: false,
    scope: "target",
    requires: "umbral_draw",
    note: "対象の被ダメージ-10%",
    minLevel: 30, family: "ph_target_miti"
}
```

#### 4.1.5 サリャクの水瓶 (`the_ewer`) - HoT (note のみ、軽減計算には乗らない)

```typescript
{
    id: "the_ewer", jobId: "ast",
    name: { ja: "サリャクの水瓶", en: "The Ewer", zh: "河流神之瓶", ko: "살리아크의 물병" },
    icon: "/icons/The_Ewer.png",
    recast: 1, duration: 15, type: "all", value: 0, isShield: false,
    scope: "target",
    requires: "umbral_draw",
    note: "対象に HoT (威力200/tick × 5)",
    minLevel: 30, family: "healer_ogcd_target_buff"
}
```

#### 4.1.6 クラウンレディ (`lady_of_crowns`) - 範囲回復 (celestial_opposition と同パターン)

```typescript
{
    id: "lady_of_crowns", jobId: "ast",
    name: { ja: "クラウンレディ", en: "Lady of Crowns", zh: "王冠之贵妇", ko: "여왕의 날개" },
    icon: "/icons/Lady_of_Crowns.png",
    recast: 1, duration: 1, type: "all", value: 0, isShield: false,
    requires: "umbral_draw",
    note: "範囲回復 (回復力400 / 即時)",
    minLevel: 30, family: "healer_ogcd_aoe_heal"
}
```

> 注: 上記の `family` 値はすべて既存類似スキル (celestial_intersection / exaltation / krasis / celestial_opposition) と同じ値を使用。 実装時に最終的な family 値は既存類似スキルとの整合を再確認する。 `i18n` 各言語名 (zh / ko) はユーザーから公式ジョブガイド (FF14 中国版 / 韓国版) より正確な訳語を提供済み (2026-05-11)。

### 4.2 表示順 (`MITIGATION_DISPLAY_ORDER` に挿入)

既存 AST スキル群の近接位置に挿入。 親 (ドロー) を先、 子 (カード) を後ろにグループ化:

```
... (既存 AST スキル群)
'astral_draw',
'umbral_draw',
'the_arrow',
'the_spire',
'the_bole',
'the_ewer',
'lady_of_crowns',
... (続く)
```

## 5. アイコン

### 5.1 ファイル配置

ユーザー提供パスから `public/icons/` へコピー:

| 提供パス | 配置先 |
|---|---|
| `C:\Users\masay\Downloads\FFXIV_icon\FFXIVIcons Battle(PvE)\20_AST\Astral_Draw.png` | `public/icons/Astral_Draw.png` |
| 同 `Umbral_Draw.png` | `public/icons/Umbral_Draw.png` |
| 同 `The_Arrow.png` | `public/icons/The_Arrow.png` |
| 同 `The_Bole.png` | `public/icons/The_Bole.png` |
| 同 `The_Ewer.png` | `public/icons/The_Ewer.png` |
| 同 `The_Spire.png` | `public/icons/The_Spire.png` |
| 同 `Lady_of_Crowns.png` | `public/icons/Lady_of_Crowns.png` |

ファイル名は既存の命名規約 (`PascalCase_With_Underscore.png`) と完全一致しているのでそのまま使用。

### 5.2 Firebase Storage アップロード (必須)

`npx tsx scripts/seed-icons.ts` を実行 → 7 個の PNG が `gs://lopoly-app/icons/*.png` にアップロードされる。
`/icons/*` rewrite で Firebase Storage が参照される (memory feedback_icon_firebase_upload.md)。

### 5.3 Firestore スキル定義同期 (必須)

`npx tsx scripts/seed-skills-stats.ts` を実行 → `/master/skills` に新スキル定義が反映され、 `dataVersion` がインクリメントされる (memory feedback_skill_firestore_sync.md)。

## 6. 影響範囲と既存機能保護

### 6.1 修正ファイル一覧 (合計 12)

| # | ファイル | 種別 | 変更量 | リスク |
|---|---|---|---|---|
| 1 | `src/types/index.ts` | 修正 | +1 行 | ⚪ 安全 (optional フィールド追加) |
| 2 | `src/components/Timeline.tsx` | 修正 | +4 行 | ⚪ 安全 (`!m.autoHidden` 条件追加のみ) |
| 3 | `src/components/MitigationSelector.tsx` | 修正 | +12 行 | ⚪ 安全 (既存 AST 特例と同パターン) |
| 4 | `src/utils/resourceTracker.ts` | 修正 | +12 行 | ⚪ 安全 (既存 AST 特例と同パターン) |
| 5 | `src/utils/astrologianAutoInsert.ts` | 新規 | +120 行 | ⚪ 安全 (scholarAutoInsert.ts のコピー改) |
| 6 | `src/store/useMitigationStore.ts` | 修正 | +30 行 | 🟡 慎重 (5 箇所配線、テスト必須) |
| 7 | `src/data/mockData.ts` | 修正 | +200 行 | ⚪ 安全 (データ追加のみ) |
| 8 | **`src/utils/calculator.ts`** (`SKILL_DATA` への追加) | 修正 | +1 行 | 🔴 **必須** (忘れるとバリア値 0 になる過去バグ再発) |
| 9 | `public/icons/` | 追加 | +7 PNG | ⚪ 安全 |
| 10 | `src/utils/__tests__/astrologianAutoInsert.test.ts` | 新規 | +新規 | ⚪ 安全 |
| 11 | `scripts/seed-icons.ts` 実行 | 運用 | - | ⚪ 安全 |
| 12 | `scripts/seed-skills-stats.ts` 実行 | 運用 | - | ⚪ 安全 |

#### `SKILL_DATA` への追加 (calculator.ts L140 の辞書)

ビエルゴの塔 (The Spire) のバリア値は `computedValues["ビエルゴの塔"]` から取得されるため、 既存類似スキル「星天交差」 (Celestial Intersection) と同じ形式で 1 行追加する:

```typescript
// src/utils/calculator.ts SKILL_DATA に追加
"ビエルゴの塔": { "potency": 400, "type": "potency", "multiplier": 1, "jobs": ["ast"], "icon": "The_Spire.png", "nameEn": "The Spire", "minLevel": 30 },
```

> **過去バグの真因**: 新規シールドスキルを追加した際にこの `SKILL_DATA` 追加を忘れると、 `computedValues[jaName] = undefined` となりバリア値が 0 で計算される。 mockData.ts への定義追加だけでは不十分なため、 必ず両方を更新する。 The Arrow / The Bole / The Ewer / Lady of Crowns はバリアではないので `SKILL_DATA` への追加は不要。 The Spire のみが対象。

### 6.2 既存機能を破損しないための原則

1. **`autoHidden` は新設 optional フィールド**: 既存全 mitigation インスタンス (608 テスト中の全データ) は `undefined` のまま → 既存挙動は完全維持
2. **AST 専用ロジックは既存パターンの踏襲**: sun_sign / aspected_helios の特例と同じ位置・同じ書き方 (= 既存ロジックは無傷)
3. **保存・読み込みは完全透過**: `compression.ts` / `buildShareImportItems.ts` は `JSON.stringify/parse` で透過、 autoHidden は自動的に保存・復元される
4. **計算系 (calculator / resourceTracker / autoPlanner) は autoHidden を見ない**: Astral Draw の `value: 0`, `duration: 1` で軽減計算に乗らない → 計算結果は変わらない
5. **親 duration を 1 に設定**: 「Astral アクティブ」 と長時間誤判定される箇所がなくなる → CheatSheetView の軽減アイコン余剰も発生しない
6. **既存テストへの影響**: AST スキル系のテストは新スキル追加で件数増加するが、 既存テストは全件無修正でパス予定
7. **`SKILL_DATA` への追加忘れ防止**: The Spire 実装時に必ず `calculator.ts` の `SKILL_DATA` 辞書も更新する。 過去バグの主原因のため、 実装プランで明示的なチェック項目とする
8. **healingIncrease は既存ロジックで自動適用**: The Arrow を `scope: 'target', healingIncrease: 10` で実装すれば、 calculator.ts L264-275 の既存処理が自動的に拾う。 同じ対象に対するシールド計算時に +10% が適用される (クラーシス・生命回生法と同じ動き)

### 6.3 描画箇所での autoHidden 除外 (Timeline.tsx の 4 箇所)

| 行番号 | 役割 | 修正 |
|---|---|---|
| L2234 | 高さ計算: `hasMitigationStart` 判定 | `m.time === time && !m.autoHidden` |
| L2278 | 描画: `hasMitigationStart` 判定 | `m.time === time && !m.autoHidden` |
| L2562 | バッジ描画用 `visibleMitigations` フィルタ | `(showPreStart || (m.time + m.duration > 0)) && !m.autoHidden` |
| L2264 | アイコン描画用 `mitigationsByTime` / `mitStartsByTime` 構築 | `if (!mit.autoHidden) mitStartsByTime.set(...)` および `mitigationsByTime.get(t)!.push(mit)` で除外 |

### 6.4 計算箇所での autoHidden 透過 (変更不要)

- `resourceTracker.ts` の全関数: `validateMitigationPlacement`, `getAetherflowStacks`, `getAddersgallStacks`, `getLilyStacks`, `getRemainingCharges` 等は autoHidden を参照しない → 透過
- `calculator.ts`: 透過
- `autoPlanner.ts`: 透過
- `CheatSheetView.tsx`: 透過 (親 duration 1 で実質ノイズなし)

## 7. テスト方針

### 7.1 新規テスト

- `src/utils/__tests__/astrologianAutoInsert.test.ts` (新規): 学者と同パターンで 10 件前後
  - `hasAnyAstrologianDraw()` の判定
  - `buildAstrologianAutoInserts()` の挙動 (t=-3 / 9 / 65 / 125 ... の配置タイミング)
  - 既存配置がある場合のスキップ動作
  - `autoHidden: true` が t=-3 にのみ立つこと

### 7.2 既存テストへの影響確認

- 既存 608 テスト全件パス維持
- 特に確認: `mitigationResolver.test.ts`, `useMitigationStore.boundary.test.ts`, `buildShareImportItems.test.ts`, `compression.test.ts`, `scholarAutoInsert.test.ts`

### 7.3 動作確認 (実機)

- AST メンバーをパーティに加えると Astral Draw が t=-3 に自動配置されるが、 タイムライン表示には現れない
- 9 秒地点で Umbral Draw、 65 秒地点で次の Astral Draw が表示される (= autoHidden ではない)
- セレクタを開くと、 Astral 区間中は Arrow / Spire のみ、 Umbral 区間中は Bole / Ewer / Lady of Crowns のみが表示される
- `hideEmptyRows` トグル (展開ボタン) を押すと -3 秒の Astral Draw も含めて全行表示される
- 既存 AST スキル (Neutral Sect → Sun Sign 等) の挙動は変わらない
- 既存学者・賢者・白魔の挙動は完全に変わらない
- **ビエルゴの塔のバリア値が 0 ではない**: 単体に配置して被ダメを軽減する計算結果が正しく出る (`computedValues["ビエルゴの塔"]` が `SKILL_DATA` から計算されること)
- **オシュオンの矢の被回復+10% が他のシールドに反映される**: 同じ対象に The Arrow と The Spire (or 他者の鼓舞激励の策) を重ねると、 バリア値が +10% で計算される

## 8. 実装外 (YAGNI で除外)

以下は今回の実装範囲に**含めない**:

- The Balance / The Spear / Lord of Crowns (与ダメバフ系、 軽減シミュ対象外)
- マイナーアルカナ (Minor Arcana) スキル自体 (Lord/Lady を直接得るカードとして扱う)
- ディヴィネーション (既存スキル、 別途必要なら別タスクで)
- ドロー使用時の MP 回復効果 (シミュレータの計算に影響しない)
- 「同じ Astral 区間内で Arrow を 2 回使えない」 のような 1 ドロー 1 枚制限 (実プレイで起きないため簡略化)
- スキルモード対応 (`modes.evolved`) (今回のスキルでは不要)
