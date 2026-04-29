# イベント追加モーダル 軽減選択 UI 改善 設計書

**作成日**: 2026-04-29
**対象ファイル**: `src/components/EventModal.tsx` のみ
**目的**: PC 版イベント追加モーダルの軽減選択 UI を、実戦に近い形で扱えるよう改善する

---

## 1. 影響範囲（厳守）

- 触るファイルは **`src/components/EventModal.tsx` のみ**
- `mockData.ts`、`Timeline.tsx`、`MitigationSelector.tsx`、`calculator.ts` など他の一切のファイルには影響を与えない
- 既存の `scope` データ（`'self' | 'target' | 'party'`、72 件整備済）と `healingIncrease` データを **読むだけ** で全部実現可能
- スマホ側の `MobileTimelineRow` 等は別実装のため自動的に対象外

---

## 2. 改善項目（Step 1 + Step 2 を一括実装）

### 2.1 ソート順の根本見直し

**現状**: ロール（タンク/ヒーラー/DPS）→ name.ja のローカル順。ジョブごとにまとまっておらず、目的のスキルが見つけづらい。

**改善後**:
1. ロール T → H → D
2. 同ロール内では `JOBS` 配列順（タンク: PLD → WAR → DRK → GNB / ヒーラー: WHM → SCH → AST → SGE / DPS: MNK → DRG → NIN → SAM → RPR → VPR → BRD → MCH → DNC → BLM → SMN → RDM → PCT）
3. 同ジョブ内では `scope` で並べる: `party` → `self` → `target`
   - つまり「全体バフ → 自己バフ → 単体バフ」の順
4. ロールアクション（リプライザル、アドル等）はジョブをまたぐスキルなので、各ロール冒頭にまとめる
5. 重複排除（同名スキル）は既存の `uniqueMitigations` ロジックを継承

### 2.2 純粋回復スキル自動非表示

**現状**: `EXCLUDED_IDS` ハードコードリストで個別除外（`mantra`, `nature_s_minne`, `helios_conjunction`, `summon_seraph` 等）。

**改善後**:
- 自動判定ルール追加: `value === 0 && !isShield && !healingIncrease && !valueMagical && !valuePhysical` のスキルは非表示
- ハードコード `EXCLUDED_IDS` は **当面残す**（無敵スキル等の安全保険として併用）
- ただし `deployment_tactics` は `EXCLUDED_IDS` から外し、後述の「鼓舞展開 3 アイコン」として復活

### 2.3 単体バフ MT/ST 切替 UI

**対象**: `scope === 'target'` のスキル全般
- ヒーラー: 鼓舞激励の策、エウクラシアディアグノシス、ディヴァインベニゾン、星天交差、タウロコレ、ドルオコレ、ケーラコレ、ハイマ、護法、奇跡の波動、超究の備え、生命回生法、コンソレーション 等
- タンク: ハートオブコランダム、インターベンション、ザ・ブラッケストナイト、オブレーション、聖者の鬨、聖騎士の鼓舞 等

**UI 仕様**:
- アイコンを選択するとアイコン枠の **直下に「MT | ST」の小さなトグルスイッチ** が表示される
- デフォルト: **MT**
- 未選択時はトグル非表示（密度を保つ）
- `targetCannotBeSelf: true` の制約は EventModal レベルでは無視（owner 情報がないため、純粋に「誰宛か」だけ問う）

**保存形式**:
- `selectedMitigations: string[]` は現状維持
- 別 state `mitigationTargets: Record<string, 'MT' | 'ST'>` を追加し、ID をキーに対象を保持
- これにより `:burst` 等の既存サフィックス機構と干渉しない

### 2.4 鼓舞展開 3 アイコン横並び

**配置**: 学者セクション内、`adloquium` の隣あたりに 3 つ並べる。

**3 アイコンの構成**:

| 枠 | 概念 | 内部 ID | アイコン構成 | 効果 |
|----|------|---------|-------------|------|
| 1 | 素の鼓舞展開 | `deployment_tactics` | 展開戦術アイコンのみ | 鼓舞バリア値 ×1.0 |
| 2 | 秘策鼓舞展開 | `deployment_tactics:crit` | 1 枠内に「秘策（左上三角）+ 展開戦術（右下三角）」を CSS 対角線分割で融合 | 鼓舞バリア値 × CRIT_MULTIPLIER (1.60) |
| 3 | 回生秘策鼓舞展開 | `deployment_tactics:crit_protraction` | 上記融合 + 右上に生命回生法（Protraction）ミニバッジ | 鼓舞バリア値 × 1.60 × (1 + 10/100) = ×1.76 |

**3 つは排他選択**（どれか 1 個だけ ON、再クリックで OFF）。バーストの :burst パターンと同じ仕組みを応用。

**斜め融合の CSS 実装**（左上=秘策、右下=展開戦術 で対角線分割）:
- 親 `<div class="relative">` の中に 2 つの `<img>` を `absolute inset-0` で重ねる
- 1 枚目（秘策アイコン）: `clip-path: polygon(0 0, 100% 0, 0 100%)` で **左上三角** に切る
- 2 枚目（展開戦術アイコン）: `clip-path: polygon(100% 0, 100% 100%, 0 100%)` で **右下三角** に切る
- アイコン枠サイズは既存の他スキルアイコンと同等

**生命回生法バッジ**:
- 上記融合アイコンの右上隅に `absolute top-0 right-0` 配置
- 生命回生法（Protraction）アイコン (`/icons/Protraction.png`) を `w-5 h-5` rounded、ボーダー付きで表示

**MT/ST 切替**: 不要（`scope: 'party'` でパーティ全体に効くため）

### 2.5 計算ロジックの target 突合

**対象 6 番（前会話で説明済）**:

`handleCalculate` 内の各バフ集計で、新ロジックを追加：

```ts
selectedMitigations.forEach(mitId => {
  const def = MITIGATIONS.find(...);
  if (!def) return;

  // 既存: AoE 攻撃時、scope=self/target は除外
  if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;

  // 新規: target=MT/ST 時、scope=target のスキルは投げ先と一致するときだけ採用
  if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
    const assignedTarget = mitigationTargets[mitId] ?? 'MT';
    if (assignedTarget !== target) return;  // 投げ先がイベントの被対象者と違うので無効
  }

  // ...既存の value/isShield/healingIncrease 集計
});
```

**鼓舞展開バリアントの計算分岐**:

```ts
if (baseId === 'deployment_tactics') {
  const variant = mitId.split(':')[1]; // undefined | 'crit' | 'crit_protraction'
  const member = partyMembers.find(m => m.jobId === 'sch');
  const baseShield = member?.computedValues['鼓舞激励の策'] ?? 0;
  let shield = baseShield;
  if (variant === 'crit' || variant === 'crit_protraction') shield *= CRIT_MULTIPLIER;
  if (variant === 'crit_protraction') {
    const protractionDef = MITIGATIONS.find(m => m.id === 'protraction');
    shield *= (1 + (protractionDef?.healingIncrease ?? 10) / 100);
  }
  shieldTotal += Math.floor(shield * healingMultiplier);
  return; // この後の汎用シールド計算をスキップ
}
```

**定数値**:
- `CRIT_MULTIPLIER = 1.60`（`calculator.ts` の値を EventModal 内に複製定義。calculator.ts は触らないため）
- 生命回生法の倍率は `MITIGATIONS` データから動的取得（現状値: `protraction.healingIncrease = 10` → 1.10倍）。データ更新時に自動追従

---

## 3. UI スケッチ

```
┌──────────────────────────────────────────────────┐
│ 使用された軽減・バリア（選択）  [プレビュー全件]   │
├──────────────────────────────────────────────────┤
│ [リプ][アド][フェ][アル]  ← ロールアクション      │
│                                                  │
│ ── タンク ──                                     │
│ [PLD: 全体]  [PLD: 自己]  [PLD: 単体...]         │
│   選択中の単体には ↓                              │
│   [MT|ST]                                        │
│ [WAR: ...] [DRK: ...] [GNB: ...]                 │
│                                                  │
│ ── ヒーラー ──                                   │
│ [WHM: ...] [SCH: 鼓舞] [SCH: 展開素][展開秘策][展開秘策+回生]│
│                          ↑ 鼓舞展開 3 アイコン   │
│ [AST: ...] [SGE: ...]                            │
│                                                  │
│ ── DPS ──                                        │
│ [MNK: ...] ...                                   │
└──────────────────────────────────────────────────┘
```

---

## 4. チュートリアル影響確認

**該当ステップ**:
- `add-3-miti`: リプライザル / アドル / セイクリッドソイル を選択させる
- `create-8-miti`: リプライザル選択

**影響評価**:
- スキル ID で判定しているため、ソート順変更でも ID は不変 → **機能影響なし**
- `data-tutorial="tutorial-skill-reprisal"` 属性が該当スキルに付くため、ハイライト位置は座標変更に追従
- `visibleMitigations` セット管理も変更不要

**確認必須**:
- 3 つの対象スキル（リプライザル/アドル/セイクリッドソイル）が新ソート順でも表示され続けること
- 純粋回復除外ルールでうっかり弾かれないこと（リプライザル: `value: 10`、アドル: `value: 5/10`、セイクリッドソイル: `isShield: true` → 全部問題なし）

---

## 5. 既知の制限・将来課題

**今回スコープ外**（次セッション以降の Step 3 として TODO に積む）:
- パーティメンバー個別 (H1/H2/D1-D4) の target 指定
- 鼓舞インスタンス選択 UI（どの鼓舞をコピー対象に展開するか）
- Timeline と同じ owner/targetId モデル統合
- `targetCannotBeSelf` 制約の UI 表示

**生命回生法の倍率値**: 確定済（`protraction` の `healingIncrease: 10` を動的参照、現状 ×1.10）

---

## 6. 実装ステップ

1. ソート順関数 `getSortPriority` を全面書き換え（ロール → ジョブ順 → scope 順）
2. `uniqueMitigations` の `EXCLUDED_IDS` から `deployment_tactics` を除去 + 純粋回復ルール追加
3. `mitigationTargets` state 追加 + MT/ST トグル UI 実装
4. 鼓舞展開 3 アイコンの仮想 ID と描画コンポーネント実装（CSS 斜め融合 + バッジ）
5. `handleCalculate` に target 突合ロジック追加
6. `handleCalculate` に鼓舞展開バリアント分岐追加
7. チュートリアル動作テスト + 既存スナップショットテスト確認
8. build + vitest run

---

## 7. 検証項目

- [ ] スキル一覧がロール → ジョブ順で並び、目的のスキルが見つけやすい
- [ ] 純粋回復スキルが消えていて、ヒール量アップ持ちスキルは残る
- [ ] 単体バフ選択時に MT|ST トグルが下に出る
- [ ] target=MT のイベントで ST 宛コランダムを選んでも計算に反映されない
- [ ] target=MT で MT 宛コランダムは正しく反映
- [ ] target=AoE で単体バフは無効（既存挙動維持）
- [ ] 鼓舞展開 3 アイコンが斜め融合 + バッジで描画される
- [ ] 鼓舞展開のシールド値: 素 < 秘策 < 秘策+回生 で増えている
- [ ] チュートリアル「リプライザル選択」「アドル+セイクリッドソイル選択」が動作する
- [ ] build + vitest 244 PASS
