# PS5 ストラテジーボード貼り付けアシスト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PS5 プレイヤーがストラテジーボード共有コードをスマホで貼ると、安全な長さに分割して順番にコピーできる独立ページ `/stgy` を追加する。

**Architecture:** 完全クライアント側。純関数 `splitStrategyCode` で機械スライス → React ページ (ローカル state のみ) で表示・コピー進捗管理。ログイン/サーバー不要。入口は軽減「⋯」メニューと LP「Tools」カード。

**Tech Stack:** React + TypeScript, react-i18next, react-router-dom, vitest (happy-dom), lucide-react, clsx, Tailwind (LoPo デザイントークン)。

設計書: `docs/superpowers/specs/2026-06-29-ps5-strategy-board-paste-assist-design.md`

## Global Constraints

- UI テキストは全て i18n キー経由。`ja` / `en` 完備、`ko` / `zh` も同キーを追加し parity 維持。ロケール JSON は該当ブロックのみ textual 編集 (全体 parse→stringify 禁止)。
- デザインは LoPo 本体トンマナ: 白黒＋機能色のみ、色/フォントサイズは `text-app-*` / `--color-*` トークン経由、ハードコード禁止。Inter 禁止・AIグラデ禁止。
- スマホ専用 1 画面フロー型。PC では `max-w-[480px] mx-auto` で中央寄せして破綻回避。
- ボタン押下 `active:scale-95` (or `active:scale-[0.99]`)、ホバー `transition-all duration-200` / `transition-colors`。
- 安全マージン分割: 既定 `170` 文字 / 範囲 `80`〜`180`。値はハードコードせず定数化＋ユーザー調整可。
- push 前に `npm run build` (tsc -b 厳密) と `rtk vitest run` を通す。

---

### Task 1: 分割純関数 `strategyCode.ts`

**Files:**
- Create: `src/lib/strategyCode.ts`
- Test: `src/lib/__tests__/strategyCode.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_CHUNK_SIZE: number` (= 170), `MIN_CHUNK_SIZE: number` (= 80), `MAX_CHUNK_SIZE: number` (= 180)
  - `normalizeStrategyCode(raw: string): string` — 全空白除去
  - `splitStrategyCode(raw: string, chunkSize: number): string[]` — 正規化後を chunkSize 文字ごとに分割。`chunks.join('') === normalizeStrategyCode(raw)` 不変条件。

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/strategyCode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  splitStrategyCode,
  normalizeStrategyCode,
  DEFAULT_CHUNK_SIZE,
} from '../strategyCode';

describe('normalizeStrategyCode', () => {
  it('全空白文字を除去する', () => {
    expect(normalizeStrategyCode(' a\nb\tc ')).toBe('abc');
  });
});

describe('splitStrategyCode', () => {
  it('空入力は空配列', () => {
    expect(splitStrategyCode('', 170)).toEqual([]);
    expect(splitStrategyCode('  \n\t ', 170)).toEqual([]);
  });

  it('空白・改行を除去してから分割する', () => {
    expect(splitStrategyCode('abc\n def\tghi', 3)).toEqual(['abc', 'def', 'ghi']);
  });

  it('割り切れる長さ', () => {
    expect(splitStrategyCode('abcdef', 3)).toEqual(['abc', 'def']);
  });

  it('余りが出る長さ', () => {
    expect(splitStrategyCode('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
  });

  it('連結すると正規化後文字列に一致する（ラウンドトリップ不変条件）', () => {
    const raw = '[stgy:' + 'A'.repeat(600) + '+-_=]';
    const chunks = splitStrategyCode(raw, DEFAULT_CHUNK_SIZE);
    expect(chunks.join('')).toBe(normalizeStrategyCode(raw));
  });

  it('境界 80/170/180 で断片数が正しい', () => {
    const s = 'x'.repeat(360);
    expect(splitStrategyCode(s, 180).length).toBe(2); // 180,180
    expect(splitStrategyCode(s, 170).length).toBe(3); // 170,170,20
    expect(splitStrategyCode(s, 80).length).toBe(5);  // 80*4,40
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/lib/__tests__/strategyCode.test.ts`
Expected: FAIL（`../strategyCode` が存在しない）

- [ ] **Step 3: Write minimal implementation**

`src/lib/strategyCode.ts`:

```ts
// src/lib/strategyCode.ts
// FF14 ストラテジーボード共有コードを PS5 で貼りやすい長さに分割する純関数群。
// コードの中身は一切解釈しない（ただ刻むだけ）。

/** 1 断片あたりの既定文字数。PS5 の貼り付け上限(確認できた一次ソースで180)に対する安全マージン。 */
export const DEFAULT_CHUNK_SIZE = 170;
/** 調整スライダーの下限。 */
export const MIN_CHUNK_SIZE = 80;
/** 調整スライダーの上限。 */
export const MAX_CHUNK_SIZE = 180;

/**
 * 入力から全空白文字（スペース/改行/タブ等）を除去する。
 * フォーラム等からのコピペで改行が紛れ込むため。stgy コードは内部に空白を含まない
 * 連続トークンである前提（`+ - _ =` 等の記号は含み得るので除去しない）。
 */
export function normalizeStrategyCode(raw: string): string {
  return raw.replace(/\s/g, '');
}

/**
 * 正規化後の文字列を chunkSize 文字ごとに機械的に分割する。
 * 返り値を連結すると必ず正規化後文字列に一致する（区切り位置の特別配慮は不要）。
 */
export function splitStrategyCode(raw: string, chunkSize: number): string[] {
  const s = normalizeStrategyCode(raw);
  if (s.length === 0) return [];
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    chunks.push(s.slice(i, i + size));
  }
  return chunks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run src/lib/__tests__/strategyCode.test.ts`
Expected: PASS（全 6 ケース緑）

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/strategyCode.ts src/lib/__tests__/strategyCode.test.ts
rtk git commit -m "feat(stgy): ストラテジーボードコード分割の純関数+テスト"
```

---

### Task 2: i18n キー追加（ja / en / ko / zh）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

**Interfaces:**
- Produces: `stgy.*` キー群（page_title / heading / intro / prep_title / prep_body / prep_ack / paste_label / paste_placeholder / chunks_heading / copy_nth / copied / copied_toast / copy_failed / progress / done / reset / advanced / chunk_size_label / menu_label / lp_title / lp_desc）。`copy_nth` は `{{n}}`、`progress` は `{{done}}` `{{total}}` を補間。

- [ ] **Step 1: 各ロケールに `stgy` ブロックを追加**

各ファイルの既存 `"portal": { ... }` ブロックの直後（同じインデント階層）に、新しいトップレベルキー `"stgy"` を textual 挿入する。**ファイル全体を parse/stringify しない**。末尾カンマに注意。

`src/locales/ja.json`:

```json
  "stgy": {
    "page_title": "PS5 ストラテジーボード貼り付けアシスト | LoPo",
    "heading": "PS5 ストラテジーボード 貼り付けアシスト",
    "intro": "ネットで見つけたストラテジーボードの共有コードを貼ると、PS5で貼りやすい長さに分割します。上から順にコピーして、PS Remote Play でゲームに貼り付けてください。",
    "prep_title": "準備（初回だけ）",
    "prep_body": "PS Remote Play アプリの設定（右上の⚙）→「バックグラウンドストリーミング」をオンにしてください。\nこれでアプリを切り替えても最大5分つながったままになり、LoPo とゲームを往復してコピペできます。",
    "prep_ack": "OK・理解した",
    "paste_label": "コードを貼る",
    "paste_placeholder": "[stgy:... ここに共有コードを貼り付け ...]",
    "chunks_heading": "上から順にコピー",
    "copy_nth": "{{n}}番目をコピー",
    "copied": "コピー済み",
    "copied_toast": "コピーしました",
    "copy_failed": "コピーに失敗しました",
    "progress": "{{done}} / {{total}} コピー済",
    "done": "完了 🎉 すべて貼り付けました",
    "reset": "やり直す",
    "advanced": "文字数を調整",
    "chunk_size_label": "1回の文字数",
    "menu_label": "PS5 ストラテジーボード貼り付け",
    "lp_title": "ストラテジーボード貼り付け",
    "lp_desc": "PS5向け。ストラテジーボードの共有コードを貼りやすい長さに分割してコピー。"
  },
```

`src/locales/en.json`:

```json
  "stgy": {
    "page_title": "PS5 Strategy Board Paste Helper | LoPo",
    "heading": "PS5 Strategy Board Paste Helper",
    "intro": "Paste a Strategy Board share code and we'll split it into chunks that fit PS5's paste limit. Copy them in order and paste into the game via PS Remote Play.",
    "prep_title": "Setup (first time only)",
    "prep_body": "In the PS Remote Play app, open Settings (gear, top right) and turn on \"Background Streaming\".\nThis keeps the connection alive for up to 5 minutes when you switch apps, so you can go back and forth between LoPo and the game.",
    "prep_ack": "OK, got it",
    "paste_label": "Paste the code",
    "paste_placeholder": "[stgy:... paste the share code here ...]",
    "chunks_heading": "Copy in order",
    "copy_nth": "Copy #{{n}}",
    "copied": "Copied",
    "copied_toast": "Copied",
    "copy_failed": "Failed to copy",
    "progress": "{{done}} / {{total}} copied",
    "done": "Done 🎉 All pasted",
    "reset": "Start over",
    "advanced": "Adjust length",
    "chunk_size_label": "Chars per copy",
    "menu_label": "PS5 Strategy Board paste",
    "lp_title": "Strategy Board Paste",
    "lp_desc": "For PS5. Splits Strategy Board share codes into copy-friendly chunks."
  },
```

`src/locales/ko.json`:

```json
  "stgy": {
    "page_title": "PS5 스트래티지 보드 붙여넣기 도우미 | LoPo",
    "heading": "PS5 스트래티지 보드 붙여넣기 도우미",
    "intro": "스트래티지 보드 공유 코드를 붙여넣으면 PS5에서 붙여넣기 쉬운 길이로 분할합니다. 위에서부터 순서대로 복사해 PS Remote Play로 게임에 붙여넣으세요.",
    "prep_title": "준비 (처음 한 번만)",
    "prep_body": "PS Remote Play 앱 설정(오른쪽 위 ⚙)에서 \"백그라운드 스트리밍\"을 켜세요.\n앱을 전환해도 최대 5분간 연결이 유지되어 LoPo와 게임을 오가며 복사·붙여넣기를 할 수 있습니다.",
    "prep_ack": "확인했습니다",
    "paste_label": "코드 붙여넣기",
    "paste_placeholder": "[stgy:... 공유 코드를 여기에 붙여넣기 ...]",
    "chunks_heading": "순서대로 복사",
    "copy_nth": "{{n}}번째 복사",
    "copied": "복사됨",
    "copied_toast": "복사했습니다",
    "copy_failed": "복사에 실패했습니다",
    "progress": "{{done}} / {{total}} 복사됨",
    "done": "완료 🎉 모두 붙여넣었습니다",
    "reset": "다시 하기",
    "advanced": "글자 수 조정",
    "chunk_size_label": "한 번에 복사할 글자 수",
    "menu_label": "PS5 스트래티지 보드 붙여넣기",
    "lp_title": "스트래티지 보드 붙여넣기",
    "lp_desc": "PS5용. 스트래티지 보드 공유 코드를 복사하기 쉬운 길이로 분할."
  },
```

`src/locales/zh.json`:

```json
  "stgy": {
    "page_title": "PS5 战略板粘贴助手 | LoPo",
    "heading": "PS5 战略板粘贴助手",
    "intro": "粘贴战略板分享代码，我们会按 PS5 可粘贴的长度进行分割。请从上到下依次复制，并通过 PS Remote Play 粘贴到游戏中。",
    "prep_title": "准备（仅首次）",
    "prep_body": "在 PS Remote Play 应用的设置（右上角⚙）中开启“后台串流”。\n这样切换应用后最多可保持连接 5 分钟，便于在 LoPo 和游戏之间来回复制粘贴。",
    "prep_ack": "我知道了",
    "paste_label": "粘贴代码",
    "paste_placeholder": "[stgy:... 在此粘贴分享代码 ...]",
    "chunks_heading": "按顺序复制",
    "copy_nth": "复制第 {{n}} 个",
    "copied": "已复制",
    "copied_toast": "已复制",
    "copy_failed": "复制失败",
    "progress": "已复制 {{done}} / {{total}}",
    "done": "完成 🎉 已全部粘贴",
    "reset": "重新开始",
    "advanced": "调整字数",
    "chunk_size_label": "每次复制字数",
    "menu_label": "PS5 战略板粘贴",
    "lp_title": "战略板粘贴",
    "lp_desc": "适用于 PS5。将战略板分享代码分割为便于复制的片段。"
  },
```

- [ ] **Step 2: JSON が壊れていないか検証**

Run: `node -e "['ja','en','ko','zh'].forEach(l=>{const j=require('./src/locales/'+l+'.json'); if(!j.stgy||!j.stgy.copy_nth) throw new Error(l+' stgy missing'); }); console.log('ok')"`
Expected: `ok`（4ファイル全てに stgy ブロックが存在）

- [ ] **Step 3: Commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(stgy): 4言語の i18n キー追加"
```

---

### Task 3: ページ本体 `StrategyBoardPastePage.tsx`

**Files:**
- Create: `src/components/StrategyBoardPastePage.tsx`
- Test: `src/components/__tests__/StrategyBoardPastePage.test.tsx`

**Interfaces:**
- Consumes: `splitStrategyCode`, `DEFAULT_CHUNK_SIZE`, `MIN_CHUNK_SIZE`, `MAX_CHUNK_SIZE` (Task 1); `showToast` from `./Toast`.
- Produces: `export default function StrategyBoardPastePage(): JSX.Element`（default export）。

- [ ] **Step 1: Write the failing test**

`src/components/__tests__/StrategyBoardPastePage.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// i18n モック（補間対応）
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'stgy.page_title': 'PS5 貼り付けアシスト',
        'stgy.heading': '貼り付けアシスト',
        'stgy.intro': '説明',
        'stgy.prep_title': '準備',
        'stgy.prep_body': '準備本文',
        'stgy.prep_ack': 'OK',
        'stgy.paste_label': 'コードを貼る',
        'stgy.paste_placeholder': '[stgy:...]',
        'stgy.chunks_heading': '順にコピー',
        'stgy.copied': 'コピー済み',
        'stgy.copied_toast': 'コピーしました',
        'stgy.copy_failed': '失敗',
        'stgy.done': '完了',
        'stgy.reset': 'やり直す',
        'stgy.advanced': '文字数を調整',
        'stgy.chunk_size_label': '1回の文字数',
      };
      if (key === 'stgy.copy_nth') return `${opts?.n}番目をコピー`;
      if (key === 'stgy.progress') return `${opts?.done} / ${opts?.total} コピー済`;
      return map[key] ?? key;
    },
    i18n: { language: 'ja' },
  }),
}));

// Toast モック
const toastSpy = vi.fn();
vi.mock('../Toast', () => ({ showToast: (...a: unknown[]) => toastSpy(...a) }));

import StrategyBoardPastePage from '../StrategyBoardPastePage';

describe('StrategyBoardPastePage', () => {
  beforeEach(() => {
    toastSpy.mockClear();
    // clipboard モック
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    try { localStorage.clear(); } catch { /* noop */ }
  });

  it('コードを貼ると断片ボタンが生成される', () => {
    render(<StrategyBoardPastePage />);
    const textarea = screen.getByPlaceholderText('[stgy:...]');
    fireEvent.change(textarea, { target: { value: 'x'.repeat(360) } }); // 170区切り→3断片
    expect(screen.getByText('1番目をコピー')).toBeTruthy();
    expect(screen.getByText('2番目をコピー')).toBeTruthy();
    expect(screen.getByText('3番目をコピー')).toBeTruthy();
  });

  it('コピーボタン押下で clipboard に書き込み＋✅状態になる', async () => {
    render(<StrategyBoardPastePage />);
    const textarea = screen.getByPlaceholderText('[stgy:...]');
    fireEvent.change(textarea, { target: { value: 'x'.repeat(360) } });
    const btn = screen.getByText('1番目をコピー');
    fireEvent.click(btn);
    await Promise.resolve();
    expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('x'.repeat(170));
    expect(toastSpy).toHaveBeenCalledWith('コピーしました');
    expect(await screen.findByText('コピー済み')).toBeTruthy();
  });

  it('空入力では断片リストが出ない', () => {
    render(<StrategyBoardPastePage />);
    expect(screen.queryByText('順にコピー')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk vitest run src/components/__tests__/StrategyBoardPastePage.test.tsx`
Expected: FAIL（`../StrategyBoardPastePage` が存在しない）

- [ ] **Step 3: Write implementation**

`src/components/StrategyBoardPastePage.tsx`:

```tsx
// src/components/StrategyBoardPastePage.tsx
// PS5 ストラテジーボード貼り付けアシスト（スマホ専用・1画面フロー型・ログイン/サーバー不要）。
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Copy, Check, RotateCcw, ChevronDown } from 'lucide-react';
import { showToast } from './Toast';
import {
  splitStrategyCode,
  DEFAULT_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
} from '../lib/strategyCode';

/** 初回案内を畳んだことを覚える localStorage キー。 */
const BG_STREAM_ACK_KEY = 'stgy_bgstream_ack';

/** 断片プレビュー（長い時だけ先頭8 + … + 末尾6 に省略）。 */
function preview(chunk: string): string {
  if (chunk.length <= 16) return chunk;
  return `${chunk.slice(0, 8)}…${chunk.slice(-6)}`;
}

export default function StrategyBoardPastePage() {
  const { t, i18n } = useTranslation();
  const [raw, setRaw] = useState('');
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [copied, setCopied] = useState<Set<number>>(new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(BG_STREAM_ACK_KEY) !== '1'; } catch { return true; }
  });

  const chunks = useMemo(() => splitStrategyCode(raw, chunkSize), [raw, chunkSize]);

  // raw / chunkSize が変わったらコピー済みをリセット
  useEffect(() => { setCopied(new Set()); }, [raw, chunkSize]);

  // ページタイトル
  useEffect(() => { document.title = t('stgy.page_title'); }, [t, i18n.language]);

  const ackPrep = () => {
    setPrepOpen(false);
    try { localStorage.setItem(BG_STREAM_ACK_KEY, '1'); } catch { /* noop */ }
  };

  const handleCopy = async (index: number, chunk: string) => {
    try {
      await navigator.clipboard.writeText(chunk);
      setCopied(prev => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      showToast(t('stgy.copied_toast'));
    } catch {
      showToast(t('stgy.copy_failed'), 'error');
    }
  };

  const allDone = chunks.length > 0 && copied.size === chunks.length;

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <div className="mx-auto w-full max-w-[480px] px-4 py-6 flex flex-col gap-5">
        {/* 見出し */}
        <header className="flex flex-col gap-1">
          <h1 className="text-app-2xl font-bold">{t('stgy.heading')}</h1>
          <p className="text-app-base text-app-text-muted leading-relaxed">{t('stgy.intro')}</p>
        </header>

        {/* ① 準備（折りたたみ） */}
        <section className="rounded-lg border border-app-border bg-app-surface2/40">
          <button
            type="button"
            onClick={() => setPrepOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer"
          >
            <span className="text-app-lg font-bold">① {t('stgy.prep_title')}</span>
            <ChevronDown size={16} className={clsx('transition-transform duration-200', prepOpen && 'rotate-180')} />
          </button>
          {prepOpen && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              <p className="text-app-base text-app-text-muted leading-relaxed whitespace-pre-line">
                {t('stgy.prep_body')}
              </p>
              <button
                type="button"
                onClick={ackPrep}
                className="self-start px-3 py-1.5 rounded-md text-app-md font-bold bg-app-toggle text-app-toggle-text hover:opacity-80 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                {t('stgy.prep_ack')}
              </button>
            </div>
          )}
        </section>

        {/* ② コードを貼る */}
        <section className="flex flex-col gap-2">
          <label className="text-app-lg font-bold">② {t('stgy.paste_label')}</label>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={t('stgy.paste_placeholder')}
            rows={4}
            className="w-full rounded-lg border border-app-border bg-app-surface2/40 px-3 py-2 text-app-base text-app-text placeholder:text-app-text-muted resize-y focus:outline-none focus:border-app-text/40"
          />
        </section>

        {/* ③ 順にコピー */}
        {chunks.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-app-lg font-bold">③ {t('stgy.chunks_heading')}</span>
              <button
                type="button"
                onClick={() => setCopied(new Set())}
                className="flex items-center gap-1 text-app-md text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                {t('stgy.reset')}
              </button>
            </div>

            <ol className="flex flex-col gap-2">
              {chunks.map((chunk, i) => {
                const done = copied.has(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => handleCopy(i, chunk)}
                      className={clsx(
                        'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.99] cursor-pointer',
                        done
                          ? 'border-app-border bg-app-surface2/30 text-app-text-muted'
                          : 'border-app-border bg-app-surface2/50 text-app-text hover:bg-app-text/5'
                      )}
                    >
                      <span className={clsx(
                        'shrink-0 flex items-center justify-center w-5 h-5 rounded-full border',
                        done ? 'border-[#22c55e] text-[#22c55e]' : 'border-app-text/30 text-app-text-muted'
                      )}>
                        {done ? <Check size={12} /> : <span className="text-app-xs font-bold">{i + 1}</span>}
                      </span>
                      <span className="flex-1 min-w-0 truncate font-mono text-app-md text-app-text-muted">
                        {preview(chunk)}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-app-md font-bold">
                        <Copy size={13} />
                        {done ? t('stgy.copied') : t('stgy.copy_nth', { n: i + 1 })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* 進捗バー */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-app-surface2 overflow-hidden">
                <div
                  className="h-full bg-app-text transition-all duration-300"
                  style={{ width: `${(copied.size / chunks.length) * 100}%` }}
                />
              </div>
              <span className="text-app-md text-app-text-muted shrink-0">
                {t('stgy.progress', { done: copied.size, total: chunks.length })}
              </span>
            </div>
            {allDone && (
              <p className="text-center text-app-lg font-bold text-[#22c55e]">{t('stgy.done')}</p>
            )}

            {/* 詳細設定（折りたたみ） */}
            <div>
              <button
                type="button"
                onClick={() => setAdvancedOpen(o => !o)}
                className="flex items-center gap-1 text-app-md text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
              >
                <ChevronDown size={12} className={clsx('transition-transform duration-200', advancedOpen && 'rotate-180')} />
                {t('stgy.advanced')}
              </button>
              {advancedOpen && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-app-md text-app-text-muted shrink-0">{t('stgy.chunk_size_label')}</span>
                  <input
                    type="range"
                    min={MIN_CHUNK_SIZE}
                    max={MAX_CHUNK_SIZE}
                    value={chunkSize}
                    onChange={e => setChunkSize(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-app-md font-bold w-10 text-right">{chunkSize}</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk vitest run src/components/__tests__/StrategyBoardPastePage.test.tsx`
Expected: PASS（3 ケース緑）

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/StrategyBoardPastePage.tsx src/components/__tests__/StrategyBoardPastePage.test.tsx
rtk git commit -m "feat(stgy): 貼り付けアシストのページ本体+テスト"
```

---

### Task 4: ルート `/stgy` を追加

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `StrategyBoardPastePage` default export (Task 3)。

- [ ] **Step 1: import 追加**

`src/App.tsx` の上部、他のページ import 群（`SupportPage` 等）の近くに追加:

```tsx
import StrategyBoardPastePage from './components/StrategyBoardPastePage';
```

- [ ] **Step 2: Route 追加**

`src/App.tsx` の `<Route path="/support" ... />` の直後の行に追加:

```tsx
        <Route path="/stgy" element={<StrategyBoardPastePage />} />
```

- [ ] **Step 3: 型チェック**

Run: `rtk tsc`
Expected: エラー無し（未使用 import / 型不足が無い）

- [ ] **Step 4: Commit**

```bash
rtk git add src/App.tsx
rtk git commit -m "feat(stgy): /stgy ルート追加"
```

---

### Task 5: 軽減「⋯」メニューに入口を追加

**Files:**
- Modify: `src/components/HeaderToolsMenu.tsx`

**Interfaces:**
- Consumes: i18n キー `stgy.menu_label` (Task 2)。

- [ ] **Step 1: アイコン import を追加**

`src/components/HeaderToolsMenu.tsx` の lucide import 行を変更:

```tsx
import { MoreHorizontal, Wand2, Star, Eye, Check, ClipboardPaste } from 'lucide-react';
```

- [ ] **Step 2: メニュー項目を追加**

「進捗バーを表示」ボタン（`progress.show_bar`）の閉じ `</button>` の直後、メニュー `<div>` 内の末尾に追加:

```tsx
                    {/* PS5 ストラテジーボード貼り付けアシスト（別タブで開く＝軽減作業を壊さない） */}
                    <button
                        type="button"
                        onClick={() => { setOpen(false); window.open('/stgy', '_blank', 'noopener,noreferrer'); }}
                        className={itemClass}
                    >
                        <ClipboardPaste size={14} className="shrink-0 text-app-text-muted" />
                        <span className="flex-1">{t('stgy.menu_label')}</span>
                    </button>
```

- [ ] **Step 3: 型チェック**

Run: `rtk tsc`
Expected: エラー無し

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/HeaderToolsMenu.tsx
rtk git commit -m "feat(stgy): 軽減⋯メニューに貼り付けアシスト入口"
```

---

### Task 6: LP「Tools」に入口カードを追加

**Files:**
- Modify: `src/components/landing/LandingPage.tsx`

**Interfaces:**
- Consumes: i18n キー `stgy.lp_title` / `stgy.lp_desc` (Task 2)。既存 `ProjectCard` / `navigate`。

- [ ] **Step 1: ProjectCard 03 を追加**

`src/components/landing/LandingPage.tsx` の `number="02"` の `ProjectCard`（ハウジング）の閉じタグ `/>` の直後、`<div className="border-t" ... />` の直前に追加:

```tsx
          <ProjectCard
            number="03"
            title={t('stgy.lp_title')}
            desc={t('stgy.lp_desc')}
            onClick={() => navigate('/stgy')}
            badge="UTILITY"
          />
```

- [ ] **Step 2: 型チェック**

Run: `rtk tsc`
Expected: エラー無し

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/landing/LandingPage.tsx
rtk git commit -m "feat(stgy): LP Tools に貼り付けアシストカード追加"
```

---

### Task 7: 最終検証（build + 全テスト）

**Files:** なし（検証のみ）

- [ ] **Step 1: 本番ビルド（tsc 厳密）**

Run: `rtk npm run build`
Expected: 成功（型エラー・未使用変数エラー無し。[[feedback_vercel_tsc_strict]]）

- [ ] **Step 2: 全テスト**

Run: `rtk vitest run`
Expected: 新規 2 ファイル緑。既存 failure（`TopBar.test.tsx` 4件 / `HousingWorkspace.test.tsx` 1件）は本件と無関係なので許容。新たな失敗が無いこと。

- [ ] **Step 3: ローカル目視（任意・推奨）**

`npm run dev` → `/stgy` をスマホ幅（DevTools レスポンシブ or 実機）で開き、実際の `[stgy:...]` コードを貼って分割・コピー・進捗・やり直し・スライダーを確認。LP の 03 カードと軽減「⋯」メニューからの遷移も確認。

- [ ] **Step 4: （新規コミットが残っていれば）Commit**

検証で微修正した場合のみ:

```bash
rtk git add -A
rtk git commit -m "fix(stgy): 検証で見つかった微修正"
```

---

## Self-Review

**1. Spec coverage（設計書 §ごと）:**
- §3 ルーティング `/stgy` → Task 4 ✅
- §4 UI（準備折りたたみ/貼る/順にコピー/詳細設定スライダー）→ Task 3 ✅
- §5 分割ロジック（全空白除去＋機械スライス＋ラウンドトリップ）→ Task 1 ✅
- §6 状態管理（raw/chunkSize/copiedSet・変更でリセット）→ Task 3 ✅
- §7 入口（⋯メニュー別タブ / LP カード）→ Task 5・6 ✅
- §8 デザイン（トークン・白黒・max-w-480・active:scale）→ Task 3（Global Constraints）✅
- §9 多言語（ja/en/ko/zh・copy_nth/progress 補間）→ Task 2 ✅
- §11 受け入れ基準（build/vitest）→ Task 7 ✅

**2. Placeholder scan:** TBD/TODO 無し。全 step に実コード・実コマンド・期待値あり。

**3. Type consistency:** `splitStrategyCode(raw, chunkSize)` / `DEFAULT_CHUNK_SIZE` / `MIN_CHUNK_SIZE` / `MAX_CHUNK_SIZE` / `normalizeStrategyCode` は Task 1 定義と Task 3 利用で一致。ページは default export、Task 4 import と一致。i18n キー名は Task 2 定義と Task 3/5/6 利用で一致（`copy_nth` の `n`、`progress` の `done`/`total` 補間も一致）。
