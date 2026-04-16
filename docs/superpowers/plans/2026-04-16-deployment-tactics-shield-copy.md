# 展開戦術バリアコピー 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 展開戦術が独自バリアを計算するのではなく、タイムライン上のリンク先鼓舞のバリア値（バフ込み）をコピーする仕組みに変更する

**Architecture:** AppliedMitigationに`linkedMitigationId`を追加し、展開戦術をリンク先鼓舞の参照型バリアコピースキルに変更する。有効な鼓舞が1つなら自動リンク、複数なら既存のtarget選択UIパターンで選ばせる。バリア値はTimeline.tsxの計算時にリンク先鼓舞の詠唱時バフ（秘策クリ確・転化・クラーシス等）を反映して毎回算出。

**Tech Stack:** React, TypeScript, Zustand, i18next

**設計書:** `docs/superpowers/specs/2026-04-16-deployment-tactics-shield-copy-design.md`

---

### Task 1: 型定義とデータモデル変更

**Files:**
- Modify: `src/types/index.ts:65,77`
- Modify: `src/data/mockData.ts:318-319`
- Modify: `src/utils/calculator.ts:153-154`

- [ ] **Step 1: Mitigation型にcopiesShieldプロパティ追加**

`src/types/index.ts` の `targetCannotBeSelf` の行(68行目)の後に追加:

```typescript
    copiesShield?: string; // Shield copy source skill ID (e.g. 'adloquium' for deployment_tactics)
```

- [ ] **Step 2: AppliedMitigation型にlinkedMitigationIdプロパティ追加**

`src/types/index.ts` の `targetId` の行(77行目)の後に追加:

```typescript
    linkedMitigationId?: string; // ID of the linked shield instance (for copiesShield skills like deployment_tactics)
```

- [ ] **Step 3: deployment_tacticsのスキル定義を変更**

`src/data/mockData.ts` の行318-319を変更:

変更前:
```typescript
        id: "deployment_tactics", jobId: "sch", name: { ja: "展開戦術", en: "Deployment Tactics", zh: "展开战术", ko: "전개전술" }, icon: "/icons/Deployment_Tactics.png",
        recast: 120, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 540, note: "対象の鼓舞バリアをパーティにコピー", minLevel: 56, family: "bh_90_shield"
```

変更後:
```typescript
        id: "deployment_tactics", jobId: "sch", name: { ja: "展開戦術", en: "Deployment Tactics", zh: "展开战术", ko: "전개전술" }, icon: "/icons/Deployment_Tactics.png",
        recast: 120, duration: 30, type: "all", value: 0, isShield: true, copiesShield: 'adloquium', note: "対象の鼓舞バリアをパーティにコピー", minLevel: 56, family: "bh_90_shield"
```

削除: `valueType: 'potency'`, `shieldPotency: 540`
追加: `copiesShield: 'adloquium'`

- [ ] **Step 4: SKILL_DATAから不要エントリを整理**

`src/utils/calculator.ts` の行153-154を変更:

行153 "展開戦術"を削除（type: "special"で何も計算しないため不要）:
```typescript
// 削除: "展開戦術": { "jobs": ["sch"], "type": "special", "note": "鼓舞の1.6倍", ... },
```

行154 "秘策：展開戦術"を削除（動的計算に置き換えるため不要）:
```typescript
// 削除: "秘策：展開戦術": { "potency": 300, "type": "potency", "multiplier": 2.88, ... },
```

- [ ] **Step 5: ビルド確認**

```bash
rtk npm run build
```

Expected: ビルド成功（deployment_tacticsの計算は一時的に0になるが、型エラーなし）

- [ ] **Step 6: コミット**

```bash
rtk git add src/types/index.ts src/data/mockData.ts src/utils/calculator.ts && rtk git commit -m "feat: 展開戦術のデータモデル変更 — copiesShield参照型に移行"
```

---

### Task 2: リンク先バリア値計算ユーティリティ

**Files:**
- Modify: `src/utils/calculator.ts`

- [ ] **Step 1: calculateLinkedShieldValue関数を追加**

`src/utils/calculator.ts` の末尾（`calculateMemberValues` 関数の後）に追加:

```typescript
/**
 * copiesShieldスキル（展開戦術）のバリア値を、リンク先のバリアスキル（鼓舞）の
 * 詠唱時バフを考慮して計算する。
 *
 * @param linkedMit - リンク先のAppliedMitigation（鼓舞インスタンス）
 * @param allMitigations - タイムライン上の全AppliedMitigation
 * @param partyMembers - 全パーティメンバー
 * @param mitigationDefs - 全スキル定義（MITIGATIONS）
 * @returns バリア値（整数）
 */
export const calculateLinkedShieldValue = (
    linkedMit: { mitigationId: string; time: number; ownerId: string; duration: number; id: string },
    allMitigations: readonly { mitigationId: string; time: number; ownerId: string; duration: number; id: string }[],
    partyMembers: readonly { id: string; stats: StatInput; role: string; computedValues: Record<string, number> }[],
    mitigationDefs: readonly { id: string; name: { ja?: string } | string; healingIncrease?: number; healingIncreaseDuration?: number; healingIncreaseSelfOnly?: boolean; scope?: string; duration: number }[],
    currentLevel: number = 100,
): number => {
    const linkedDef = mitigationDefs.find(d => d.id === linkedMit.mitigationId);
    if (!linkedDef) return 0;

    const owner = partyMembers.find(m => m.id === linkedMit.ownerId);
    if (!owner) return 0;

    // リンク先スキルの日本語名でcomputedValuesから基本バリア値を取得
    const jaName = typeof linkedDef.name === 'string' ? linkedDef.name : (linkedDef.name.ja || '');
    let baseValue = owner.computedValues[jaName] || 0;
    if (baseValue === 0) return 0;

    // リンク先スキルの詠唱時に有効だったバフを収集
    const buffsAtCast = allMitigations.filter(b =>
        b.time <= linkedMit.time && linkedMit.time < b.time + b.duration && b.id !== linkedMit.id
    );

    // 秘策チェック: 同じ使用者の秘策が有効なら確定クリティカル
    let critMultiplier = 1;
    const recitationActive = buffsAtCast.some(b =>
        b.mitigationId === 'recitation' && b.ownerId === linkedMit.ownerId
    );
    if (recitationActive) critMultiplier = CRIT_MULTIPLIER;

    // 回復効果アップバフを集計（転化、クラーシス、フェイイルミネーション等）
    let healingMultiplier = 1;
    buffsAtCast.forEach(buff => {
        const bDef = mitigationDefs.find(d => d.id === buff.mitigationId);
        if (bDef && bDef.healingIncrease) {
            const hiDuration = bDef.healingIncreaseDuration ?? bDef.duration;
            if (linkedMit.time >= buff.time + hiDuration) return;
            // 自身のみ効果（転化等）: バフの使用者とリンク先スキルの使用者が同一の場合のみ
            if (bDef.healingIncreaseSelfOnly && buff.ownerId !== linkedMit.ownerId) return;
            healingMultiplier += (bDef.healingIncrease / 100);
        }
    });

    return Math.floor(baseValue * critMultiplier * healingMultiplier);
};
```

- [ ] **Step 2: ビルド確認**

```bash
rtk npm run build
```

Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
rtk git add src/utils/calculator.ts && rtk git commit -m "feat: calculateLinkedShieldValue — リンク先バリア値計算ユーティリティ"
```

---

### Task 3: 自動リンクロジック（Store）

**Files:**
- Modify: `src/store/useMitigationStore.ts`

- [ ] **Step 1: resolveShieldLinks関数をファイル上部のヘルパーとして追加**

`useMitigationStore.ts`のストア定義（`create`呼び出し）の前、ヘルパー関数群の近くに追加:

```typescript
/**
 * copiesShieldスキル（展開戦術等）の自動リンクを解決する。
 * - リンク先が有効ならそのまま
 * - リンク先が無効になった or リンク未設定 → 有効なコピー元が1つなら自動リンク
 * - 0個 or 2個以上 → リンク解除（ユーザー選択待ち）
 */
const resolveShieldLinks = (
    mitigations: AppliedMitigation[],
    mitigationDefs: Mitigation[],
): AppliedMitigation[] => {
    let changed = false;
    const result = mitigations.map(m => {
        const def = mitigationDefs.find(d => d.id === m.mitigationId);
        if (!def?.copiesShield) return m;

        // 現在のリンクが有効か確認
        if (m.linkedMitigationId) {
            const linked = mitigations.find(l => l.id === m.linkedMitigationId);
            if (linked && linked.mitigationId === def.copiesShield &&
                linked.time <= m.time && linked.time + linked.duration > m.time) {
                return m; // リンク有効、変更なし
            }
        }

        // 有効なコピー元を検索
        const available = mitigations.filter(l =>
            l.id !== m.id &&
            l.mitigationId === def.copiesShield &&
            l.time <= m.time &&
            l.time + l.duration > m.time
        );

        if (available.length === 1) {
            changed = true;
            return { ...m, linkedMitigationId: available[0].id };
        }

        // 0個 or 2+個: リンク解除
        if (m.linkedMitigationId) {
            changed = true;
            return { ...m, linkedMitigationId: undefined };
        }
        return m;
    });

    return changed ? result : mitigations;
};
```

- [ ] **Step 2: addMitigationでresolveShieldLinksを呼び出し**

`addMitigation` 関数（行583付近）のreturn文を修正。`[...currentMitigations, mitigation]` の後にresolveShieldLinksを適用:

変更前:
```typescript
return {
    timelineMitigations: [...currentMitigations, mitigation]
};
```

変更後:
```typescript
const newMitigations = [...currentMitigations, mitigation];
return {
    timelineMitigations: resolveShieldLinks(newMitigations, getMitigationsFromStore())
};
```

- [ ] **Step 3: removeMitigationでresolveShieldLinksを呼び出し**

`removeMitigation` 関数（行613付近）のreturn文を修正。フィルタ後にresolveShieldLinksを適用。
該当箇所は2つのreturn文があり、最後のreturn（依存スキル削除も含む）を修正:

変更前:
```typescript
return {
    timelineMitigations: state.timelineMitigations.filter(m => {
        if (m.id === id) return false;
        if (dependentIds.includes(m.mitigationId) && m.ownerId === removed.ownerId && ...) return false;
        return true;
    })
};
```

変更後（filterの結果をresolveShieldLinksに通す）:
```typescript
const filtered = state.timelineMitigations.filter(m => {
    if (m.id === id) return false;
    if (dependentIds.includes(m.mitigationId) && m.ownerId === removed.ownerId && ...) return false;
    return true;
});
return {
    timelineMitigations: resolveShieldLinks(filtered, getMitigationsFromStore())
};
```

- [ ] **Step 4: updateMitigationTimeでresolveShieldLinksを呼び出し**

`updateMitigationTime` 関数（行644付近）の最終return文を修正:

変更前:
```typescript
return { timelineMitigations: currentMitigations };
```

変更後:
```typescript
return { timelineMitigations: resolveShieldLinks(currentMitigations, getMitigationsFromStore()) };
```

- [ ] **Step 5: ビルド確認**

```bash
rtk npm run build
```

Expected: ビルド成功

- [ ] **Step 6: コミット**

```bash
rtk git add src/store/useMitigationStore.ts && rtk git commit -m "feat: resolveShieldLinks — 展開戦術の自動リンクロジック"
```

---

### Task 4: Timeline.tsxバリア計算でcopiesShieldを処理

**Files:**
- Modify: `src/components/Timeline.tsx:1526-1563`

- [ ] **Step 1: calculator.tsからインポート追加**

Timeline.tsxの既存のcalculator.tsインポート行に`calculateLinkedShieldValue`と`CRIT_MULTIPLIER`を追加:

```typescript
import { calculateLinkedShieldValue, CRIT_MULTIPLIER } from '../utils/calculator';
```

（既にcalculator.tsからインポートがあれば、そこに追記）

- [ ] **Step 2: バリア計算セクションでcopiesShield処理を追加**

Timeline.tsxのバリア計算ブロック内、`if (!def.isShield && !isConditionalShield) return;` の後（行1526付近）、スコープフィルタリングの前に以下を追加:

```typescript
        // copiesShield: リンク先バリアのコピー処理（展開戦術）
        if (def.copiesShield) {
            if (!appMit.linkedMitigationId) return; // リンクなし → バリア0、スキップ

            const linkedMit = timelineMitigations.find(l => l.id === appMit.linkedMitigationId);
            if (!linkedMit) return; // リンク先が見つからない → スキップ

            const linkedOwner = partyMembers.find(p => p.id === linkedMit.ownerId);
            if (!linkedOwner) return;

            const shieldValue = calculateLinkedShieldValue(
                linkedMit, timelineMitigations, partyMembers, MITIGATIONS
            );

            // copiesShieldはパーティ全体にコピーするため、affectedContextsの全メンバーに適用
            affectedContexts.forEach(ctx => {
                let shieldRemaining = getShieldState(ctx, appMit.id, shieldValue);
                if (shieldRemaining > 0) {
                    const absorbed = Math.min(shieldRemaining, damageForShields);
                    const finalShield = shieldRemaining - absorbed;
                    updateShieldState(ctx, appMit.id, finalShield);
                    if (ctx === displayContext) {
                        displayShieldTotal += shieldRemaining;
                        currentDamage = Math.max(0, currentDamage - absorbed);
                    }
                }
            });
            return; // 通常のバリア計算をスキップ
        }
```

- [ ] **Step 3: ビルド確認**

```bash
rtk npm run build
```

Expected: ビルド成功

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/Timeline.tsx && rtk git commit -m "feat: Timeline.tsxでcopiesShieldバリア計算 — リンク先鼓舞のバフ込み値をコピー"
```

---

### Task 5: 鼓舞選択UI + i18nキー + handleMitigationSelect統合

**Files:**
- Modify: `src/components/MitigationSelector.tsx`
- Modify: `src/components/Timeline.tsx:1334-1345`
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/zh.json`, `src/locales/ko.json`

- [ ] **Step 1: i18nキーを4言語に追加**

各ファイルの `"mitigation"` オブジェクト末尾（`"fey_illumination_seraph"` の行の後）に追加:

**ja.json:**
```json
        "select_shield": "展開する鼓舞を選択",
        "no_shield": "有効な鼓舞がありません",
        "shield_value": "バリア: {{value}}"
```

**en.json:**
```json
        "select_shield": "Select Shield to Deploy",
        "no_shield": "No active shield available",
        "shield_value": "Barrier: {{value}}"
```

**zh.json:**
```json
        "select_shield": "选择要展开的鼓舞",
        "no_shield": "没有有效的鼓舞",
        "shield_value": "屏障: {{value}}"
```

**ko.json:**
```json
        "select_shield": "전개할 고무를 선택",
        "no_shield": "유효한 고무가 없습니다",
        "shield_value": "보호막: {{value}}"
```

- [ ] **Step 2: MitigationSelector.tsxにcalculator.tsインポート追加**

```typescript
import { calculateLinkedShieldValue } from '../utils/calculator';
```

- [ ] **Step 3: MitigationSelectorのonSelect型を拡張**

`MitigationSelectorProps`インターフェース（行17）を変更:

変更前:
```typescript
    onSelect: (mitigation: Mitigation & { _targetId?: string }) => void;
```

変更後:
```typescript
    onSelect: (mitigation: Mitigation & { _targetId?: string; _linkedMitigationId?: string }) => void;
```

- [ ] **Step 4: MitigationSelectorにシールド選択状態を追加**

行38の`selectedSingleTargetMit`のstateの後に追加:

```typescript
    const [selectedCopyShieldMit, setSelectedCopyShieldMit] = React.useState<Mitigation | null>(null);
```

また、storeから`timelineMitigations`を取得するように変更（行40）:

変更前:
```typescript
    const { partyMembers, currentLevel } = useMitigationStore();
```

変更後:
```typescript
    const { partyMembers, currentLevel, timelineMitigations } = useMitigationStore();
```

- [ ] **Step 5: handleMitigationClickでcopiesShield分岐を追加**

行184の`if (mitigation.scope === 'target')`の前に、copiesShield分岐を追加:

```typescript
        // copiesShield: 展開戦術 → 有効な鼓舞を検索してUI分岐
        if (mitigation.copiesShield) {
            const availableShields = timelineMitigations.filter(l =>
                l.mitigationId === mitigation.copiesShield &&
                l.time <= selectedTime &&
                l.time + l.duration > selectedTime
            );

            if (availableShields.length === 1) {
                // 自動選択: 1つだけなら直接onSelect
                onSelect({ ...mitigation, _linkedMitigationId: availableShields[0].id });
                return;
            }

            // 0個 or 2+個: 選択UIを表示（0個でも配置は許可、バリア値0警告）
            setSelectedCopyShieldMit(mitigation);
            setTimeout(() => {
                const el = document.getElementById(`miti-btn-${mitigation.id}`);
                const container = scrollContainerRef.current;
                if (el && container) {
                    const topPos = el.offsetTop - 4;
                    container.scrollTo({ top: topPos, behavior: 'smooth' });
                }
            }, 50);
            return;
        }

        if (mitigation.scope === 'target') {
```

- [ ] **Step 6: handleShieldSelect関数を追加**

`handleTargetSelect`関数（行202-206）の後に追加:

```typescript
    const handleShieldSelect = (linkedMitigationId?: string) => {
        if (selectedCopyShieldMit) {
            onSelect({ ...selectedCopyShieldMit, _linkedMitigationId: linkedMitigationId });
        }
    };
```

- [ ] **Step 7: handleClose関数を拡張**

`handleClose`関数（行208-214）を変更:

変更前:
```typescript
    const handleClose = () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else {
            onClose();
        }
    };
```

変更後:
```typescript
    const handleClose = () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else if (selectedCopyShieldMit) {
            setSelectedCopyShieldMit(null);
        } else {
            onClose();
        }
    };
```

- [ ] **Step 8: ヘッダーにcopiesShield選択時の表示を追加**

行244の`selectedSingleTargetMit`条件分岐を拡張。`{selectedSingleTargetMit ? (` の前に `selectedCopyShieldMit` の分岐を追加:

変更前:
```typescript
                            {selectedSingleTargetMit ? (
                                <button onClick={() => setSelectedSingleTargetMit(null)} ...>
                                    <ChevronLeft ... />
                                    <span>{t('mitigation.select_target', '対象を選択')}</span>
                                </button>
                            ) : (
```

変更後:
```typescript
                            {selectedCopyShieldMit ? (
                                <button
                                    onClick={() => setSelectedCopyShieldMit(null)}
                                    className="group flex items-center gap-1 text-app-base font-black text-app-text-sec uppercase tracking-tighter leading-none hover:text-app-text transition-colors cursor-pointer text-left"
                                >
                                    <ChevronLeft
                                        size={12}
                                        className="transition-transform duration-200 group-hover:-translate-x-0.5"
                                    />
                                    <span>{t('mitigation.select_shield', '展開する鼓舞を選択')}</span>
                                </button>
                            ) : selectedSingleTargetMit ? (
                                <button onClick={() => setSelectedSingleTargetMit(null)} ...>
                                    <ChevronLeft ... />
                                    <span>{t('mitigation.select_target', '対象を選択')}</span>
                                </button>
                            ) : (
```

- [ ] **Step 9: スキルリスト内にcopiesShield選択パネルを追加**

行360-412のtarget選択パネル(`{isSelectedTargetMit && (`)の後（行413の`</React.Fragment>`の前）に、copiesShield選択パネルを追加:

```typescript
                                    {/* copiesShield: 鼓舞選択パネル */}
                                    {selectedCopyShieldMit?.id === mitigation.id && (() => {
                                        const availableShields = timelineMitigations.filter(l =>
                                            l.mitigationId === mitigation.copiesShield &&
                                            l.time <= selectedTime &&
                                            l.time + l.duration > selectedTime
                                        );
                                        return (
                                            <div
                                                className={clsx(
                                                    "w-full mt-1 mb-2 p-3 rounded-xl border-t-white/20",
                                                    "glass-panel shadow-[0_8px_30px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]",
                                                    "animate-in slide-in-from-top-2 fade-in duration-300 relative z-20"
                                                )}
                                                style={{ pointerEvents: 'auto' }}
                                            >
                                                {availableShields.length === 0 ? (
                                                    <div className="flex flex-col gap-2">
                                                        <p className="text-app-base text-amber-700 dark:text-amber-400 font-bold text-center">
                                                            {t('mitigation.no_shield', '有効な鼓舞がありません')}
                                                        </p>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleShieldSelect(undefined);
                                                            }}
                                                            className={clsx(
                                                                "w-full p-2 rounded-lg border transition-all duration-200",
                                                                "bg-app-surface2 border-app-border",
                                                                "hover:bg-app-surface2 hover:border-app-border",
                                                                "shadow-sm dark:shadow-none hover:shadow-md",
                                                                "cursor-pointer active:scale-95 hover:scale-[1.01]",
                                                                "text-app-base text-app-text-sec"
                                                            )}
                                                        >
                                                            {t('mitigation.no_shield', '有効な鼓舞がありません')}（{t('mitigation.shield_value', { value: 0 })}）
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {availableShields.map(shield => {
                                                            const shieldOwner = partyMembers.find(p => p.id === shield.ownerId);
                                                            const targetMember = shield.targetId
                                                                ? partyMembers.find(p => p.id === shield.targetId)
                                                                : shieldOwner;
                                                            const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
                                                            const barrierValue = calculateLinkedShieldValue(
                                                                shield, timelineMitigations, partyMembers, MITIGATIONS
                                                            );
                                                            return (
                                                                <button
                                                                    key={`shield-${shield.id}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleShieldSelect(shield.id);
                                                                    }}
                                                                    className={clsx(
                                                                        "flex items-center gap-3 p-2 rounded-lg border transition-all duration-200",
                                                                        "bg-app-surface2 border-app-border",
                                                                        "hover:bg-app-surface2 hover:border-app-border",
                                                                        "shadow-sm dark:shadow-none hover:shadow-md",
                                                                        "cursor-pointer active:scale-95 hover:scale-[1.01]"
                                                                    )}
                                                                >
                                                                    {targetJob ? (
                                                                        <img
                                                                            src={targetJob.icon}
                                                                            alt={targetJob.name?.en || targetJob.id}
                                                                            className="w-8 h-8 object-contain drop-shadow-md shrink-0"
                                                                        />
                                                                    ) : (
                                                                        <span className={clsx(
                                                                            "w-8 h-8 flex items-center justify-center text-app-2xl font-black tracking-tighter uppercase drop-shadow-sm shrink-0",
                                                                            targetMember?.role === 'tank' ? 'text-blue-500 dark:text-blue-400' :
                                                                            targetMember?.role === 'healer' ? 'text-green-500 dark:text-green-400' :
                                                                            'text-red-500 dark:text-red-400'
                                                                        )}>
                                                                            {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                        </span>
                                                                    )}
                                                                    <div className="flex flex-col items-start min-w-0">
                                                                        <span className="text-app-base font-bold text-app-text truncate">
                                                                            {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                        </span>
                                                                        <span className="text-app-sm text-app-text-sec">
                                                                            {t('mitigation.shield_value', { value: barrierValue.toLocaleString() })}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
```

- [ ] **Step 10: スキルボタンにcopiesShieldの矢印マーカーを追加**

行341-345のtarget矢印表示の後に、copiesShield用の矢印も追加:

```typescript
                                                {mitigation.copiesShield && !isAlreadyPlaced && (
                                                    <span className="ml-2 text-app-base text-app-text-sec transition-transform group-hover:translate-x-0.5 inline-block shrink-0">
                                                        {selectedCopyShieldMit?.id === mitigation.id ? '▼' : '▶'}
                                                    </span>
                                                )}
```

- [ ] **Step 11: スキルリストのブラー効果にcopiesShield選択状態を反映**

行284-285の`isBlurred`計算を拡張:

変更前:
```typescript
const isSelectedTargetMit = selectedSingleTargetMit?.id === mitigation.id;
const isBlurred = selectedSingleTargetMit !== null && !isSelectedTargetMit;
```

変更後:
```typescript
const isSelectedTargetMit = selectedSingleTargetMit?.id === mitigation.id;
const isSelectedShieldMit = selectedCopyShieldMit?.id === mitigation.id;
const isBlurred = (selectedSingleTargetMit !== null && !isSelectedTargetMit) ||
                  (selectedCopyShieldMit !== null && !isSelectedShieldMit);
```

行297の`isSelectedTargetMit`でのハイライト条件にも追加:

変更前:
```typescript
isSelectedTargetMit ? "z-10 shadow-md bg-app-surface2 border-app-border" :
```

変更後:
```typescript
(isSelectedTargetMit || isSelectedShieldMit) ? "z-10 shadow-md bg-app-surface2 border-app-border" :
```

- [ ] **Step 12: Escapeキー処理にcopiesShield選択状態を追加**

行46-50のuseEscapeClose内を拡張:

変更前:
```typescript
    useEscapeClose(isOpen, () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else {
            onClose();
```

変更後:
```typescript
    useEscapeClose(isOpen, () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null);
        } else if (selectedCopyShieldMit) {
            setSelectedCopyShieldMit(null);
        } else {
            onClose();
```

- [ ] **Step 13: Timeline.tsxのhandleMitigationSelectを拡張**

`handleMitigationSelect`（行1334-1345付近）を変更:

変更前:
```typescript
const handleMitigationSelect = (mitigation: Mitigation & { _targetId?: string }) => {
    if (!selectedMemberId) return;

    addMitigation({
        id: genId(),
        mitigationId: mitigation.id,
        time: selectedMitigationTime,
        duration: mitigation.duration,
        ownerId: selectedMemberId,
        targetId: mitigation._targetId
    });
    setMitigationSelectorOpen(false);
};
```

変更後:
```typescript
const handleMitigationSelect = (mitigation: Mitigation & { _targetId?: string; _linkedMitigationId?: string }) => {
    if (!selectedMemberId) return;

    addMitigation({
        id: genId(),
        mitigationId: mitigation.id,
        time: selectedMitigationTime,
        duration: mitigation.duration,
        ownerId: selectedMemberId,
        targetId: mitigation._targetId,
        linkedMitigationId: mitigation._linkedMitigationId,
    });
    setMitigationSelectorOpen(false);
};
```

- [ ] **Step 14: ビルド確認**

```bash
rtk npm run build
```

Expected: ビルド成功

- [ ] **Step 15: コミット**

```bash
rtk git add src/components/MitigationSelector.tsx src/components/Timeline.tsx src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json && rtk git commit -m "feat: 展開戦術の鼓舞選択UI + バリアコピー計算統合（4言語対応）"
```

---

### Task 6: ビルド・動作確認

**Files:** なし（検証のみ）

- [ ] **Step 1: テスト実行**

```bash
rtk vitest run
```

Expected: 全テスト pass

- [ ] **Step 2: ビルド確認**

```bash
rtk npm run build
```

Expected: ビルド成功、型エラーなし

- [ ] **Step 3: dev server起動 + ブラウザ確認**

```bash
npm run dev
```

ブラウザで以下のシナリオを確認:

**シナリオ1: 基本の鼓舞展開**
1. 学者を選択
2. 鼓舞をMTに配置（t=10秒）
3. 展開戦術を配置（t=12秒）→ 自動で鼓舞にリンク、バリア値が表示される

**シナリオ2: 秘策→鼓舞→展開**
1. 秘策を配置（t=8秒）
2. 鼓舞をMTに配置（t=10秒）
3. 展開戦術を配置（t=12秒）→ バリア値が秘策なしの約1.6倍になっている

**シナリオ3: 展開戦術を先に配置**
1. 展開戦術を配置（t=12秒）→ バリア値0（警告）
2. 鼓舞をMTに配置（t=10秒）→ 自動リンク、バリア値が反映

**シナリオ4: 鼓舞2つ**
1. 学者Aが鼓舞をMTに配置（t=10秒）
2. 学者Aが鼓舞をSTに配置（t=11秒）
3. 展開戦術を配置（t=12秒）→ 選択UIが表示、2つの鼓舞がバリア値付きで表示

**シナリオ5: リンク先削除**
1. シナリオ1の状態から鼓舞を削除 → 展開戦術のバリア値が0になる

- [ ] **Step 4: 最終コミット（必要な修正があれば）**

修正があれば追加コミット。なければスキップ。
