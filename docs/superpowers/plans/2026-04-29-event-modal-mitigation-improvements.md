# イベント追加モーダル 軽減選択 UI 改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC 版イベント追加モーダルの軽減選択 UI を、ジョブ順ソート・純粋回復除外・MT/ST 切替・鼓舞展開 3 状態の各機能で実戦に近い形に改善する

**Architecture:** 全変更を `src/components/EventModal.tsx` 1 ファイル内に閉じる。既存の `MITIGATIONS` データ（`scope`, `healingIncrease`）を読むだけで実現し、`mockData.ts`/`Timeline.tsx`/`calculator.ts`/`MitigationSelector.tsx` 等の他ファイルには **一切変更を加えない**。新規 state `mitigationTargets` を追加して MT/ST 振り分けを保持、鼓舞展開は `:crit` `:crit_protraction` サフィックスの仮想 ID で扱う。

**Tech Stack:** React + TypeScript + Tailwind CSS + Vite + vitest

**設計書:** `docs/superpowers/specs/2026-04-29-event-modal-mitigation-improvements-design.md`

**最重要制約:** EventModal.tsx 以外のファイルを **絶対に変更しない**。`selectedMitigations` はダメージ計算プレビュー用で保存データには含まれないため (`handleSubmit` は `name/time/damageType/damageAmount/target` のみ送信)、計算結果の変更は他コンポーネントに影響しない。既存テスト 244 件は全て PASS を維持する。

---

## File Structure

唯一の編集対象:
- **Modify:** `src/components/EventModal.tsx`
  - `getSortPriority`/`uniqueMitigations`/`sortedMitigations` 周辺（170-232 行付近）
  - `EXCLUDED_IDS` 定義（198-202 行）
  - `handleCalculate` 内のフィルタと加算ロジック（235-323 行付近）
  - `selectedMitigations` state 隣に `mitigationTargets` state 追加（138 行付近）
  - 軽減アイコングリッド描画部（716-765 行付近）

絶対に触らないファイル: `mockData.ts`, `Timeline.tsx`, `calculator.ts`, `MitigationSelector.tsx`, `useMitigationStore.ts`, `useTutorialStore.ts`, その他全て。

---

## Task 1: ソート順をロール→ジョブ→scope順に書き換え

**Files:**
- Modify: `src/components/EventModal.tsx:171-232`

**ねらい:** 表示順序の根本見直し。スキル ID は変えないのでチュートリアルや計算ロジックには無影響、見た目の並び順だけ変わる。

- [ ] **Step 1: 現状の `getSortPriority`/`TANK_AOE_IDS` 定義（171-196 行）を確認**

確認のみ。何も書かない。

- [ ] **Step 2: `getSortPriority` を 3 段階キーを返す形に書き換え**

171-196 行のうち、`TANK_AOE_IDS` 定数と `getMitigationRole` 関数は残し、`getSortPriority` を以下に置換：

```tsx
    // 3段階ソートキー: [roleOrder, jobOrder, scopeOrder]
    const getSortKey = (mit: typeof MITIGATIONS[0]): [number, number, number] => {
        const job = JOBS.find(j => j.id === mit.jobId);
        const role = job?.role || 'dps';

        // 1段目: ロール順 (tank=0, healer=1, dps=2)
        const roleOrder = role === 'tank' ? 0 : role === 'healer' ? 1 : 2;

        // 2段目: JOBS 配列での出現順（同ロール内のジョブ順）
        const jobOrder = JOBS.findIndex(j => j.id === mit.jobId);
        const safeJobOrder = jobOrder === -1 ? 999 : jobOrder;

        // 3段目: scope 順 (party=0, self=1, target=2, undefined=3)
        const scopeOrder =
            mit.scope === 'party' ? 0 :
            mit.scope === 'self' ? 1 :
            mit.scope === 'target' ? 2 : 3;

        return [roleOrder, safeJobOrder, scopeOrder];
    };
```

**注:** 既存の `getSortPriority` は使われなくなるが、削除してよい（同一ファイル内で参照箇所がなくなるため）。`TANK_AOE_IDS` も同様に削除可。`getMitigationRole` も使われていなければ削除。Grep で参照を確認してから削除すること。

- [ ] **Step 3: `sortedMitigations` を新ソートキーで並び替え**

222-232 行の `sortedMitigations` を：

```tsx
    const sortedMitigations = useMemo(() => {
        return [...uniqueMitigations].sort((a, b) => {
            const [ra, ja, sa] = getSortKey(a);
            const [rb, jb, sb] = getSortKey(b);
            if (ra !== rb) return ra - rb;
            if (ja !== jb) return ja - jb;
            if (sa !== sb) return sa - sb;
            return (a.name.ja || "").localeCompare(b.name.ja || "");
        });
    }, [uniqueMitigations, JOBS]);
```

- [ ] **Step 4: build を通す**

```bash
npm run build
```

期待: エラーなし。warnings は既存の vite reporter / CSS のみ。

- [ ] **Step 5: vitest 実行**

```bash
npx vitest run
```

期待: 244 PASS（既存テストが全て通る）。

- [ ] **Step 6: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "refactor(event-modal): 軽減ソートをロール→ジョブ→scope順に再構成"
```

---

## Task 2: 純粋回復スキル自動除外ルール追加

**Files:**
- Modify: `src/components/EventModal.tsx:198-220`

**ねらい:** healingIncrease 等の有効なバフを持たない純粋回復スキルを非表示。`EXCLUDED_IDS` ハードコードはそのまま残し、ルール除外と OR で併用する（安全保険）。

- [ ] **Step 1: `uniqueMitigations` のフィルタに「純粋回復除外ルール」を追加**

205-219 行の `uniqueMitigations` を以下に変更：

```tsx
    const isPureHealOnly = (mit: typeof MITIGATIONS[0]): boolean => {
        return (
            mit.value === 0 &&
            !mit.isShield &&
            !mit.healingIncrease &&
            mit.valueMagical === undefined &&
            mit.valuePhysical === undefined
        );
    };

    const uniqueMitigations = useMemo(() => {
        const seenNames = new Set<string>();
        return MITIGATIONS.filter(mit => {
            // Level sync filtering
            if (mit.minLevel !== undefined && currentLevel < mit.minLevel) return false;
            if (mit.maxLevel !== undefined && currentLevel > mit.maxLevel) return false;

            // Filter out excluded IDs first
            if (EXCLUDED_IDS.includes(mit.id)) return false;

            // Filter out pure-heal-only skills (no mitigation value, no shield, no heal-up buff)
            if (isPureHealOnly(mit)) return false;

            const nameEN = mit.name.en;
            if (seenNames.has(nameEN)) return false;
            seenNames.add(nameEN);
            return true;
        });
    }, [currentLevel, MITIGATIONS]);
```

- [ ] **Step 2: build + vitest 実行**

```bash
npm run build && npx vitest run
```

期待: build OK、244 PASS。

- [ ] **Step 3: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(event-modal): 純粋回復スキル自動除外ルール追加"
```

---

## Task 3: mitigationTargets state 追加 + MT/ST トグル UI

**Files:**
- Modify: `src/components/EventModal.tsx:138`（state 追加）
- Modify: `src/components/EventModal.tsx:716-765`（アイコングリッド内に MT/ST トグル追加）

**ねらい:** `scope === 'target'` のスキル選択時に、アイコン直下に MT|ST 切替トグルを表示。state は持つが計算には未反映（次タスクで反映）。

- [ ] **Step 1: state 追加**

138 行 `const [selectedMitigations, ...]` の直下に追加：

```tsx
    const [mitigationTargets, setMitigationTargets] = useState<Record<string, 'MT' | 'ST'>>({});
```

- [ ] **Step 2: target 切替ハンドラ追加**

`toggleMitigation` 関数の直後（170 行付近）に追加：

```tsx
    const setMitigationTarget = (id: string, target: 'MT' | 'ST') => {
        setMitigationTargets(prev => ({ ...prev, [id]: target }));
    };
```

- [ ] **Step 3: アイコンボタンの直下に MT/ST トグルを描画**

761 行 `</button>` の直後、`);` の直前で variant.burst 描画の閉じ括弧を確認した上で、以下を `<button>` の `</Tooltip></button>` の直後に追加：

ボタンを `<div>` でラップして、ボタンの下にトグルを置く構造に変える：

```tsx
                                                return (
                                                    <div key={variant.id} className="flex flex-col items-center gap-0.5">
                                                        <button
                                                            data-mitigation-id={variant.id}
                                                            data-tutorial={
                                                                !variant.burst && isTutorialActive && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id)
                                                                    ? 'tutorial-skill-reprisal'
                                                                    : shouldHighlight ? 'tutorial-skill-target' : undefined
                                                            }
                                                            type="button"
                                                            onClick={() => toggleMitigation(variant.id)}
                                                            className={clsx(
                                                                "relative group p-1.5 rounded-lg border transition-all flex items-center justify-center transform active:scale-95 cursor-pointer w-full",
                                                                selectedMitigations.includes(variant.id)
                                                                    ? "bg-app-text/15 border-app-text ring-1 ring-app-text/30"
                                                                    : "bg-app-surface border-app-border hover:bg-app-surface2 hover:border-app-border opacity-80 hover:opacity-100"
                                                            )}
                                                        >
                                                            <Tooltip content={getTooltipText(mit) + (variant.burst ? ` (${mit.burstDuration}s)` : '')}>
                                                                <div className="relative">
                                                                    <img src={mit.icon} alt={getPhaseName(mit.name, contentLanguage)} className="w-7 h-7 object-contain drop-shadow" />
                                                                    {variant.burst && (
                                                                        <img
                                                                            src={mit.icon}
                                                                            alt=""
                                                                            className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </Tooltip>
                                                        </button>
                                                        {/* MT/ST トグル: 単体バフ選択時のみ表示 */}
                                                        {mit.scope === 'target' && selectedMitigations.includes(variant.id) && (
                                                            <div className="flex gap-px text-[9px] font-bold rounded overflow-hidden border border-app-border" onClick={(e) => e.stopPropagation()}>
                                                                {(['MT', 'ST'] as const).map(tgt => {
                                                                    const isActive = (mitigationTargets[variant.id] ?? 'MT') === tgt;
                                                                    return (
                                                                        <button
                                                                            key={tgt}
                                                                            type="button"
                                                                            onClick={() => setMitigationTarget(variant.id, tgt)}
                                                                            className={clsx(
                                                                                "px-1.5 py-0.5 transition-colors cursor-pointer",
                                                                                isActive ? "bg-app-text text-app-bg" : "bg-app-surface text-app-text-muted hover:bg-app-surface2"
                                                                            )}
                                                                        >
                                                                            {tgt}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
```

**重要:** 既存の `data-tutorial`、`data-mitigation-id`、`Tooltip`、`drop-shadow` 等の属性は一切変更しないこと。`<button>` 自身は変更なし、外側に `<div>` を被せて MT/ST トグルを併置する。

- [ ] **Step 4: build + vitest 実行**

```bash
npm run build && npx vitest run
```

期待: build OK、244 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(event-modal): 単体バフ選択時の MT/ST トグル UI 追加"
```

---

## Task 4: 計算ロジックに MT/ST 突合を追加

**Files:**
- Modify: `src/components/EventModal.tsx:235-323`（`handleCalculate` 内）

**ねらい:** イベント target が MT/ST のとき、scope='target' の単体バフの投げ先と突合して効果反映を判定。AoE のときは既存挙動維持。

- [ ] **Step 1: healingIncrease 集計部に MT/ST 突合追加**

242-248 行の healingIncrease 集計ループ：

```tsx
        let healingMultiplier = 1;
        selectedMitigations.forEach(mitId => {
            const baseId = mitId.endsWith(':burst') ? mitId.replace(/:burst$/, '') : mitId;
            const def = MITIGATIONS.find(m => m.id === baseId);
            if (!def || !def.healingIncrease) return;
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;
            // 新規: target=MT/ST のとき、scope='target' のバフは投げ先と一致するときだけ採用
            if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
                const assignedTarget = mitigationTargets[mitId] ?? 'MT';
                if (assignedTarget !== target) return;
            }
            healingMultiplier += (def.healingIncrease / 100);
        });
```

- [ ] **Step 2: 軽減・シールド集計部に同じ MT/ST 突合追加**

250-258 行のメイン集計ループの先頭の scope 判定の直下に追加：

```tsx
        selectedMitigations.forEach(mitId => {
            const isBurst = mitId.endsWith(':burst');
            const baseId = isBurst ? mitId.replace(/:burst$/, '') : mitId;
            const def = MITIGATIONS.find(m => m.id === baseId);
            if (!def) return;

            // Scope filtering: AoE attacks only use party-wide mitigations
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;

            // 新規: target=MT/ST のとき、scope='target' のバフは投げ先と一致するときだけ採用
            if ((target === 'MT' || target === 'ST') && def.scope === 'target') {
                const assignedTarget = mitigationTargets[mitId] ?? 'MT';
                if (assignedTarget !== target) return;
            }

            // Percentage Mitigation ... (以降既存通り)
```

- [ ] **Step 3: useEffect 依存配列に mitigationTargets 追加**

326-331 行の useEffect:

```tsx
    useEffect(() => {
        if (inputMode === 'reverse') {
            const calculated = handleCalculate();
            setDamageAmount(calculated);
        }
    }, [calcActualDamage, selectedMitigations, mitigationTargets, damageType, inputMode, target]);
```

- [ ] **Step 4: build + vitest 実行**

```bash
npm run build && npx vitest run
```

期待: build OK、244 PASS。

- [ ] **Step 5: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(event-modal): 単体バフ MT/ST 投げ先と被対象者の突合を計算に反映"
```

---

## Task 5: 鼓舞展開 EXCLUDED_IDS 除去 + 3 アイコン仮想 ID 描画

**Files:**
- Modify: `src/components/EventModal.tsx:198-202`（EXCLUDED_IDS から `deployment_tactics` を除去）
- Modify: `src/components/EventModal.tsx:718-765`（アイコングリッド内に鼓舞展開 3 バリアント描画）

**ねらい:** 展開戦術を 3 状態（素 / 秘策 / 秘策+生命回生）の仮想バリアントとして表示。アイコン融合の CSS は次タスクで詰める（このタスクでは展開戦術アイコン 3 個並ぶだけで OK）。

- [ ] **Step 1: EXCLUDED_IDS から `deployment_tactics` を削除**

198-202 行：

```tsx
    const EXCLUDED_IDS = [
        'aurora', 'thrill_of_battle', 'holmgang', 'living_dead', 'superbolide', 'hallowed_ground',
        'helios_conjunction', 'summon_seraph', 'seraphism', 'philosophia', 'macrocosmos',
        'mantra', 'nature_s_minne'
    ];
```

- [ ] **Step 2: 鼓舞展開バリアント生成ロジックを variants 配列に組み込む**

718-723 行の `flatMap` 内 `hasBurst` 判定を、`deployment_tactics` の場合に 3 バリアントを返すよう拡張：

```tsx
                                        {sortedMitigations.flatMap((mit: typeof MITIGATIONS[0]) => {
                                            const hasBurst = !!(mit.burstValue && mit.burstDuration);
                                            const isDeployTactics = mit.id === 'deployment_tactics';

                                            const variants: Array<{ id: string; burst: boolean; deployVariant?: 'plain' | 'crit' | 'crit_protraction' }> =
                                                isDeployTactics
                                                    ? [
                                                        { id: 'deployment_tactics', burst: false, deployVariant: 'plain' },
                                                        { id: 'deployment_tactics:crit', burst: false, deployVariant: 'crit' },
                                                        { id: 'deployment_tactics:crit_protraction', burst: false, deployVariant: 'crit_protraction' },
                                                    ]
                                                    : hasBurst
                                                        ? [{ id: mit.id, burst: false }, { id: `${mit.id}:burst`, burst: true }]
                                                        : [{ id: mit.id, burst: false }];

                                            return variants.map(variant => {
```

- [ ] **Step 3: 鼓舞展開バリアントの描画分岐を追加**

variant.map のループ内、既存の `<div className="relative"><img>...</div>` 部分（750-759 行付近、Tooltip の中身）を、deployVariant に応じて分岐：

ツールチップテキストは仮で：
- plain → "展開戦術"
- crit → "秘策 + 展開戦術"
- crit_protraction → "秘策 + 展開戦術 + 生命回生法"

`Tooltip` の `content` を以下に変更：

```tsx
                                                            <Tooltip content={
                                                                variant.deployVariant === 'plain' ? '展開戦術（素打ち）' :
                                                                variant.deployVariant === 'crit' ? '展開戦術 ＋ 秘策' :
                                                                variant.deployVariant === 'crit_protraction' ? '展開戦術 ＋ 秘策 ＋ 生命回生法' :
                                                                getTooltipText(mit) + (variant.burst ? ` (${mit.burstDuration}s)` : '')
                                                            }>
                                                                <div className="relative">
                                                                    {variant.deployVariant === 'plain' || variant.deployVariant === undefined ? (
                                                                        <>
                                                                            <img src={mit.icon} alt={getPhaseName(mit.name, contentLanguage)} className="w-7 h-7 object-contain drop-shadow" />
                                                                            {variant.burst && (
                                                                                <img
                                                                                    src={mit.icon}
                                                                                    alt=""
                                                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                                />
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        // 鼓舞展開バリアント (crit / crit_protraction): 一旦展開戦術アイコンだけで仮置き
                                                                        // 次タスクで秘策との斜め融合 + 生命回生バッジを実装
                                                                        <img src={mit.icon} alt="" className="w-7 h-7 object-contain drop-shadow" />
                                                                    )}
                                                                </div>
                                                            </Tooltip>
```

- [ ] **Step 4: チュートリアル分岐の保険**

`isTutorialTarget` 判定（725-733 行付近）の `mit.name.en === 'Reprisal'` などは ID 比較を保つため変更不要。鼓舞展開は対象スキルではないので影響なし。確認のみ。

- [ ] **Step 5: MT/ST トグルが鼓舞展開に出ないことを確認**

`mit.scope === 'target' && selectedMitigations.includes(variant.id)` のトグル表示条件は、鼓舞展開（`scope: 'party'`）では false になるので自動的にトグルは出ない。確認のみ。

- [ ] **Step 6: build + vitest 実行**

```bash
npm run build && npx vitest run
```

期待: build OK、244 PASS。

- [ ] **Step 7: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(event-modal): 鼓舞展開 3 バリアントを仮想 ID で表示（アイコンは仮置き）"
```

---

## Task 6: 鼓舞展開のシールド計算分岐

**Files:**
- Modify: `src/components/EventModal.tsx`（CRIT_MULTIPLIER 定数追加）
- Modify: `src/components/EventModal.tsx:280-315`（`handleCalculate` 内のシールド計算）

**ねらい:** 選択された鼓舞展開バリアントに応じて、鼓舞バリア値 × 倍率 をシールド合計に加算。

- [ ] **Step 1: CRIT_MULTIPLIER 定数を component 内 or ファイル冒頭に追加**

EventModal コンポーネントの直前（import の下、コンポーネント関数の外）に追加：

```tsx
// 鼓舞展開の秘策クリティカル倍率（calculator.ts の CRIT_MULTIPLIER と同値）
const CRIT_MULTIPLIER = 1.60;
```

- [ ] **Step 2: handleCalculate のメイン集計ループ先頭に鼓舞展開分岐を追加**

`selectedMitigations.forEach(mitId => {` の中、`if (!def) return;` の **直後**（既存の AoE/MT/ST scope フィルタの **前**）に：

```tsx
        selectedMitigations.forEach(mitId => {
            const isBurst = mitId.endsWith(':burst');
            const baseId = isBurst ? mitId.replace(/:burst$/, '') : mitId;
            const def = MITIGATIONS.find(m => m.id === baseId);
            if (!def) return;

            // 鼓舞展開バリアント分岐 (deployment_tactics / :crit / :crit_protraction)
            if (baseId === 'deployment_tactics') {
                const variant = mitId.includes(':') ? mitId.split(':')[1] : 'plain';
                const schMember = partyMembers.find(m => m.jobId === 'sch');
                const baseShield = schMember?.computedValues['鼓舞激励の策'] ?? 0;
                if (baseShield > 0) {
                    let shield = baseShield;
                    if (variant === 'crit' || variant === 'crit_protraction') {
                        shield *= CRIT_MULTIPLIER;
                    }
                    if (variant === 'crit_protraction') {
                        const protractionDef = MITIGATIONS.find(m => m.id === 'protraction');
                        const hi = protractionDef?.healingIncrease ?? 10;
                        shield *= (1 + hi / 100);
                    }
                    shieldTotal += Math.floor(shield * healingMultiplier);
                }
                return; // 通常の value/isShield 集計をスキップ
            }

            // Scope filtering: AoE attacks only use party-wide mitigations
            if (target === 'AoE' && (def.scope === 'self' || def.scope === 'target')) return;
            // ... (以降既存通り)
```

- [ ] **Step 3: build + vitest 実行**

```bash
npm run build && npx vitest run
```

期待: build OK、244 PASS。

- [ ] **Step 4: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(event-modal): 鼓舞展開バリアントのシールド倍率計算追加"
```

---

## Task 7: 鼓舞展開アイコン融合 CSS（秘策=左上三角 / 展開戦術=右下三角）+ 生命回生バッジ

**Files:**
- Modify: `src/components/EventModal.tsx`（鼓舞展開 crit / crit_protraction の `<div className="relative">` 内）

**ねらい:** Task 5 で仮置きした展開戦術アイコンを、対角線分割融合 + 生命回生バッジ付きの完成形に置き換え。

- [ ] **Step 1: 秘策 (recitation) と生命回生法 (protraction) のアイコンパスを取得**

`MITIGATIONS` から動的に取得。コンポーネント内 useMemo で：

```tsx
    // 鼓舞展開バリアント描画用のアイコンパス
    const recitationIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'recitation')?.icon ?? '',
        [MITIGATIONS]
    );
    const protractionIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'protraction')?.icon ?? '',
        [MITIGATIONS]
    );
    const deploymentIcon = useMemo(
        () => MITIGATIONS.find(m => m.id === 'deployment_tactics')?.icon ?? '',
        [MITIGATIONS]
    );
```

`uniqueMitigations` 定義の直前あたりに置く。

- [ ] **Step 2: Task 5 の仮置きを正式な融合 + バッジに置換**

Tooltip 内の `variant.deployVariant !== 'plain'` 分岐を以下に：

```tsx
                                                                    ) : (
                                                                        // 鼓舞展開バリアント: 対角線分割融合 (秘策=左上三角 / 展開戦術=右下三角)
                                                                        <div className="relative w-7 h-7">
                                                                            <img
                                                                                src={recitationIcon}
                                                                                alt=""
                                                                                className="absolute inset-0 w-7 h-7 object-contain drop-shadow"
                                                                                style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                                                                            />
                                                                            <img
                                                                                src={deploymentIcon}
                                                                                alt={getPhaseName(mit.name, contentLanguage)}
                                                                                className="absolute inset-0 w-7 h-7 object-contain drop-shadow"
                                                                                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                                                                            />
                                                                            {variant.deployVariant === 'crit_protraction' && (
                                                                                <img
                                                                                    src={protractionIcon}
                                                                                    alt=""
                                                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 object-contain rounded-sm ring-1 ring-app-bg drop-shadow"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    )}
```

**注:** CLAUDE.md の CSS ルール「`clip-path: path()` 禁止」は `path()` が対象。`polygon()` は SVG 互換性問題なし、現代ブラウザで安定動作するため使用 OK。

- [ ] **Step 3: build + vitest 実行**

```bash
npm run build && npx vitest run
```

期待: build OK、244 PASS。

- [ ] **Step 4: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(event-modal): 鼓舞展開バリアントのアイコン融合と生命回生バッジ実装"
```

---

## Task 8: 全体動作確認

**Files:** なし（実機確認のみ）

- [ ] **Step 1: dev サーバ起動して PC ブラウザで確認**

```bash
npm run dev
```

開発用 URL（http://localhost:5173 または同等）を開き、PC 解像度で：

- [ ] イベント追加モーダルを開く（PC 版）
- [ ] スキルがロール T→H→D / ジョブ順 / scope順で並んでいる
- [ ] 純粋回復スキル（ベネフィク、ケアル等）が見えない
- [ ] 鼓舞展開 3 バリアントが学者セクション内にある
  - [ ] 1 個目: 展開戦術アイコン単体
  - [ ] 2 個目: 秘策（左上三角）+ 展開戦術（右下三角）の融合アイコン
  - [ ] 3 個目: 上記 + 右上に生命回生法バッジ
- [ ] 単体バフ（鼓舞、エウクラディ、コランダム、TBN 等）を選択 → アイコン下に MT|ST トグル出現
- [ ] target=MT のイベントで MT 宛コランダム選択 → 推定ダメージにシールド反映
- [ ] target=MT のイベントで ST 宛コランダム選択 → シールド反映なし
- [ ] target=AoE のイベントで単体バフは反映なし（既存挙動維持）
- [ ] チュートリアル「リプライザル選択」「3 軽減追加」を最初から流して動作確認

- [ ] **Step 2: ユーザー実機確認依頼**

ユーザーに本番 push 前の PC ブラウザ動作確認を依頼。

- [ ] **Step 3: ユーザー OK 後、push & デプロイ**

```bash
git push
```

Vercel 自動デプロイ。

- [ ] **Step 4: TODO.md 更新**

`docs/TODO.md` の「現在の状態」セクションに今回の改善内容を追記、Step 3（パーティメンバー個別 target / 鼓舞インスタンス選択 UI）を「未着手」セクションに追加。

```bash
git add docs/TODO.md
git commit -m "docs(todo): イベントモーダル軽減 UI 改善完了とフェーズ 3 を残課題に記録"
git push
```

---

## ロールバック方針

各タスクで build/test が通らなかった場合、そのタスクの変更を `git restore` で破棄して再着手。タスク間で commit を分けているため、特定タスクだけ revert 可能。

```bash
# 直前タスクを破棄
git reset --hard HEAD~1

# 特定 commit を revert
git revert <commit-sha>
```
