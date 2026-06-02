# 動画埋め込み式 タイムライン作成モーダル 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 動画を LoPo 内に埋め込み、動画と連動してタイムラインを作成できる中央モーダルを追加し、既存の Document PiP レコーダーを置き換える。

**Architecture:** 中央モーダル `VideoRecorderModal`(左=URL貼付→youtube-nocookie 埋め込み、右=記録UI+EventForm)。時刻は「動画の現在位置 − 戦闘開始位置」で算出(`useYouTubePlayer` フックが IFrame Player API を制御)。記録UIは前段の `PipRecorder` の構造を流用しつつ、タイミング源を動画位置にしてモーダル内へ統合し、`PipRecorder` は削除する。

**Tech Stack:** React 19 + TypeScript / Zustand / react-i18next / framer-motion / YouTube IFrame Player API / vitest + @testing-library/react (happy-dom)

設計書: `docs/superpowers/specs/2026-06-02-video-recorder-modal-design.md`

---

## ファイル構成

- **新規** `src/utils/youtube.ts` — `parseYouTubeId(url)` 純粋関数
- **新規** `src/utils/__tests__/youtube.test.ts`
- **新規** `src/hooks/useYouTubePlayer.ts` — IFrame API ロード + プレイヤー制御フック
- **新規** `src/components/VideoRecorderModal.tsx` — モーダル(左=動画 / 右=記録UI)
- **新規** `src/components/__tests__/VideoRecorderModal.test.tsx` — フック mock で書き込み経路を検証
- **改修** `src/components/Timeline.tsx` — メニュー「動画を見ながらイベント追加」でモーダルを開く。Document PiP レコーダー経路を撤去
- **削除** `src/components/PipRecorder.tsx` / `src/components/__tests__/PipRecorder.test.tsx`(モーダルへ統合)
- **改修** `src/locales/{ja,en,zh,ko}.json` — `timeline.recorder.*` に動画URL関連キー追加
- **改修** `vercel.json` — CSP `script-src` に `https://www.youtube.com` 追加

---

## Task 1: CSP に YouTube IFrame API を許可

**Files:**
- Modify: `vercel.json`(`Content-Security-Policy` ヘッダの `script-src`)

- [ ] **Step 1: script-src に www.youtube.com を追加**

`vercel.json` の CSP 値内、`script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.googletagmanager.com` を次に変更(末尾に `https://www.youtube.com` を追加):

```
script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.googletagmanager.com https://www.youtube.com
```

`frame-src` は既に `https://www.youtube-nocookie.com` を含むため変更不要。

- [ ] **Step 2: JSON 妥当性確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
rtk git add vercel.json
rtk git commit -m "chore(csp): YouTube IFrame API 用に script-src へ www.youtube.com を追加"
```

---

## Task 2: i18n キー追加(動画URL関連)

**Files:**
- Modify: `src/locales/ja.json` / `en.json` / `zh.json` / `ko.json`(各 `timeline.recorder` オブジェクト内)

- [ ] **Step 1: ja.json の `timeline.recorder` に追記**

`"write": "表に書き込む"` の後にカンマを付け、以下を追加:

```json
"video_url_placeholder": "ここに動画URLを貼ってください",
"video_load": "読み込む",
"video_change": "別の動画",
"video_url_error": "YouTube の URL を確認してください",
"video_hint": "動画を再生し、戦闘が始まったら「スタート」を押してください"
```

- [ ] **Step 2: en.json に追加**

```json
"video_url_placeholder": "Paste a YouTube URL here",
"video_load": "Load",
"video_change": "Change video",
"video_url_error": "Please check the YouTube URL",
"video_hint": "Play the video and press Start when the fight begins"
```

- [ ] **Step 3: zh.json に追加**

```json
"video_url_placeholder": "在此粘贴 YouTube 链接",
"video_load": "加载",
"video_change": "更换视频",
"video_url_error": "请检查 YouTube 链接",
"video_hint": "播放视频，战斗开始时按「开始」"
```

- [ ] **Step 4: ko.json に追加**

```json
"video_url_placeholder": "여기에 YouTube URL을 붙여넣기",
"video_load": "불러오기",
"video_change": "다른 영상",
"video_url_error": "YouTube URL을 확인해 주세요",
"video_hint": "영상을 재생하고 전투가 시작되면 '시작'을 누르세요"
```

- [ ] **Step 5: 4言語の妥当性 + パリティ確認**

Run: `node -e "['ja','en','zh','ko'].forEach(f=>{const r=require('./src/locales/'+f+'.json').timeline.recorder; ['video_url_placeholder','video_load','video_change','video_url_error','video_hint'].forEach(k=>{if(!r[k])throw new Error(f+' missing '+k)}); console.log(f,'ok')})"`
Expected: 各言語 `ok`

- [ ] **Step 6: Commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
rtk git commit -m "feat(i18n): 動画レコーダー用 URL 関連キーを4言語追加"
```

---

## Task 3: `parseYouTubeId` 純粋関数 (TDD)

**Files:**
- Create: `src/utils/youtube.ts`
- Test: `src/utils/__tests__/youtube.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/youtube.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseYouTubeId } from '../youtube';

describe('parseYouTubeId', () => {
    it('youtu.be 短縮URL', () => {
        expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('watch?v= 形式', () => {
        expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('watch?v= に余分なクエリ(t,list)が付いても抽出', () => {
        expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s&list=ABC')).toBe('dQw4w9WgXcQ');
    });
    it('youtu.be にタイムスタンプ付き', () => {
        expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    });
    it('embed 形式', () => {
        expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('shorts 形式', () => {
        expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('m.youtube.com', () => {
        expect(parseYouTubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('生の11文字ID', () => {
        expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('不正なURLは null', () => {
        expect(parseYouTubeId('https://example.com/watch?v=xxx')).toBeNull();
    });
    it('空文字は null', () => {
        expect(parseYouTubeId('')).toBeNull();
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/youtube.test.ts`
Expected: FAIL（`youtube` モジュールが存在しない）

- [ ] **Step 3: 実装**

`src/utils/youtube.ts`:

```ts
const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** YouTube の各種 URL から動画 ID(11文字)を抽出する。抽出不可は null。 */
export function parseYouTubeId(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (ID_RE.test(trimmed)) return trimmed;
    try {
        const u = new URL(trimmed);
        const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
        if (host === 'youtu.be') {
            const id = u.pathname.slice(1).split('/')[0];
            return ID_RE.test(id) ? id : null;
        }
        if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            if (u.pathname === '/watch') {
                const v = u.searchParams.get('v');
                return v && ID_RE.test(v) ? v : null;
            }
            const m = u.pathname.match(/^\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
            if (m) return m[2];
        }
        return null;
    } catch {
        return null;
    }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/youtube.test.ts`
Expected: PASS（10 件）

- [ ] **Step 5: Commit**

```bash
rtk git add src/utils/youtube.ts src/utils/__tests__/youtube.test.ts
rtk git commit -m "feat(youtube): 動画URLからID抽出する parseYouTubeId を追加"
```

---

## Task 4: `useYouTubePlayer` フック

**Files:**
- Create: `src/hooks/useYouTubePlayer.ts`

> 外部 API(YT グローバル)に依存するため単体テストは行わず、Task 5/7 の実機 E2E で検証する。実装は防御的に(try/catch・null チェック)。

- [ ] **Step 1: 実装**

`src/hooks/useYouTubePlayer.ts`:

```ts
import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
    interface Window {
        YT?: any;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let apiPromise: Promise<void> | null = null;

/** YouTube IFrame Player API スクリプトを一度だけロードする。 */
function loadYouTubeApi(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise<void>((resolve) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    });
    return apiPromise;
}

export interface YouTubePlayerApi {
    ready: boolean;
    isPlaying: boolean;
    play: () => void;
    pause: () => void;
    getCurrentTime: () => number;
}

/** hostRef の中に youtube-nocookie プレイヤーを生成し、制御メソッドを返す。 */
export function useYouTubePlayer(
    hostRef: React.RefObject<HTMLDivElement | null>,
    videoId: string | null,
): YouTubePlayerApi {
    const playerRef = useRef<any>(null);
    const [ready, setReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (!videoId || !hostRef.current) return;
        let cancelled = false;
        let player: any = null;
        loadYouTubeApi().then(() => {
            if (cancelled || !hostRef.current || !window.YT) return;
            const el = document.createElement('div');
            hostRef.current.innerHTML = '';
            hostRef.current.appendChild(el);
            player = new window.YT.Player(el, {
                videoId,
                host: 'https://www.youtube-nocookie.com',
                width: '100%',
                height: '100%',
                playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
                events: {
                    onReady: () => { if (!cancelled) { playerRef.current = player; setReady(true); } },
                    onStateChange: (e: any) => {
                        if (cancelled || !window.YT) return;
                        setIsPlaying(e.data === window.YT.PlayerState.PLAYING);
                    },
                },
            });
        });
        return () => {
            cancelled = true;
            setReady(false);
            setIsPlaying(false);
            try { if (player && player.destroy) player.destroy(); } catch { /* noop */ }
            playerRef.current = null;
        };
    }, [videoId, hostRef]);

    const play = useCallback(() => { try { playerRef.current?.playVideo?.(); } catch { /* noop */ } }, []);
    const pause = useCallback(() => { try { playerRef.current?.pauseVideo?.(); } catch { /* noop */ } }, []);
    const getCurrentTime = useCallback(() => {
        try { return playerRef.current?.getCurrentTime?.() ?? 0; } catch { return 0; }
    }, []);

    return { ready, isPlaying, play, pause, getCurrentTime };
}
```

- [ ] **Step 2: 型チェック**

Run: `npm run build`
Expected: 成功(未使用・型エラーなし)

- [ ] **Step 3: Commit**

```bash
rtk git add src/hooks/useYouTubePlayer.ts
rtk git commit -m "feat(youtube): IFrame Player API を制御する useYouTubePlayer フックを追加"
```

---

## Task 5: `VideoRecorderModal` コンポーネント

**Files:**
- Create: `src/components/VideoRecorderModal.tsx`
- Test: `src/components/__tests__/VideoRecorderModal.test.tsx`

- [ ] **Step 1: 失敗するテストを書く(フック mock)**

`src/components/__tests__/VideoRecorderModal.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, opt?: any) => (opt?.count !== undefined ? `${k}:${opt.count}` : k), i18n: { language: 'ja' } }),
}));
// 動画プレイヤーは固定値を返すスタブ(getCurrentTime=15 固定)
vi.mock('../../hooks/useYouTubePlayer', () => ({
    useYouTubePlayer: () => ({ ready: true, isPlaying: false, play: () => {}, pause: () => {}, getCurrentTime: () => 15 }),
}));

import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import VideoRecorderModal from '../VideoRecorderModal';

beforeEach(() => {
    usePlanStore.setState({ currentPlanId: 'plan_test', plans: [] } as any);
    useMitigationStore.setState({ timelineEvents: [] } as any);
});

describe('VideoRecorderModal', () => {
    it('プラン未選択なら案内を表示', () => {
        usePlanStore.setState({ currentPlanId: null, plans: [] } as any);
        render(<VideoRecorderModal isOpen onClose={() => {}} />);
        expect(screen.getByText('timeline.recorder.no_plan')).toBeTruthy();
    });

    it('URL読込→スタート→イベント追加→表に書き込む で addEvent される', () => {
        render(<VideoRecorderModal isOpen onClose={() => {}} />);
        // URL 入力 → 読み込む
        const input = screen.getByPlaceholderText('timeline.recorder.video_url_placeholder') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
        fireEvent.click(screen.getByText('timeline.recorder.video_load'));
        // スタート(戦闘開始)
        fireEvent.click(screen.getByText('timeline.recorder.start'));
        // ＋イベント追加
        fireEvent.click(screen.getByText('timeline.recorder.add_event'));
        // フォームで技名入力 → 表に書き込む
        const nameInput = document.querySelector('[data-tutorial="event-name-input"]') as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'テスト攻撃' } });
        fireEvent.click(screen.getByText('timeline.recorder.write'));
        expect(useMitigationStore.getState().timelineEvents.length).toBe(1);
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/VideoRecorderModal.test.tsx`
Expected: FAIL（`VideoRecorderModal` 未実装）

- [ ] **Step 3: 実装**

`src/components/VideoRecorderModal.tsx`:

```tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Play, Pause, RotateCcw, Plus, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { parseYouTubeId } from '../utils/youtube';
import { formatStopwatch, snapToSecond } from '../utils/stopwatch';
import EventForm from './EventForm';
import type { TimelineEvent } from '../types';

const genId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).slice(2, 9);

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const VideoRecorderModal: React.FC<Props> = ({ isOpen, onClose }) => {
    useEscapeClose(isOpen, onClose);
    const { t, i18n } = useTranslation();
    const lang = (i18n.language || 'ja') as 'ja' | 'en' | 'zh' | 'ko';

    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
    const addEvent = useMitigationStore(s => s.addEvent);
    const undo = useMitigationStore(s => s.undo);
    const eventCount = useMitigationStore(s => s.timelineEvents.length);

    const planTitle = currentPlan?.title ?? '';
    const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : undefined;
    const contentName = contentDef
        ? (contentDef.name[lang] || contentDef.name.ja || contentDef.name.en || '')
        : (currentPlan?.contentId ?? '');

    // 動画
    const [urlInput, setUrlInput] = useState('');
    const [videoId, setVideoId] = useState<string | null>(null);
    const [urlError, setUrlError] = useState(false);
    const playerHostRef = useRef<HTMLDivElement>(null);
    const { play, pause, getCurrentTime, isPlaying } = useYouTubePlayer(playerHostRef, videoId);

    // 時刻(動画位置基準)
    const [combatStartSec, setCombatStartSec] = useState<number | null>(null);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [formTime, setFormTime] = useState<number | null>(null);

    useEffect(() => {
        if (combatStartSec == null) { setElapsedSec(0); return; }
        const id = setInterval(() => {
            setElapsedSec(Math.max(0, getCurrentTime() - combatStartSec));
        }, 200);
        return () => clearInterval(id);
    }, [combatStartSec, getCurrentTime]);

    const handleLoadUrl = useCallback(() => {
        const id = parseYouTubeId(urlInput);
        if (!id) { setUrlError(true); return; }
        setUrlError(false);
        setVideoId(id);
        setCombatStartSec(null);
    }, [urlInput]);

    const handleChangeVideo = useCallback(() => {
        setVideoId(null);
        setCombatStartSec(null);
        setUrlInput('');
    }, []);

    const handleStart = useCallback(() => { setCombatStartSec(getCurrentTime()); }, [getCurrentTime]);
    const handleReset = useCallback(() => { setCombatStartSec(null); }, []);
    const handleTogglePlay = useCallback(() => { if (isPlaying) pause(); else play(); }, [isPlaying, play, pause]);
    const handleAddEvent = useCallback(() => {
        pause();
        const base = combatStartSec ?? getCurrentTime();
        setFormTime(snapToSecond(Math.max(0, getCurrentTime() - base)));
    }, [pause, combatStartSec, getCurrentTime]);

    const writeToSheet = useCallback((ev: Omit<TimelineEvent, 'id'>) => {
        addEvent({ ...ev, id: genId() });
        setFormTime(null);
    }, [addEvent]);

    if (!isOpen) return null;

    const combatStarted = combatStartSec != null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/50 cursor-pointer"
                />
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="relative glass-tier3 rounded-2xl shadow-2xl w-full max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col"
                    style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
                >
                    {/* ヘッダ */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-glass-border/30 shrink-0">
                        <h2 className="text-app-lg font-black text-app-text tracking-wider">{t('timeline.recorder.menu_record')}</h2>
                        <button onClick={onClose} className="p-2 rounded-full text-app-text/60 hover:text-app-text hover:bg-app-text/10 transition-colors cursor-pointer active:scale-90">
                            <X size={18} />
                        </button>
                    </div>

                    {/* 本体: 左=動画 / 右=記録 */}
                    <div className="flex flex-col md:flex-row gap-4 p-4 overflow-y-auto">
                        {/* 左: 動画 */}
                        <div className="md:flex-[2] min-w-0">
                            {!videoId ? (
                                <div className="flex flex-col gap-3 h-full justify-center">
                                    <label className="text-app-md font-bold text-app-text/80">{t('timeline.recorder.video_url_placeholder')}</label>
                                    <input
                                        type="text"
                                        value={urlInput}
                                        onChange={(e) => { setUrlInput(e.target.value); setUrlError(false); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleLoadUrl(); }}
                                        placeholder={t('timeline.recorder.video_url_placeholder')}
                                        className="w-full rounded-lg p-3 bg-app-surface2 border border-app-border text-app-text focus:outline-none focus:border-app-text"
                                    />
                                    {urlError && <span className="text-app-base text-app-red">{t('timeline.recorder.video_url_error')}</span>}
                                    <button onClick={handleLoadUrl} className="self-start rounded-lg bg-app-blue px-5 py-2.5 text-white font-bold hover:bg-app-blue-hover active:scale-95 cursor-pointer">
                                        {t('timeline.recorder.video_load')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <div ref={playerHostRef} className="w-full aspect-video bg-black rounded-lg overflow-hidden" />
                                    <button onClick={handleChangeVideo} className="self-start text-app-base text-app-text/60 hover:text-app-text underline cursor-pointer">
                                        {t('timeline.recorder.video_change')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 右: 記録 */}
                        <div className="md:flex-1 min-w-0 md:max-w-[340px] flex flex-col">
                            {!currentPlanId ? (
                                <div className="flex flex-1 items-center justify-center p-4 text-center text-app-text/70 text-app-md">
                                    {t('timeline.recorder.no_plan')}
                                </div>
                            ) : formTime !== null ? (
                                <EventForm
                                    variant="pip"
                                    reverseOnly
                                    initialTime={formTime}
                                    labels={{ saveButtonKey: 'timeline.recorder.write' }}
                                    onSave={writeToSheet}
                                    onCancel={() => setFormTime(null)}
                                />
                            ) : (
                                <div className="flex flex-col gap-3 p-2">
                                    {/* 見出し */}
                                    <div className="text-center leading-tight">
                                        {contentName && <div className="text-app-base text-app-text/50 truncate">{contentName}</div>}
                                        {planTitle && <div className="text-app-md font-bold text-app-text/80 truncate">{planTitle}</div>}
                                    </div>
                                    {/* ストップウォッチ */}
                                    <div className="w-full text-center font-mono font-bold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontFeatureSettings: '"tnum" 1' }}>
                                        {formatStopwatch(elapsedSec)}
                                    </div>
                                    {!combatStarted ? (
                                        <>
                                            <p className="text-app-base text-app-text/50 text-center">{t('timeline.recorder.video_hint')}</p>
                                            <button onClick={handleStart} className="w-full rounded-xl bg-app-blue py-4 text-app-2xl font-bold text-white hover:bg-app-blue-hover active:scale-95 cursor-pointer">
                                                {t('timeline.recorder.start')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={handleTogglePlay} className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer">
                                                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                                    {isPlaying ? t('timeline.recorder.pause') : t('timeline.recorder.start')}
                                                </button>
                                                <button onClick={handleReset} className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer">
                                                    <RotateCcw size={16} /> {t('timeline.recorder.reset')}
                                                </button>
                                            </div>
                                            <button onClick={handleAddEvent} className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-blue py-4 text-app-2xl font-bold text-white hover:bg-app-blue-hover active:scale-95 cursor-pointer">
                                                <Plus size={20} /> {t('timeline.recorder.add_event')}
                                            </button>
                                            <div className="flex w-full items-center justify-between text-app-base text-app-text/60">
                                                <span>{t('timeline.recorder.recorded_count', { count: eventCount })}</span>
                                                <button onClick={() => undo()} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-app-text/10 active:scale-95 cursor-pointer">
                                                    <Undo2 size={14} /> {t('timeline.recorder.undo')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default VideoRecorderModal;
```

> 注: 再生/一時停止トグルのラベルは、停止中は「スタート」キー(`start`)を流用して「再生」の意で表示する。専用「再生」キーが欲しければ後日追加(YAGNI)。`combatStarted` 後の「スタート」ボタンは出さず、トグル+リセットに切り替わる。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/VideoRecorderModal.test.tsx`
Expected: PASS（2 件）

- [ ] **Step 5: 型チェック**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/VideoRecorderModal.tsx src/components/__tests__/VideoRecorderModal.test.tsx
rtk git commit -m "feat(video): 動画埋め込み式タイムライン作成モーダルを追加"
```

---

## Task 6: Timeline 統合 + PipRecorder 撤去

**Files:**
- Modify: `src/components/Timeline.tsx`
- Delete: `src/components/PipRecorder.tsx`, `src/components/__tests__/PipRecorder.test.tsx`

- [ ] **Step 1: PipRecorder の lazy import を VideoRecorderModal に置換**

`src/components/Timeline.tsx` の `const PipRecorder = React.lazy(() => import('./PipRecorder'));` を削除し、ファイル冒頭の他 import 群に追加(lazy 不要・モーダルは通常 import で可、ただし既存パターンに合わせ lazy でもよい。ここでは通常 import):

```tsx
import VideoRecorderModal from './VideoRecorderModal';
```

- [ ] **Step 2: モーダル開閉 state を追加**

`const [pipMode, ...]` 付近(PiP state 群)に追加:

```tsx
const [videoModalOpen, setVideoModalOpen] = useState(false);
```

- [ ] **Step 3: メニューの「動画を見ながらイベント追加」をモーダル起動に変更**

ポップアップメニュー内の recorder 項目の `onClick` を変更(`handleOpenPip('recorder')` をやめてモーダルを開く):

```tsx
<button
    onClick={() => { setPipMenuOpen(false); setVideoModalOpen(true); }}
    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-app-md text-app-text whitespace-nowrap hover:bg-glass-hover transition-colors cursor-pointer"
>
    {t('timeline.recorder.menu_record')}
</button>
```

「カンペ」項目(`handleOpenPip('cue')`)はそのまま。

- [ ] **Step 4: Document PiP の recorder 分岐を撤去**

PiP Portal のレンダリングを、recorder 分岐を消して cue のみに:

```tsx
{pipContainer && createPortal(
    <React.Suspense fallback={null}>
        <PipView mode="pip" onClose={handleClosePip} />
    </React.Suspense>,
    pipContainer
)}
```

`handleOpenPip` の引数 `mode` は 'cue' のみ呼ばれるが、シグネチャは現状維持で可(サイズ分岐の recorder 経路は未使用になるだけ)。`pipMode` state は cue 固定になるが残してよい(撤去は任意・YAGNI で残置)。

- [ ] **Step 5: モーダルを描画**

PiP Portal の近く(コンポーネント return 内、他モーダルと並ぶ場所)に追加:

```tsx
<VideoRecorderModal isOpen={videoModalOpen} onClose={() => setVideoModalOpen(false)} />
```

- [ ] **Step 6: PipRecorder とそのテストを削除**

```bash
rm src/components/PipRecorder.tsx src/components/__tests__/PipRecorder.test.tsx
```

- [ ] **Step 7: 型チェック + テスト**

Run: `npm run build`
Expected: 成功(PipRecorder への参照が残っていないこと)

Run: `npx vitest run src/components/__tests__/VideoRecorderModal.test.tsx src/components/__tests__/Timeline.layout.test.tsx`
Expected: 両方 PASS

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/Timeline.tsx
rtk git rm src/components/PipRecorder.tsx src/components/__tests__/PipRecorder.test.tsx
rtk git commit -m "feat(video): メニューから動画モーダルを起動。Document PiP レコーダーを撤去"
```

---

## Task 7: 総合検証(実機 E2E)

**Files:** なし(検証のみ)

- [ ] **Step 1: ビルド + 全テスト**

Run: `npm run build && npx vitest run`
Expected: build 成功 / テストは新規(youtube 10・VideoRecorderModal 2)含め green(既存 housing 5 失敗は pre-existing・無関係)

- [ ] **Step 2: Chrome 実機 E2E(本番 or dev)**

1. プラン作成(空タイムライン)
2. PiP アイコンにホバー →「動画を見ながらイベント追加」→ モーダルが中央に開く
3. 左に YouTube URL を貼付 → 読み込む → プレイヤー表示(**CSP 違反がコンソールに出ないこと**)
4. 動画再生(native コントロール)→ 戦闘開始の瞬間に「スタート」
5. ＋イベント追加 → 動画一時停止 + 時刻が整数秒で自動入力 → 技名等入力 → 表に書き込む
6. 裏の軽減表に**整数秒の行が出る** / 件数増 / 取消で消える
7. 再開で動画再生 + ストップウォッチ追従 / native シーク・10秒戻ししても時刻が正確
8. リセット → 次の戦闘開始で再スタート
9. 「別の動画」で URL 再入力できる

- [ ] **Step 3: TODO 更新 + 最終コミット/push**

`docs/TODO.md` の「現在の状態」を更新。

```bash
rtk git add -A
rtk git commit -m "docs: 動画モーダル実装完了を TODO へ反映"
rtk git push origin main
```

---

## Self-Review(計画作成者によるチェック結果)

- **Spec coverage:** モーダル(Task5)/ URL貼付+youtube-nocookie+native(Task4,5)/ 動画位置基準の時刻・スタート/＋/再開/リセット(Task5)/ 整数秒(snapToSecond, Task5)/ 右UI+EventForm流用(Task5)/ Document PiP レコーダー置換(Task6)/ CSP(Task1)/ i18n 4言語(Task2)/ parseYouTubeId(Task3)/ 検証・E2E(Task7)。spec 全項目に対応。
- **Placeholder scan:** TBD/TODO なし。各 step に実コード・実コマンド記載。
- **Type consistency:** `parseYouTubeId(url): string|null`(Task3) / `useYouTubePlayer(hostRef, videoId): {ready,isPlaying,play,pause,getCurrentTime}`(Task4)を Task5 が同シグネチャで使用。`snapToSecond`/`formatStopwatch`(既存)・`addEvent({...ev,id})`(既存)整合。i18n キー名(video_url_placeholder/video_load/video_change/video_url_error/video_hint)は Task2 定義と Task5 使用で一致。
