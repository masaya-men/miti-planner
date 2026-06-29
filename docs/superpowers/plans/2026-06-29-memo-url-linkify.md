# メモ内URLリンク化（軽量版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メモモードOFF（通常表示）のとき、メモ本文の `http(s)://` URL を青リンクにし、クリックで新しいタブを開けるようにする。

**Architecture:** 純関数 `parseMemoLinks(text)` がテキストを「URL/ただの文字」セグメントに分解（検証・末尾記号トリム込み）。表示コンポーネント `MemoText` がセグメントを描画し、URL は `<a target="_blank" rel="noopener noreferrer">`。`MemoOverlay` の **readonly 枝だけ** を `MemoText` に差し替える（編集中＝interactive 枝は不変）。

**Tech Stack:** React + TypeScript / vitest（純関数=既定env, コンポーネント=happy-dom）/ Tailwind v4 デザイントークン。

## Global Constraints

- 日本語でコメント・ドキュメントを書く。
- 色はトークン経由（`--color-app-blue`）。px/色のハードコード禁止。
- `http://` `https://` で始まる URL のみリンク化。`www.`（scheme無し）・`javascript:`・`data:` はリンクにしない。
- リンクは `target="_blank"` + `rel="noopener noreferrer"`。
- **interactive（メモモードON）の枝は一切変更しない**（クリック=編集モーダル/ドラッグ/右クリック削除の既存挙動を維持）。
- push 前に `npm run build`（Vercel は `tsc -b` 厳密）と `npx vitest run` が緑であること。
- 既存の挙動を壊さない。スコープ外（YouTube埋込/PiP/www./確認ワンクッション）に手を出さない。

---

### Task 1: 純関数 `parseMemoLinks`

**Files:**
- Create: `src/components/Memo/parseMemoLinks.ts`
- Test: `src/components/Memo/__tests__/parseMemoLinks.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MemoSegment =
    | { type: 'text'; value: string }
    | { type: 'url'; value: string };
  export function parseMemoLinks(text: string): MemoSegment[];
  ```
  - `url` セグメントの `value` は検証・末尾トリム済みの安全な http(s) URL。
  - 連続する text は1セグメントに結合される（描画が素直になる）。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/Memo/__tests__/parseMemoLinks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseMemoLinks } from '../parseMemoLinks';

describe('parseMemoLinks', () => {
  it('URLのみ → url セグメント1つ', () => {
    expect(parseMemoLinks('https://example.com')).toEqual([
      { type: 'url', value: 'https://example.com' },
    ]);
  });

  it('文章+URL+文章の混在を分解する', () => {
    expect(parseMemoLinks('見て https://a.com ここで軽減')).toEqual([
      { type: 'text', value: '見て ' },
      { type: 'url', value: 'https://a.com' },
      { type: 'text', value: ' ここで軽減' },
    ]);
  });

  it('1メモ内の複数URLをすべて拾う', () => {
    expect(parseMemoLinks('a https://x.com b https://y.com c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'url', value: 'https://x.com' },
      { type: 'text', value: ' b ' },
      { type: 'url', value: 'https://y.com' },
      { type: 'text', value: ' c' },
    ]);
  });

  it('全角括弧で囲まれたURLは括弧をリンクに含めない', () => {
    expect(parseMemoLinks('（https://example.com）')).toEqual([
      { type: 'text', value: '（' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '）' },
    ]);
  });

  it('末尾の句点はリンクに含めない', () => {
    expect(parseMemoLinks('https://example.com。')).toEqual([
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '。' },
    ]);
  });

  it('javascript: はリンクにしない(ただの文字)', () => {
    expect(parseMemoLinks('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('data: はリンクにしない', () => {
    expect(parseMemoLinks('data:text/html,x')).toEqual([
      { type: 'text', value: 'data:text/html,x' },
    ]);
  });

  it('www.(scheme無し) はリンクにしない', () => {
    expect(parseMemoLinks('www.example.com')).toEqual([
      { type: 'text', value: 'www.example.com' },
    ]);
  });

  it('ドットを含むただの文字を誤爆しない', () => {
    expect(parseMemoLinks('P12S.2 で 8.0 を使う')).toEqual([
      { type: 'text', value: 'P12S.2 で 8.0 を使う' },
    ]);
  });

  it('http(s)://で始まるが new URL で無効なものは文字扱い(二重ガード)', () => {
    expect(parseMemoLinks('https://[bad')).toEqual([
      { type: 'text', value: 'https://[bad' },
    ]);
  });

  it('空文字は空配列', () => {
    expect(parseMemoLinks('')).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/Memo/__tests__/parseMemoLinks.test.ts`
Expected: FAIL（`parseMemoLinks` が存在しない / Cannot find module）

- [ ] **Step 3: 最小実装を書く**

`src/components/Memo/parseMemoLinks.ts`:
```ts
// メモ本文を「URL」と「ただの文字」のセグメントに分解する純関数(React非依存・テスト容易)。
// http(s):// のみを URL とみなし、末尾の区切り記号はリンクから外す。new URL で protocol を再検証する。
export type MemoSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string };

// URL 末尾に付きがちな区切り記号(半角/全角の閉じ括弧・句読点など)。リンクには含めない。
const TRAILING_PUNCT = /[)\]）】」』。、，,.!！?？；;：:＞>]+$/;
// http(s):// で始まり空白までの連続。空白・全角文字は URL 文字でないので自然にそこで切れる。
const URL_CANDIDATE = /https?:\/\/[^\s]+/g;

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseMemoLinks(text: string): MemoSegment[] {
  const segments: MemoSegment[] = [];
  // 連続する text は結合する(描画が素直・テストが安定)。
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'text') last.value += value;
    else segments.push({ type: 'text', value });
  };

  let lastIndex = 0;
  for (const match of text.matchAll(URL_CANDIDATE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const url = raw.replace(TRAILING_PUNCT, ''); // 末尾記号を剥がす
    const trailing = raw.slice(url.length);       // 剥がした記号は後続テキストへ

    if (start > lastIndex) pushText(text.slice(lastIndex, start));
    if (url && isHttpUrl(url)) {
      segments.push({ type: 'url', value: url });
      pushText(trailing);
    } else {
      pushText(raw); // http(s) として無効 → まるごと文字
    }
    lastIndex = start + raw.length;
  }
  pushText(text.slice(lastIndex));
  return segments;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/components/Memo/__tests__/parseMemoLinks.test.ts`
Expected: PASS（11 件すべて緑）

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Memo/parseMemoLinks.ts src/components/Memo/__tests__/parseMemoLinks.test.ts
rtk git commit -m "feat(memo): メモ本文のURL分解 純関数parseMemoLinks(http(s)のみ・末尾記号トリム・二重ガード)"
```

---

### Task 2: `MemoText` 表示 + `MemoOverlay` 配線 + CSS

**Files:**
- Create: `src/components/Memo/MemoText.tsx`
- Create: `src/components/Memo/__tests__/MemoText.test.tsx`
- Modify: `src/components/Memo/MemoOverlay.tsx`（readonly 枝 162-164 行付近）
- Modify: `src/components/Memo/memo.css`（`.plan-memo__link` 追加）

**Interfaces:**
- Consumes（Task 1 より）: `parseMemoLinks(text: string): MemoSegment[]`
- Produces:
  ```tsx
  export const MemoText: React.FC<{ text: string }>;
  ```

- [ ] **Step 1: 失敗するテストを書く**

`src/components/Memo/__tests__/MemoText.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoText } from '../MemoText';

describe('MemoText', () => {
  it('URL部分を新タブ・noopenerの<a>で描く', () => {
    const { container } = render(<MemoText text="見て https://a.com ここで" />);
    const a = container.querySelector('a');
    expect(a).not.toBeNull();
    expect(a!.getAttribute('href')).toBe('https://a.com');
    expect(a!.getAttribute('target')).toBe('_blank');
    expect(a!.getAttribute('rel')).toBe('noopener noreferrer');
    // 文章部分はそのまま残る
    expect(container.textContent).toBe('見て https://a.com ここで');
  });

  it('javascript: はリンクにしない', () => {
    const { container } = render(<MemoText text="javascript:alert(1)" />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('javascript:alert(1)');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/Memo/__tests__/MemoText.test.tsx`
Expected: FAIL（`MemoText` が存在しない）

- [ ] **Step 3: `MemoText` を実装**

`src/components/Memo/MemoText.tsx`:
```tsx
// メモ本文を描画。通常表示(readonly)でのみ使う。URL は新タブで開くリンク、文字はそのまま。
// 危険対策: parseMemoLinks が http(s) のみを url にする + rel=noopener noreferrer。
import React from 'react';
import { parseMemoLinks } from './parseMemoLinks';

export const MemoText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {parseMemoLinks(text).map((seg, i) =>
      seg.type === 'url' ? (
        <a
          key={i}
          href={seg.value}
          target="_blank"
          rel="noopener noreferrer"
          className="plan-memo__link"
          // メモ枠への伝播を止める(readonly では枠側は no-op だが安全策)。
          onClick={(e) => e.stopPropagation()}
        >
          {seg.value}
        </a>
      ) : (
        <React.Fragment key={i}>{seg.value}</React.Fragment>
      ),
    )}
  </>
);
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/components/Memo/__tests__/MemoText.test.tsx`
Expected: PASS（2 件緑）

- [ ] **Step 5: `MemoOverlay` の readonly 枝を差し替え**

`src/components/Memo/MemoOverlay.tsx` 冒頭の import に追加:
```tsx
import { MemoText } from './MemoText';
```

readonly 枝（現状 162-164 行の `) : ( memo.text )`）を変更:
```tsx
                        {interactive ? (
                            <Tooltip
                                content={isDragging ? '' : t('memo.help_tooltip')}
                                wrapperClassName="!w-full"
                            >
                                <span className="block">{memo.text}</span>
                            </Tooltip>
                        ) : (
                            <MemoText text={memo.text} />
                        )}
```
（interactive 枝は変更しない。）

- [ ] **Step 6: `memo.css` にリンクのスタイルを追加（pointer-events 再有効化が肝）**

`src/components/Memo/memo.css` の末尾に追加:
```css
/* メモ内リンク。.plan-memo--readonly とスマホ(media)は pointer-events:none で
   クリックを下の表へ透過させるが、リンクだけは押せるよう auto に戻す。
   非リンク部分は透過のまま=表のクリックを邪魔しない。 */
.plan-memo__link {
    color: var(--color-app-blue);
    text-decoration: underline;
    pointer-events: auto;
    cursor: pointer;
    /* 200px 幅に収まらない長い URL を折り返す。 */
    word-break: break-all;
}
.plan-memo__link:hover {
    color: var(--color-app-blue-hover);
}
```

- [ ] **Step 7: ビルド + 全テスト（回帰確認）**

Run: `npm run build`
Expected: `tsc -b` 緑 + vite build 成功（既存の CSS/chunk 警告は無関係なので無視）

Run: `npx vitest run src/components/Memo/__tests__/parseMemoLinks.test.ts src/components/Memo/__tests__/MemoText.test.tsx`
Expected: PASS（合計 13 件緑）

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/Memo/MemoText.tsx src/components/Memo/__tests__/MemoText.test.tsx src/components/Memo/MemoOverlay.tsx src/components/Memo/memo.css
rtk git commit -m "feat(memo): 通常表示でメモ内URLをリンク化(MemoText・readonly枝のみ・linkはpointer-events:auto)"
```

---

## 実機確認（実装後・ユーザー）
1. デプロイ後、通常表示（メモモードOFF）で「`https://...` ここで軽減」のような混在メモを置く。
2. URL 部分だけ青リンク → クリックで新タブが開く。文章部分はクリックしても何も起きない（表のクリックを邪魔しない）。
3. メモモードON にすると、リンクにならず従来どおりクリック＝編集モーダル・ドラッグ移動・右クリック削除。
4. スマホ（通常表示）でリンクをタップ → 開く。

## Self-Review 結果
- **Spec coverage**: 受け入れ条件1〜6 すべて対応（1=Task2 Step5/6, 2/3=Task1 混在/複数テスト, 4=Task1 javascript/data/www テスト, 5=interactive枝不変, 6=Task2 Step7）。
- **Placeholder scan**: なし（全 step に実コード/実コマンド）。
- **Type consistency**: `MemoSegment`/`parseMemoLinks`/`MemoText` の名前と型は Task1→Task2 で一致。
- **追加の肝**: readonly/スマホの `pointer-events:none` を `.plan-memo__link { pointer-events:auto }` で上書きしないとリンクが押せない点を Task2 Step6 に明記。
