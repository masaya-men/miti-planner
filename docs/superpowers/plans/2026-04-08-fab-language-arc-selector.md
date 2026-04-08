# FAB言語セレクター（円弧展開）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FABメニューの言語切替をサイクル式から、Globeボタン中心に左方向へ円弧状に4言語チップがspring staggeredで展開するセレクターに改善する。

**Architecture:** MobileFAB.tsx内に言語円弧セレクターのstateとUIを追加。Globeボタンのタップで`langOpen`をトグルし、4つの言語チップをframer-motionで円弧配置にアニメーション表示する。motionTokens.tsにバウンス用springプリセットを追加。

**Tech Stack:** React, framer-motion, TypeScript, Tailwind CSS, i18next, Zustand

---

## ファイル構造

| ファイル | 変更種別 | 責務 |
|---------|---------|------|
| `src/tokens/motionTokens.ts` | 修正 | `SPRING.bouncy` プリセット追加 |
| `src/components/MobileFAB.tsx` | 修正 | 言語行のonClick変更、円弧チップUI・アニメーション追加 |

---

### Task 1: motionTokensにSPRING.bouncy追加

**Files:**
- Modify: `src/tokens/motionTokens.ts:4-8`

- [ ] **Step 1: SPRING.bouncyを追加**

`src/tokens/motionTokens.ts` の `SPRING` オブジェクトに `bouncy` を追加する:

```typescript
export const SPRING = {
  default: { type: 'spring' as const, stiffness: 400, damping: 28 },
  gentle: { type: 'spring' as const, stiffness: 300, damping: 24 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
  bouncy: { type: 'spring' as const, stiffness: 380, damping: 15 },
} as const;
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: ビルド成功（型エラーなし）

- [ ] **Step 3: コミット**

```bash
git add src/tokens/motionTokens.ts
git commit -m "feat: add SPRING.bouncy preset for language arc selector"
```

---

### Task 2: MobileFAB.tsxに円弧言語セレクターを実装

**Files:**
- Modify: `src/components/MobileFAB.tsx`

- [ ] **Step 1: 言語チップの定数と円弧計算ヘルパーを追加**

`MobileFAB.tsx` のファイル先頭部分（`LANG_CYCLE` 定義の直後、30行付近）に以下を追加:

```typescript
const LANG_LABELS: Record<ContentLanguage, string> = {
  ja: '日',
  en: 'EN',
  zh: '中',
  ko: '한',
};

// 円弧レイアウト定数
const ARC_RADIUS = 60;
const ARC_CHIP_SIZE = 36;
// 150°〜210°（左方向、上下対称の扇形）を4等分
const ARC_ANGLES = [150, 170, 190, 210];

function arcPosition(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: ARC_RADIUS * Math.cos(rad),
    y: -ARC_RADIUS * Math.sin(rad), // CSS座標系はy反転
  };
}
```

- [ ] **Step 2: langOpen stateを追加し、FABメニューclose時にリセット**

`MobileFAB` コンポーネント内（`const [open, setOpen] = React.useState(false);` の直後、64行付近）に追加:

```typescript
const [langOpen, setLangOpen] = React.useState(false);
```

既存の `close` 関数を修正:

```typescript
const close = () => {
    setLangOpen(false);
    setOpen(false);
};
```

- [ ] **Step 3: handleLanguage関数を円弧展開トグルに変更**

現在の `handleLanguage`（70-79行）を以下に置き換え:

```typescript
// 言語円弧セレクターのトグル
const handleLanguageToggle = () => {
    setLangOpen(prev => !prev);
};

// 言語選択実行
const handleLanguageSelect = (lang: ContentLanguage) => {
    const current = i18n.language as ContentLanguage;
    if (lang === current) {
        // 同じ言語を選択 → 閉じるだけ
        setLangOpen(false);
        return;
    }
    setLangOpen(false);
    close();
    runTransition(() => {
        i18n.changeLanguage(lang);
        setContentLanguage(lang);
    }, 'language');
};
```

- [ ] **Step 4: settingsItemsの言語行のonClickを変更**

`settingsItems` 配列内の `language` アイテム（153-159行）を修正:

```typescript
{
    key: 'language',
    label: t('app.fab_language'),
    icon: <Globe size={20} />,
    onClick: handleLanguageToggle,
    accent: false,
},
```

- [ ] **Step 5: 円弧チップのframer-motion variantsを定義**

`itemVariants` 定義の直後（190行付近）に追加:

```typescript
// 言語円弧チップのアニメーション
const arcChipVariants = {
    hidden: {
        x: 0,
        y: 0,
        scale: 0,
        opacity: 0,
        rotate: -15,
    },
    visible: (i: number) => {
        const pos = arcPosition(ARC_ANGLES[i]);
        return {
            x: pos.x,
            y: pos.y,
            scale: 1,
            opacity: 1,
            rotate: 0,
            transition: {
                ...SPRING.bouncy,
                delay: i * 0.05,
            },
        };
    },
    exit: (i: number) => ({
        x: 0,
        y: 0,
        scale: 0,
        opacity: 0,
        rotate: -15,
        transition: {
            ...SPRING.snappy,
            delay: (LANG_CYCLE.length - 1 - i) * 0.025,
        },
    }),
    tap: {
        scale: 1.3,
        transition: { duration: 0.1 },
    },
};
```

- [ ] **Step 6: 言語行のレンダリングに円弧チップUIを追加**

FABメニュー項目のレンダリング部分（`allItems.map` 内、236行付近）で、`item.key === 'language'` の場合に円弧チップを追加レンダリングする。

現在の言語行のレンダリング（`return` 文の `<motion.div key={item.key} ...>` 部分）を、languageキーの場合だけ拡張する。

`allItems.map` 内の既存のアイテムレンダリング部分（234-271行のreturn文全体）を以下に置き換え:

```typescript
const isSync = item.key === 'sync';
const isLang = item.key === 'language';
return (
    <motion.div
        key={item.key}
        custom={idx}
        variants={itemVariants}
        className="flex items-center gap-2.5"
        style={{ position: isLang ? 'relative' : undefined }}
    >
        {/* ラベル（ボタンの左） */}
        <span className="text-[13px] font-semibold text-white/90 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 select-none whitespace-nowrap shadow-md">
            {item.label}
        </span>

        {/* ボタン */}
        <button
            onClick={item.onClick}
            disabled={'disabled' in item ? Boolean(item.disabled) : false}
            className={clsx(
                "flex items-center justify-center border",
                "shadow-lg active:scale-90 transition-transform duration-100",
                "disabled:pointer-events-none disabled:opacity-40",
                isSync
                    ? "bg-app-blue/12 border-app-blue/20 text-app-blue"
                    : "text-app-text"
            )}
            style={{
                width: MOBILE_TOKENS.fab.itemSize,
                height: MOBILE_TOKENS.fab.itemSize,
                borderRadius: MOBILE_TOKENS.fab.radius,
                ...(!isSync ? {
                    backgroundColor: 'var(--color-fab-bg)',
                    borderColor: 'var(--color-fab-border)',
                } : {}),
            }}
        >
            {item.icon}
        </button>

        {/* 言語円弧チップ — Globeボタンの中心を起点に展開 */}
        {isLang && (
            <AnimatePresence>
                {langOpen && LANG_CYCLE.map((lang, i) => {
                    const isActive = lang === (i18n.language as ContentLanguage);
                    return (
                        <motion.button
                            key={lang}
                            custom={i}
                            variants={arcChipVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            whileTap="tap"
                            onClick={() => handleLanguageSelect(lang)}
                            className={clsx(
                                "absolute flex items-center justify-center",
                                "rounded-full font-semibold text-[13px] select-none",
                                "shadow-lg",
                                isActive
                                    ? "bg-app-blue text-white shadow-app-blue/30"
                                    : "bg-black/70 text-white/90 backdrop-blur-sm"
                            )}
                            style={{
                                width: ARC_CHIP_SIZE,
                                height: ARC_CHIP_SIZE,
                                // 起点: Globeボタンの中心
                                // absolute positionなので、親relativeのbutton直後に配置
                                // right: 0 + itemSize/2 - chipSize/2 でボタン中心に合わせる
                                right: (MOBILE_TOKENS.fab.itemSize - ARC_CHIP_SIZE) / 2,
                                top: (MOBILE_TOKENS.fab.itemSize - ARC_CHIP_SIZE) / 2,
                            }}
                        >
                            {LANG_LABELS[lang]}
                        </motion.button>
                    );
                })}
            </AnimatePresence>
        )}
    </motion.div>
);
```

- [ ] **Step 7: Globeボタンの展開時パルスアニメーションを追加**

言語行のGlobeボタンに、`langOpen` 時のパルスを追加する。言語アイテムのボタン部分だけ `motion.button` に変更する。

Step 6のコード内の言語行ボタン部分を修正。`isLang` の場合だけ `motion.button` でラップする:

言語行のボタン部分（`{/* ボタン */}` のセクション）を以下に置き換え:

```typescript
{/* ボタン — 言語の場合はパルスアニメーション付き */}
{isLang ? (
    <motion.button
        onClick={item.onClick}
        animate={langOpen ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={{ duration: 0.12 }}
        className={clsx(
            "flex items-center justify-center border",
            "shadow-lg transition-transform duration-100",
            "text-app-text"
        )}
        style={{
            width: MOBILE_TOKENS.fab.itemSize,
            height: MOBILE_TOKENS.fab.itemSize,
            borderRadius: MOBILE_TOKENS.fab.radius,
            backgroundColor: 'var(--color-fab-bg)',
            borderColor: 'var(--color-fab-border)',
        }}
    >
        {item.icon}
    </motion.button>
) : (
    <button
        onClick={item.onClick}
        disabled={'disabled' in item ? Boolean(item.disabled) : false}
        className={clsx(
            "flex items-center justify-center border",
            "shadow-lg active:scale-90 transition-transform duration-100",
            "disabled:pointer-events-none disabled:opacity-40",
            isSync
                ? "bg-app-blue/12 border-app-blue/20 text-app-blue"
                : "text-app-text"
        )}
        style={{
            width: MOBILE_TOKENS.fab.itemSize,
            height: MOBILE_TOKENS.fab.itemSize,
            borderRadius: MOBILE_TOKENS.fab.radius,
            ...(!isSync ? {
                backgroundColor: 'var(--color-fab-bg)',
                borderColor: 'var(--color-fab-border)',
            } : {}),
        }}
    >
        {item.icon}
    </button>
)}
```

- [ ] **Step 8: ビルド確認**

Run: `npm run build`
Expected: ビルド成功（型エラーなし）

- [ ] **Step 9: テスト実行**

Run: `npx vitest run`
Expected: 全テスト（116件）パス

- [ ] **Step 10: コミット**

```bash
git add src/components/MobileFAB.tsx
git commit -m "feat: add arc language selector with spring staggered animation"
```

---

### Task 3: 動作確認と微調整

**Files:**
- Modify: `src/components/MobileFAB.tsx`（必要に応じて）

- [ ] **Step 1: 開発サーバーで動作確認**

Run: `npm run dev`

確認項目:
1. FABメニュー展開 → 言語行の🌐ボタンをタップ → 左方向に4言語チップが円弧状に展開される
2. チップがバウンスしながら出現する（bouncy spring）
3. チップに軽い回転アニメーションがある
4. Globeボタンがパルスする
5. 現在の言語が青チップでハイライトされている
6. 別の言語をタップ → チップが拡大後に中心へ吸い込まれる → 鉛筆トランジション → 言語が切り替わる
7. 同じ言語をタップ → チップが閉じるだけ（トランジションなし）
8. FABメニューを閉じる → 言語チップも同時に閉じる
9. チップ同士が重ならない

- [ ] **Step 2: 半径・角度の微調整（必要に応じて）**

実機またはDevToolsモバイルビューで確認し、チップが画面外にはみ出す・重なるなどがあれば `ARC_RADIUS` や `ARC_ANGLES` を調整する。

- [ ] **Step 3: 最終コミット（調整があった場合）**

```bash
git add src/components/MobileFAB.tsx
git commit -m "fix: adjust arc selector radius and angles for mobile viewport"
```
