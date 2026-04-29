# ダメージ値変化アニメーション 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軽減後ダメージ値が変わるとき、桁ごとに下から立ち上がるアニメーションを表示する（FPS 死守、A11y 配慮）

**Architecture:** 新規 `AnimatedDamage` コンポーネントに動作を集約。CSS keyframes で GPU 合成、JS は値変化時の DOM 構築タイミングのみ管理。`TimelineRow` / `MobileTimelineRow` の既存ダメージ表示部分を置換。

**Tech Stack:** React 19, TypeScript, Vitest (globals + happy-dom), CSS keyframes (Tailwind v4)

**設計書:** [docs/superpowers/specs/2026-04-30-damage-value-animation-design.md](../specs/2026-04-30-damage-value-animation-design.md)

**セーフティタグ:** 実装中に問題があれば `git reset --hard pre-damage-anim` で完全巻き戻し可

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/AnimatedDamage.css` | Create | keyframes + .ch/.enter/.exit クラス、reduced-motion 対応 |
| `src/components/AnimatedDamage.tsx` | Create | 値変化を検知して exit→enter シーケンスを管理する単一コンポーネント |
| `src/components/__tests__/AnimatedDamage.test.tsx` | Create | 5 件の振る舞いテスト（fake timer 使用） |
| `src/components/TimelineRow.tsx` | Modify | 2 箇所のダメージ表示 span を `<AnimatedDamage>` に置換 |
| `src/components/MobileTimelineRow.tsx` | Modify | 1 箇所のダメージ表示 span を `<AnimatedDamage>` に置換 |

---

## Task 1: CSS ファイル作成（keyframes と classes）

**Files:**
- Create: `src/components/AnimatedDamage.css`

- [ ] **Step 1: ファイル作成**

```css
/* ダメージ値変化アニメーション
   設計書: docs/superpowers/specs/2026-04-30-damage-value-animation-design.md
   GPU合成のみ使用 (transform / opacity)、JS補間ゼロ */

.dmg-slot {
    height: 22px;
    overflow: hidden;
    display: flex;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.dmg-slot .ch {
    display: inline-block;
}

.dmg-slot .ch.enter {
    will-change: transform, opacity;
    animation: dmgEnter 150ms cubic-bezier(0.18, 1, 0.32, 1) both;
    animation-delay: calc(22ms * var(--i, 0));
}

.dmg-slot .ch.exit {
    will-change: transform, opacity;
    animation: dmgExit 120ms cubic-bezier(0.7, 0, 0.84, 0) both;
    animation-delay: calc(10ms * var(--i, 0));
}

@keyframes dmgEnter {
    from { transform: translateY(15px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
}
@keyframes dmgExit {
    from { transform: translateY(0);    opacity: 1; }
    to   { transform: translateY(-3px); opacity: 0; }
}

/* A11y: モーション低減希望ユーザー */
@media (prefers-reduced-motion: reduce) {
    .dmg-slot .ch.enter,
    .dmg-slot .ch.exit {
        animation: none !important;
    }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/AnimatedDamage.css
git commit -m "feat(anim): ダメージ値変化アニメーション用 CSS 追加"
```

---

## Task 2: AnimatedDamage コンポーネント — 静的 render テスト

**Files:**
- Create: `src/components/AnimatedDamage.tsx`
- Create: `src/components/__tests__/AnimatedDamage.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

ファイル: `src/components/__tests__/AnimatedDamage.test.tsx`

```tsx
// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { AnimatedDamage } from '../AnimatedDamage';

describe('AnimatedDamage', () => {
    it('renders formatted value as per-character spans', () => {
        const { container } = render(<AnimatedDamage value={10000} />);
        const slot = container.querySelector('.dmg-slot');
        expect(slot).toBeTruthy();
        const chars = slot!.querySelectorAll('.ch');
        // "10,000" => 6 文字
        expect(chars).toHaveLength(6);
        expect(slot!.textContent).toBe('10,000');
    });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: FAIL — `Cannot find module '../AnimatedDamage'`

- [ ] **Step 3: 最小実装**

ファイル: `src/components/AnimatedDamage.tsx`

```tsx
import './AnimatedDamage.css';

interface AnimatedDamageProps {
    value: number;
    isLethal?: boolean;
    className?: string;
}

export function AnimatedDamage({ value, className }: AnimatedDamageProps) {
    const chars = value.toLocaleString().split('');
    return (
        <div className={`dmg-slot ${className ?? ''}`.trim()}>
            {chars.map((ch, i) => (
                <span key={`init-${i}`} className="ch" style={{ ['--i' as never]: i }}>
                    {ch}
                </span>
            ))}
        </div>
    );
}
```

- [ ] **Step 4: テスト実行で PASS 確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/AnimatedDamage.tsx src/components/__tests__/AnimatedDamage.test.tsx
git commit -m "feat(anim): AnimatedDamage コンポーネントの静的 render 実装"
```

---

## Task 3: 同値時は再 render しない（no-op）

**Files:**
- Modify: `src/components/AnimatedDamage.tsx`
- Modify: `src/components/__tests__/AnimatedDamage.test.tsx`

- [ ] **Step 1: 失敗するテストを追加**

`src/components/__tests__/AnimatedDamage.test.tsx` の `describe` 内に追加:

```tsx
    it('does NOT replace DOM when value is unchanged', () => {
        const { container, rerender } = render(<AnimatedDamage value={10000} />);
        const firstSpan = container.querySelector('.ch');
        rerender(<AnimatedDamage value={10000} />);
        const sameSpan = container.querySelector('.ch');
        // DOM 要素そのものが同一参照であること
        expect(sameSpan).toBe(firstSpan);
    });
```

- [ ] **Step 2: テスト実行**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

現状の実装でも同値なら React が span を再利用するはずなので、たぶん PASS する（key が同じため）。
**もし PASS したら**: そのまま Step 5 へ。
**もし FAIL したら**: Step 3 へ進む。

- [ ] **Step 3: prevValueRef で同値スキップを実装**

`src/components/AnimatedDamage.tsx` を以下に書き換え:

```tsx
import { useEffect, useRef, useState } from 'react';
import './AnimatedDamage.css';

interface AnimatedDamageProps {
    value: number;
    isLethal?: boolean;
    className?: string;
}

export function AnimatedDamage({ value, className }: AnimatedDamageProps) {
    const [chars, setChars] = useState<string[]>(() => value.toLocaleString().split(''));
    const prevValueRef = useRef(value);

    useEffect(() => {
        if (prevValueRef.current === value) return;
        prevValueRef.current = value;
        setChars(value.toLocaleString().split(''));
    }, [value]);

    return (
        <div className={`dmg-slot ${className ?? ''}`.trim()}>
            {chars.map((ch, i) => (
                <span key={`init-${i}`} className="ch" style={{ ['--i' as never]: i }}>
                    {ch}
                </span>
            ))}
        </div>
    );
}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: 全 PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/AnimatedDamage.tsx src/components/__tests__/AnimatedDamage.test.tsx
git commit -m "feat(anim): 同値時の再 render スキップ"
```

---

## Task 4: 値変化で exit → enter シーケンス起動

**Files:**
- Modify: `src/components/AnimatedDamage.tsx`
- Modify: `src/components/__tests__/AnimatedDamage.test.tsx`

- [ ] **Step 1: 失敗するテストを追加**

`src/components/__tests__/AnimatedDamage.test.tsx` の `describe` 内に追加:

```tsx
    it('on value change, transitions through exit then enter phases', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(<AnimatedDamage value={10000} />);
            // 初回: exit / enter クラスは無し
            expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);

            rerender(<AnimatedDamage value={7000} />);

            // 値変化直後: 旧文字列が exit クラス、新文字列はまだ無い
            const exitChars = container.querySelectorAll('.ch.exit');
            expect(exitChars).toHaveLength(6); // "10,000"
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);

            // exit 完了 + micro_delay 経過後
            // exit 120ms + stagger 10ms × 5 = 170ms + delay 10ms = 180ms
            vi.advanceTimersByTime(180);

            const enterChars = container.querySelectorAll('.ch.enter');
            expect(enterChars).toHaveLength(5); // "7,000"
            expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: FAIL — exit クラスが見つからない

- [ ] **Step 3: exit/enter シーケンス実装**

`src/components/AnimatedDamage.tsx` を以下に書き換え:

```tsx
import { useEffect, useRef, useState } from 'react';
import './AnimatedDamage.css';

interface AnimatedDamageProps {
    value: number;
    isLethal?: boolean;
    className?: string;
}

interface RenderState {
    exiting: string[];
    entering: string[];
}

// 設計書の値（変えるなら spec も同期更新）
const EXIT_DURATION_MS = 120;
const EXIT_STAGGER_MS = 10;
const SWAP_DELAY_MS = 10;

function exitTotalMs(charCount: number): number {
    return EXIT_DURATION_MS + Math.max(0, charCount - 1) * EXIT_STAGGER_MS;
}

export function AnimatedDamage({ value, className }: AnimatedDamageProps) {
    const initialChars = value.toLocaleString().split('');
    const [renderState, setRenderState] = useState<RenderState>({
        exiting: [],
        entering: initialChars,
    });
    const prevValueRef = useRef(value);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (prevValueRef.current === value) return;
        prevValueRef.current = value;

        const newChars = value.toLocaleString().split('');

        setRenderState(prev => ({
            exiting: prev.entering,
            entering: [],
        }));

        const oldCharCount = renderState.entering.length;
        const totalExit = exitTotalMs(oldCharCount) + SWAP_DELAY_MS;

        timerRef.current = window.setTimeout(() => {
            setRenderState({ exiting: [], entering: newChars });
            timerRef.current = null;
        }, totalExit);

        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [value]); // renderState.entering は意図的に依存配列に含めない（無限ループ回避）

    return (
        <div className={`dmg-slot ${className ?? ''}`.trim()}>
            {renderState.exiting.map((ch, i) => (
                <span key={`exit-${i}`} className="ch exit" style={{ ['--i' as never]: i }}>
                    {ch}
                </span>
            ))}
            {renderState.entering.map((ch, i) => (
                <span key={`enter-${value}-${i}`} className="ch enter" style={{ ['--i' as never]: i }}>
                    {ch}
                </span>
            ))}
        </div>
    );
}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: 全 PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/AnimatedDamage.tsx src/components/__tests__/AnimatedDamage.test.tsx
git commit -m "feat(anim): 値変化で exit→enter シーケンス起動"
```

---

## Task 5: 初回マウントはアニメ無し

**Files:**
- Modify: `src/components/AnimatedDamage.tsx`
- Modify: `src/components/__tests__/AnimatedDamage.test.tsx`

- [ ] **Step 1: 失敗するテストを追加**

```tsx
    it('does not animate on initial mount', () => {
        const { container } = render(<AnimatedDamage value={10000} />);
        // 初回マウント: enter クラスは付かない（即静止表示）
        expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);
        expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
        // 文字は表示されている
        expect(container.querySelector('.dmg-slot')!.textContent).toBe('10,000');
    });
```

- [ ] **Step 2: テスト実行で失敗確認**

期待: FAIL — Task 4 で `.enter` クラスが初期 entering に付いている

- [ ] **Step 3: hasAnimated フラグで初回スキップ**

`src/components/AnimatedDamage.tsx` の return 文を以下に修正（hasAnimated state 追加 + 初期 entering のクラス分岐）:

```tsx
    const [hasAnimated, setHasAnimated] = useState(false);
```

useEffect の `prevValueRef.current = value;` の直下に追加:

```tsx
        setHasAnimated(true);
```

return 文の entering map を以下に修正:

```tsx
            {renderState.entering.map((ch, i) => (
                <span
                    key={`enter-${value}-${i}`}
                    className={hasAnimated ? "ch enter" : "ch"}
                    style={{ ['--i' as never]: i }}
                >
                    {ch}
                </span>
            ))}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: 全 PASS（4 件）

- [ ] **Step 5: コミット**

```bash
git add src/components/AnimatedDamage.tsx src/components/__tests__/AnimatedDamage.test.tsx
git commit -m "feat(anim): 初回マウントはアニメ無しで即表示"
```

---

## Task 6: 連続変更時のキャンセル

**Files:**
- Modify: `src/components/AnimatedDamage.tsx`
- Modify: `src/components/__tests__/AnimatedDamage.test.tsx`

- [ ] **Step 1: 失敗するテストを追加**

```tsx
    it('cancels mid-swap and jumps to latest value on rapid changes', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(<AnimatedDamage value={10000} />);

            // 1 回目の変更（mid-swap 状態に入る）
            rerender(<AnimatedDamage value={7000} />);
            vi.advanceTimersByTime(50); // exit 中

            // 2 回目の変更（mid-swap 中の割り込み）
            rerender(<AnimatedDamage value={5000} />);

            // exit クラスは消え、即 enter で 5000 が表示される
            // （実装上は exiting=[], entering=[5,000] の即遷移）
            expect(container.querySelector('.dmg-slot')!.textContent).toBe('5,000');
            // 古い "7,000" は残っていない
            const allText = container.textContent;
            expect(allText).not.toContain('7,000');
            expect(allText).not.toContain('10,000');
        } finally {
            vi.useRealTimers();
        }
    });
```

- [ ] **Step 2: テスト実行で失敗確認**

期待: FAIL — Task 4 の実装は cleanup でクリアするだけで、mid-swap の即ジャンプを実装していない

- [ ] **Step 3: mid-swap 即ジャンプを実装**

`src/components/AnimatedDamage.tsx` の useEffect を以下に書き換え:

```tsx
    useEffect(() => {
        if (prevValueRef.current === value) return;
        prevValueRef.current = value;
        setHasAnimated(true);

        const newChars = value.toLocaleString().split('');

        // mid-swap 中の割り込み: 既存タイマーをキャンセルし、即 enter フェーズへ
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            setRenderState({ exiting: [], entering: newChars });
            return;
        }

        // 通常の swap: 旧 chars を exit に移し、タイマーで enter
        setRenderState(prev => ({
            exiting: prev.entering,
            entering: [],
        }));

        const oldCharCount = renderState.entering.length;
        const totalExit = exitTotalMs(oldCharCount) + SWAP_DELAY_MS;

        timerRef.current = window.setTimeout(() => {
            setRenderState({ exiting: [], entering: newChars });
            timerRef.current = null;
        }, totalExit);

        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [value]); // renderState.entering は意図的に依存配列に含めない
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: 全 PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add src/components/AnimatedDamage.tsx src/components/__tests__/AnimatedDamage.test.tsx
git commit -m "feat(anim): 連続変更時の mid-swap キャンセル"
```

---

## Task 7: isLethal / className props 対応

**Files:**
- Modify: `src/components/AnimatedDamage.tsx`
- Modify: `src/components/__tests__/AnimatedDamage.test.tsx`

- [ ] **Step 1: 失敗するテストを追加**

```tsx
    it('applies lethal styling when isLethal=true', () => {
        const { container } = render(<AnimatedDamage value={50000} isLethal />);
        const slot = container.querySelector('.dmg-slot');
        expect(slot?.classList.contains('lethal')).toBe(true);
    });

    it('applies passed className', () => {
        const { container } = render(<AnimatedDamage value={50000} className="my-extra" />);
        const slot = container.querySelector('.dmg-slot');
        expect(slot?.classList.contains('my-extra')).toBe(true);
    });
```

- [ ] **Step 2: テスト実行で失敗確認**

期待: lethal クラステストは FAIL（isLethal を読んでいない）、my-extra は PASS

- [ ] **Step 3: isLethal クラス対応**

`src/components/AnimatedDamage.tsx` の return 文の div className を以下に修正:

```tsx
        <div className={`dmg-slot ${isLethal ? 'lethal' : ''} ${className ?? ''}`.trim().replace(/\s+/g, ' ')}>
```

`AnimatedDamage.css` に lethal クラス定義を追加:

```css
.dmg-slot.lethal {
    /* 色は親側 (TimelineRow / MobileTimelineRow) のクラスで上書きされるため、
       ここでは weight のみ強調 */
    font-weight: 900;
}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
npx vitest run src/components/__tests__/AnimatedDamage.test.tsx
```

期待: 全 PASS（7 件）

- [ ] **Step 5: コミット**

```bash
git add src/components/AnimatedDamage.tsx src/components/AnimatedDamage.css src/components/__tests__/AnimatedDamage.test.tsx
git commit -m "feat(anim): isLethal / className props 対応"
```

---

## Task 8: TimelineRow.tsx に統合（PC 版）

**Files:**
- Modify: `src/components/TimelineRow.tsx`

- [ ] **Step 1: AnimatedDamage を import**

`src/components/TimelineRow.tsx` の既存 import 群の一番下に追加:

```tsx
import { AnimatedDamage } from './AnimatedDamage';
```

- [ ] **Step 2: 1 セル表示の damage span を置換**

[src/components/TimelineRow.tsx:529-542](../../../src/components/TimelineRow.tsx#L529-L542) の以下のブロック:

```tsx
                                <span className={clsx(
                                    (() => {
                                        const evt = events[0];
                                        const dmg = damages[0];
                                        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                        if (evt.target === 'MT' || evt.target === 'ST') {
                                            maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                        }
                                        const isLethal = dmg.mitigated >= maxHp;
                                        return isLethal ? "text-red-600 dark:text-red-400 font-black shadow-sm" : "text-green-600 dark:text-green-400";
                                    })()
                                )}>
                                    {formatDmg(damages[0].mitigated)}
                                </span>
```

を以下に置換:

```tsx
                                {(() => {
                                    const evt = events[0];
                                    const dmg = damages[0];
                                    let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                    if (evt.target === 'MT' || evt.target === 'ST') {
                                        maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                    }
                                    const isLethal = dmg.mitigated >= maxHp;
                                    const colorClass = isLethal
                                        ? "text-red-600 dark:text-red-400 shadow-sm"
                                        : "text-green-600 dark:text-green-400";
                                    return <AnimatedDamage value={dmg.mitigated} isLethal={isLethal} className={colorClass} />;
                                })()}
```

- [ ] **Step 3: 2 セル並列表示（idx map）の damage span を置換**

[src/components/TimelineRow.tsx:581-594](../../../src/components/TimelineRow.tsx#L581-L594) の以下のブロック:

```tsx
                                        <span className={clsx(
                                            (() => {
                                                const evt = events[idx];
                                                const dmg = damages[idx];
                                                let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                                if (evt.target === 'MT' || evt.target === 'ST') {
                                                    maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                                }
                                                const isLethal = dmg.mitigated >= maxHp;
                                                return isLethal ? "text-red-600 dark:text-red-400 font-black shadow-sm" : "text-green-600 dark:text-green-400";
                                            })()
                                        )}>
                                            {formatDmg(damages[idx].mitigated)}
                                        </span>
```

を以下に置換:

```tsx
                                        {(() => {
                                            const evt = events[idx];
                                            const dmg = damages[idx];
                                            let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
                                            if (evt.target === 'MT' || evt.target === 'ST') {
                                                maxHp = partyMembers.find(m => m.id === evt.target)?.stats.hp || 1;
                                            }
                                            const isLethal = dmg.mitigated >= maxHp;
                                            const colorClass = isLethal
                                                ? "text-red-600 dark:text-red-400 shadow-sm"
                                                : "text-green-600 dark:text-green-400";
                                            return <AnimatedDamage value={dmg.mitigated} isLethal={isLethal} className={colorClass} />;
                                        })()}
```

- [ ] **Step 4: ブラウザで実機確認**

```bash
npm run dev
```

ブラウザで軽減表を開き、軽減を配置・削除してダメージ値が下から立ち上がることを確認。

確認項目:
- 数字が桁ごとに少しずつズレて登場
- セルからはみ出していない（overflow:hidden 効いている）
- 軽減連打しても乱れない
- 致死赤・通常緑で色が正しい

問題があれば `git reset --hard pre-damage-anim` で巻き戻し。

- [ ] **Step 5: 既存テストを実行**

```bash
npx vitest run
```

期待: 全 PASS（既存テストを壊していないこと）

- [ ] **Step 6: コミット**

```bash
git add src/components/TimelineRow.tsx
git commit -m "feat(anim): TimelineRow にダメージ値アニメーション統合 (PC)"
```

---

## Task 9: MobileTimelineRow.tsx に統合（スマホ版）

**Files:**
- Modify: `src/components/MobileTimelineRow.tsx`

- [ ] **Step 1: AnimatedDamage を import**

`src/components/MobileTimelineRow.tsx` の既存 import 群の一番下に追加:

```tsx
import { AnimatedDamage } from './AnimatedDamage';
```

- [ ] **Step 2: damage span を置換**

[src/components/MobileTimelineRow.tsx:291-298](../../../src/components/MobileTimelineRow.tsx#L291-L298) の以下のブロック:

```tsx
                            <span className={clsx(
                                "font-mono text-[13px] font-black leading-none flex-shrink-0",
                                isLethal
                                    ? "text-red-500"
                                    : "text-green-500"
                            )}>
                                {formatDmg(damage.mitigated)}
                            </span>
```

を以下に置換:

```tsx
                            <AnimatedDamage
                                value={damage.mitigated}
                                isLethal={isLethal}
                                className={clsx(
                                    "font-mono text-[13px] leading-none flex-shrink-0",
                                    isLethal ? "text-red-500" : "text-green-500"
                                )}
                            />
```

- [ ] **Step 3: スマホ実機相当（DevTools エミュレーター）で確認**

Chrome DevTools の デバイスエミュレーターで iPhone / Android を選び、軽減表でアニメ確認。

- [ ] **Step 4: 既存テストを実行**

```bash
npx vitest run
```

期待: 全 PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/MobileTimelineRow.tsx
git commit -m "feat(anim): MobileTimelineRow にダメージ値アニメーション統合"
```

---

## Task 10: パフォーマンス検証

**Files:** なし（検証のみ）

- [ ] **Step 1: dev server 起動**

```bash
npm run dev
```

- [ ] **Step 2: Chrome DevTools Performance パネル計測**

1. F12 で DevTools を開く → Performance タブ
2. 録画開始 → 軽減を 5 つ連続配置 → 録画停止
3. FPS グラフを確認:
   - 緑帯（FPS 維持）が継続していること
   - 赤帯（フレームドロップ）が発生していないこと
4. **判定基準**: 60FPS 維持されていれば合格

- [ ] **Step 3: prefers-reduced-motion 確認**

Chrome DevTools の Rendering タブ → "Emulate CSS media feature prefers-reduced-motion" を `reduce` に設定。
軽減を配置 → アニメーションが完全に消えて即座に値が変わること。

- [ ] **Step 4: 大型プランで負荷確認**

100 セル前後の長尺プランがあれば開く（無ければ FRU 通常 plan で代用）。
軽減連打しても画面がカクつかないこと。

- [ ] **Step 5: 検証結果をユーザーに報告**

問題なし → Task 11 へ。
問題あり → ユーザーに報告して `git reset --hard pre-damage-anim` で巻き戻し → 数値再調整。

---

## Task 11: 全体ビルド検証

**Files:** なし

- [ ] **Step 1: TypeScript 型チェック + ビルド**

```bash
npm run build
```

期待: エラー無しで完了。
（参考: 過去に Vercel 厳密モードで未使用変数エラーが出ているので注意）

- [ ] **Step 2: 全テスト実行**

```bash
npx vitest run
```

期待: 全 PASS（既存 + 新規 7 件）。

- [ ] **Step 3: ユーザー実機確認待ち**

ユーザーが実機で OK 出すまで push 保留。
OK が出たら以下を実行（ユーザー指示後）:

```bash
git push origin main
```

Vercel が自動デプロイ。

---

## Task 12: 完了処理

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: TODO.md の現在の状態を更新**

`docs/TODO.md` の冒頭「現在の状態」セクションに以下のような新セッションエントリを追加（既存の項目フォーマットに合わせる）:

```markdown
- **前セッション（2026-04-30・ダメージ値変化アニメーション追加）**: 軽減表の軽減後ダメージ値に per-character bottom-up アニメーション追加。設計書: `docs/superpowers/specs/2026-04-30-damage-value-animation-design.md`、実装プラン: `docs/superpowers/plans/2026-04-30-damage-value-animation.md`。新規 `AnimatedDamage` コンポーネント (CSS keyframes + React state)、`prefers-reduced-motion` 完全対応、60FPS 死守。`pixel-point/animate-text` の `bottom-up-letters` 仕様を参考（コードはコピーせず数値のみ参考、ライセンス安全策）。Enter 150ms/15px/22ms stagger out-expo、Exit 120ms/-3px/10ms stagger in-expo、合計 ~470ms swap。スライダー付きプレビューで数値詰め → 設計書 → 実装。セーフティタグ `pre-damage-anim` 残置。build+test 全 PASS、ユーザー実機 OK、デプロイ完了。
```

- [ ] **Step 2: コミット & push**

```bash
git add docs/TODO.md
git commit -m "docs(todo): ダメージ値変化アニメーション 完了記録"
git push origin main
```

- [ ] **Step 3: ユーザーに完了報告**

完了内容と次セッション用引き継ぎを伝える。

---

## エッジケース・補足

### A. シールド吸収量・軽減%表示はアニメ対象外
[src/components/TimelineRow.tsx:548-555](../../../src/components/TimelineRow.tsx#L548-L555) の「▼ 19%」「🛡 72,738」表示は今回触らない（仕様通り）。

### B. 「無敵」表示への切替
`damages[0].isInvincible` が true のとき [src/components/TimelineRow.tsx:543-547](../../../src/components/TimelineRow.tsx#L543-L547) で「Invuln」テキストが出る。AnimatedDamage は値ベースなので、無敵切替は親の条件分岐で処理される（既存挙動維持）。

### C. 致死赤の遷移タイミング
緑→赤切替は AnimatedDamage の className 変更で即時反映される。Exit 中に色が変わると違和感が出る可能性あるが、ユーザーが軽減を配置した瞬間に致死判定が変わるケースは稀（1 軽減で致死→致死外になる事は限定的）。問題が出たら別セッションで調整。

### D. テストで scope 外のもの
- 実際のアニメーション完了の visual 確認（CSS animations は jsdom/happy-dom で発火しない）
- prefers-reduced-motion CSS の効果確認（CSS媒体クエリは手動確認）
- 60FPS 維持の機械的確認（手動 DevTools 確認で代替）
