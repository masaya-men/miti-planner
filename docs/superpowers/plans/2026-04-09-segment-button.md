# SegmentButton 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 排他選択ボタン群をスプリングアニメーション付きセグメントボタンに統一する

**Architecture:** 再利用可能な `SegmentButton` コンポーネントを `src/components/ui/` に作成。CSS変数 `--ease-spring-bouncy` で背景インジケーターをバネアニメーション。位置計測は `useLayoutEffect` + ref、アニメーションは純CSS `transform`。

**Tech Stack:** React, TypeScript, CSS custom properties (`linear()`), clsx

**Spec:** `docs/superpowers/specs/2026-04-09-segment-button-design.md`

---

### Task 1: SegmentButton コンポーネント作成

**Files:**
- Create: `src/components/ui/SegmentButton.tsx`

- [ ] **Step 1: コンポーネントファイル作成**

```tsx
// src/components/ui/SegmentButton.tsx
import { useRef, useState, useLayoutEffect, useEffect } from 'react';
import clsx from 'clsx';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string | React.ReactNode;
}

interface SegmentButtonProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentButton<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentButtonProps<T>) {
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const mounted = useRef(false);

  // アクティブボタンの位置を計測してインジケーターに反映
  useLayoutEffect(() => {
    const btn = buttonsRef.current.get(value);
    if (btn) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [value, options.length]);

  // 初回レンダーではトランジションを無効化（位置ジャンプ防止）
  useEffect(() => {
    mounted.current = true;
  }, []);

  return (
    <div
      className={clsx(
        'relative flex rounded-lg p-0.5 border border-glass-border bg-glass-card/80',
        className,
      )}
    >
      {/* スライドするインジケーター背景 */}
      {indicator.width > 0 && (
        <div
          className="absolute rounded-md bg-app-text shadow-lg pointer-events-none"
          style={{
            top: '2px',
            bottom: '2px',
            left: 0,
            width: `${indicator.width}px`,
            transform: `translateX(${indicator.left}px)`,
            transition: mounted.current
              ? 'transform var(--duration-normal) var(--ease-spring-bouncy), width var(--duration-normal) var(--ease-spring-bouncy)'
              : 'none',
          }}
        />
      )}

      {/* ボタン群 */}
      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            if (el) buttonsRef.current.set(option.value, el);
            else buttonsRef.current.delete(option.value);
          }}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'relative z-10 flex-1 flex items-center justify-center gap-1.5 rounded-md font-bold cursor-pointer',
            'transition-colors duration-150 active:scale-[0.97]',
            size === 'sm' ? 'py-1.5 text-app-base' : 'py-2 px-3 text-app-lg',
            option.value === value ? 'text-app-bg' : 'text-app-text',
          )}
        >
          {option.icon && (
            typeof option.icon === 'string'
              ? <img src={option.icon} alt="" className={clsx('object-contain', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              : option.icon
          )}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `rtk npm run build 2>&1 | tail -5`
Expected: `✓ built in` が表示される

- [ ] **Step 3: コミット**

```bash
rtk git add src/components/ui/SegmentButton.tsx && rtk git commit -m "feat: SegmentButton コンポーネント作成（スプリングアニメーション付き）"
```

---

### Task 2: EventModal に適用（3箇所）

**Files:**
- Modify: `src/components/EventModal.tsx`

**注意:** EventModal内の3箇所を置換する。state管理（`damageType`, `target`, `inputMode` とそのsetter）は変更しない。

- [ ] **Step 1: import追加**

`src/components/EventModal.tsx` の先頭importに追加:

```tsx
import { SegmentButton } from './ui/SegmentButton';
```

- [ ] **Step 2: inputMode ボタン群を置換**

`src/components/EventModal.tsx` の行548付近。既存の `{/* Input Mode Toggle (Segmented Control) */}` セクション全体を置換:

**置換前（行547-580の div 全体）:**
```tsx
                    {/* Input Mode Toggle (Segmented Control) */}
                    <div className={clsx(
                        "flex p-1 rounded-lg border transition-colors",
                        isMobile ? "mb-3" : "mb-6",
                        "bg-app-surface2 border-app-border"
                    )}>
                        <button ... >
                            <Calculator size={14} className="inline-block mr-2" />
                            {t('modal.mode_reverse', '逆算入力 (Reverse)')}
                        </button>
                        <button ... >
                            {t('modal.mode_direct', '直接入力 (Direct)')}
                        </button>
                    </div>
```

**置換後:**
```tsx
                    {/* Input Mode Toggle */}
                    <SegmentButton
                        options={[
                            { value: 'reverse', label: t('modal.mode_reverse', '逆算入力 (Reverse)'), icon: <Calculator size={14} /> },
                            { value: 'direct', label: t('modal.mode_direct', '直接入力 (Direct)') },
                        ]}
                        value={inputMode}
                        onChange={setInputMode}
                        className={isMobile ? 'mb-3' : 'mb-6'}
                    />
```

- [ ] **Step 3: damageType ボタン群を置換**

`src/components/EventModal.tsx` の行622付近。`{/* Damage Type */}` 内の `<div className={clsx("flex", ...)}>...</div>` を置換:

**置換前（行622-648の内側 div）:**
```tsx
                            <div className={clsx("flex", isMobile ? "gap-1.5" : "gap-2")}>
                                {[
                                    { type: 'magical', icon: '/icons/type_magic.png', label: t('modal.magical') },
                                    ...
                                ].map((item) => (
                                    <button ...>
                                        <Tooltip ...><img ... /></Tooltip>
                                        <span ...>{item.label}</span>
                                    </button>
                                ))}
                            </div>
```

**置換後:**
```tsx
                            <SegmentButton
                                options={[
                                    { value: 'magical', label: t('modal.magical'), icon: '/icons/type_magic.png' },
                                    { value: 'physical', label: t('modal.physical'), icon: '/icons/type_phys.png' },
                                    { value: 'unavoidable', label: t('modal.unavoidable'), icon: '/icons/type_dark.png' },
                                ]}
                                value={damageType}
                                onChange={(v) => setDamageType(v as any)}
                                size={isMobile ? 'sm' : 'md'}
                            />
```

- [ ] **Step 4: target ボタン群を置換**

`src/components/EventModal.tsx` の行654付近。`{/* Target Selection */}` 内の `<div className={clsx("flex items-center", ...)}>...</div>` を置換:

**置換前（行654-675の内側 div）:**
```tsx
                            <div className={clsx("flex items-center", isMobile ? "gap-1.5 h-[44px]" : "gap-2 h-[52px]")}>
                                {[
                                    { value: 'AoE', label: t('modal.aoe') },
                                    { value: 'MT', label: t('modal.mt') },
                                    { value: 'ST', label: t('modal.st') }
                                ].map((t) => (
                                    <button ...>{t.label}</button>
                                ))}
                            </div>
```

**置換後:**
```tsx
                            <SegmentButton
                                options={[
                                    { value: 'AoE', label: t('modal.aoe') },
                                    { value: 'MT', label: t('modal.mt') },
                                    { value: 'ST', label: t('modal.st') },
                                ]}
                                value={target}
                                onChange={(v) => setTarget(v as any)}
                                size={isMobile ? 'sm' : 'md'}
                            />
```

- [ ] **Step 5: ビルド + テスト**

Run: `rtk npm run build 2>&1 | tail -5`
Run: `rtk vitest run 2>&1`
Expected: ビルド成功、テスト128件全パス

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/EventModal.tsx && rtk git commit -m "feat: EventModal ボタン群をSegmentButton化（inputMode/damageType/target）"
```

---

### Task 3: Sidebar に適用（2箇所）

**Files:**
- Modify: `src/components/Sidebar.tsx`

**注意:** サイドバーのLevel/Categoryボタン群を置換する。state管理（`activeLevel`, `setActiveLevel`, `activeCategory`, `setActiveCategory`）は変更しない。Categoryの `onWheel` ハンドラーは `className` 経由のラッパーdivで維持する。

- [ ] **Step 1: import追加**

`src/components/Sidebar.tsx` の先頭importに追加:

```tsx
import { SegmentButton } from './ui/SegmentButton';
```

- [ ] **Step 2: Level ボタン群を置換**

`src/components/Sidebar.tsx` の行1155付近。`<div className="flex items-center bg-glass-card/80 ...">` 全体を置換:

**置換前（行1155-1175）:**
```tsx
                        <div className="flex items-center bg-glass-card/80 rounded-lg p-0.5 border border-glass-border shadow-sm">
                            {LEVEL_TIERS.map((level, i) => (
                                <React.Fragment key={level}>
                                    {i > 0 && <div className="w-px h-3 bg-app-text/15 shrink-0" />}
                                    <button
                                        onClick={() => {
                                            setActiveLevel(level);
                                            useMitigationStore.getState().setCurrentLevel(level);
                                        }}
                                        className={clsx(
                                            "flex-1 py-1.5 rounded-md text-app-base font-black transition-all duration-200 cursor-pointer active:scale-95",
                                            activeLevel === level
                                                ? "bg-app-text text-app-bg shadow-lg scale-[1.02] z-10"
                                                : "text-app-text hover:bg-glass-hover"
                                        )}
                                    >
                                        {level}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
```

**置換後:**
```tsx
                        <SegmentButton
                            options={LEVEL_TIERS.map(l => ({ value: String(l), label: String(l) }))}
                            value={String(activeLevel)}
                            onChange={(v) => {
                                const level = Number(v) as ContentLevel;
                                setActiveLevel(level);
                                useMitigationStore.getState().setCurrentLevel(level);
                            }}
                            size="sm"
                            className="shadow-sm"
                        />
```

- [ ] **Step 3: Category ボタン群を置換**

`src/components/Sidebar.tsx` の行1179付近。`<div className="flex items-center bg-glass-card/80 ... overflow-x-auto ...">` 全体を置換:

**置換前（行1179-1215）:**
```tsx
                        <div
                            className="flex items-center bg-glass-card/80 rounded-lg p-0.5 border border-glass-border shadow-sm overflow-x-auto custom-scrollbar-thin"
                            onWheel={(e) => {
                                if (e.deltaY !== 0) {
                                    e.currentTarget.scrollLeft += e.deltaY;
                                    e.preventDefault();
                                }
                            }}
                        >
                            <button onClick={() => setActiveCategory('all')} ...>
                                {t('ui.all').toUpperCase()}
                            </button>
                            {availableCategories.map(cat => (
                                <React.Fragment key={cat}>
                                    <div className="w-px h-3 bg-app-text/15 shrink-0" />
                                    <button onClick={() => setActiveCategory(cat)} ...>
                                        {(CATEGORY_LABELS[cat][lang as ContentLanguage] || ...).toUpperCase()}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
```

**置換後:**
```tsx
                        <div
                            className="overflow-x-auto custom-scrollbar-thin"
                            onWheel={(e) => {
                                if (e.deltaY !== 0) {
                                    e.currentTarget.scrollLeft += e.deltaY;
                                    e.preventDefault();
                                }
                            }}
                        >
                            <SegmentButton
                                options={[
                                    { value: 'all', label: t('ui.all').toUpperCase() },
                                    ...availableCategories.map(cat => ({
                                        value: cat,
                                        label: (CATEGORY_LABELS[cat][lang as ContentLanguage] || CATEGORY_LABELS[cat].ja).toUpperCase(),
                                    })),
                                ]}
                                value={activeCategory}
                                onChange={setActiveCategory}
                                size="sm"
                                className="shadow-sm min-w-fit"
                            />
                        </div>
```

**注:** `onWheel` ハンドラーは外側のスクロールコンテナdivに維持。SegmentButtonに `min-w-fit` を渡してスクロール対応。

- [ ] **Step 4: ビルド + テスト**

Run: `rtk npm run build 2>&1 | tail -5`
Run: `rtk vitest run 2>&1`
Expected: ビルド成功、テスト128件全パス

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Sidebar.tsx && rtk git commit -m "feat: Sidebar Level/Category をSegmentButton化"
```

---

### Task 4: 最終検証

- [ ] **Step 1: 全テスト実行**

Run: `rtk vitest run 2>&1`
Expected: 全テストパス

- [ ] **Step 2: ビルド最終確認**

Run: `rtk npm run build 2>&1 | tail -5`
Expected: ビルド成功

- [ ] **Step 3: TODO.md 更新**

`docs/TODO.md` の「今セッション完了」セクションに追記:

```
  - SegmentButton コンポーネント実装（スプリングアニメーション付き）
    - EventModal: inputMode/damageType/target の3箇所適用
    - Sidebar: Level/Category の2箇所適用
    - CSS変数 --ease-spring-bouncy で統一アニメーション
```
