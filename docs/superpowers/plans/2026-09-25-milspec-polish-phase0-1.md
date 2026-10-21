# MIL-SPEC 全体ブラッシュアップ Phase 0〜1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MIL-SPEC の新しい見た目の見本ページ(Phase 0)を作って masaya の承認を取り、本体に背景動画レイヤーをコスト対策込みで入れる(Phase 1)。

**Architecture:** 動画素材は ffmpeg スクリプトで再現可能に再エンコードし、`src/assets/milspec/` に置いて Vite の import で `/assets/`(ハッシュ付き・immutable)に出す。背景は新コンポーネント `MilspecBackdropVideo` を `MilspecLayout` の先頭に置く。`MilspecLayout` は `themeStyle==='military' && !isMobile` のときだけ描画される(`src/components/Layout.tsx:579`)。そのため、標準テーマとスマホでは動画要素が生成されず、ダウンロードも 0 になる。見本は本体と独立した単体 HTML。

**Tech Stack:** React 19 + Vite 7 + vite-plugin-pwa(workbox)/ vitest(happy-dom・pool vmThreads)/ Playwright 1.60(chromium)/ ffmpeg 8(winget・PATH 上にある)

**Spec:** `docs/superpowers/specs/2026-09-25-milspec-polish-design.md`

**この計画の範囲:** spec §9 の Phase 0 と Phase 1 だけ。Phase 2〜5(フレーム・パネル・配色・配線・スイッチ・大レバー)の具体的な CSS と DOM は、Phase 0 の見本が承認されて初めて決まる。そのため、**承認後に見本を正典として別の計画を書く**(今書くと、見本の反復で全部書き直しになる)。

## Global Constraints

- 標準テーマは 1px も変えない: `node scripts/milspec-sp2/standard-invariance.mjs` が exit 0
- 軍事テーマの既存操作: `node scripts/milspec-sp2/military-smoke.mjs` が exit 0
- 動画は標準テーマ・スマホ幅(<768px)でダウンロード 0
- 動画・poster は PWA precache に入れない(`vite.config.ts` の workbox `globPatterns` = `**/*.{js,css,html,png,svg,ico,woff2}`。**poster を png にしない・webp 固定**)
- 各エンコード成果物は 500KB 以下
- アニメーションは transform / opacity / stroke-dashoffset のみ。動画の上に backdrop-filter を重ねない
- CSS はすべて `.theme-military` 前置(`src/styles/military.css`)
- テストは `__tests__/` 配下。vitest は変更ファイルに絞って実行(フル実行は push 前ゲートのみ)
- 公開リポ: 見本 HTML と元動画はコミットしない(`docs/.private/` は gitignore 済・元動画は `Downloads/` のまま)
- コミットメッセージ末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- `rtk git commit -m` を使う(`-F -` の stdin は失敗する)

## Review Focus

1. **標準テーマの利用者が動画を 1 バイトも取らないこと**: 標準モードで `/miti` を開いたとき、`.mp4` / `.webm` / `wall-poster` へのリクエストが 0 件 → Task 4 の Playwright スクリプトで検証する
2. **Service Worker の precache に動画・poster が載らないこと**: `npm run build` 後の `dist/sw.js` に `wall` を含むエントリが無い → Task 4 で検証する
3. **別タブへ移って戻ったとき**: 非表示で pause し、表示に戻ったら再開する。「動きを減らす」設定のときは戻っても再開しない → Task 3 の単体テスト
4. **PC 幅からスマホ幅へリサイズしたとき**: MilspecLayout ごと外れるので動画要素も消える(既存のゲートに乗る)→ Task 3 で MilspecLayout 経由のテストを追加する
5. **動画が読み込めないとき**(回線不良・古いブラウザ): poster が出たまま画面は壊れない。再試行は 1 回まで(ハウジングの `useVideoLoadRecovery` を再利用)→ Task 3 で「active=true でフックが呼ばれる」ことを確認する

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| Create `scripts/milspec-polish/encode-wall-video.sh` | 元動画 → webm / mp4 / poster を再現可能に生成する |
| Create `src/assets/milspec/wall.webm` / `wall.mp4` / `wall-poster.webp` | エンコード成果物(コミットする) |
| Create `docs/.private/theme-refs/milspec-v2-mockup.html` | Phase 0 見本(gitignore・コミットしない) |
| Create `src/components/military/MilspecBackdropVideo.tsx` | 背景動画レイヤー(再生制御のみ) |
| Create `src/components/military/__tests__/MilspecBackdropVideo.test.tsx` | 単体テスト |
| Modify `src/components/housing/workspace/SceneryVideo.tsx:17` | `useVideoLoadRecovery` を `export` する(1 語追加・挙動不変) |
| Modify `src/components/military/MilspecLayout.tsx` | ルート直下の先頭に `<MilspecBackdropVideo />` |
| Modify `src/components/military/__tests__/MilspecLayout.test.tsx` | 背景レイヤーの存在をテスト |
| Modify `src/styles/military.css`(SP1 シェル節 `.milspec-app` の直後) | 背景の配置と暗幕 |
| Create `scripts/milspec-polish/no-video-in-standard.mjs` | 標準モードでの動画リクエスト 0 件と SW precache 除外を検証する |

---

### Task 1: 動画素材のエンコード(スクリプト + 成果物)

**Files:**
- Create: `scripts/milspec-polish/encode-wall-video.sh`
- Create: `src/assets/milspec/wall.webm`, `src/assets/milspec/wall.mp4`, `src/assets/milspec/wall-poster.webp`

**Interfaces:**
- Produces: `src/assets/milspec/wall.webm` / `wall.mp4` / `wall-poster.webp`(Task 2 と Task 3 が参照する)。環境変数 `BRIGHTNESS`(既定 -0.06)と `SATURATION`(既定 0.75)で暗さを調整でき、Task 2 の見本反復で値が変わったら再実行する。

- [ ] **Step 1: スクリプトを書く**

```bash
#!/usr/bin/env bash
# MIL-SPEC 背景動画(機械の壁)を配信用に再エンコードする。
# 使い方: bash scripts/milspec-polish/encode-wall-video.sh "<元動画.mp4>"
# 暗さ調整: BRIGHTNESS=-0.08 SATURATION=0.7 bash scripts/milspec-polish/encode-wall-video.sh "<元動画>"
# 音声は除去(-an)。poster は PWA precache 対象外の webp にする(png にすると全員に配られる)。
set -euo pipefail
SRC="${1:?元動画のパスを指定してください}"
OUT="$(cd "$(dirname "$0")/../.." && pwd)/src/assets/milspec"
BRIGHTNESS="${BRIGHTNESS:--0.06}"
SATURATION="${SATURATION:-0.75}"
VF="eq=brightness=${BRIGHTNESS}:saturation=${SATURATION}"
mkdir -p "$OUT"
ffmpeg -v error -y -i "$SRC" -an -vf "$VF" -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 -deadline good "$OUT/wall.webm"
ffmpeg -v error -y -i "$SRC" -an -vf "$VF" -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/wall.mp4"
ffmpeg -v error -y -i "$SRC" -vf "$VF" -frames:v 1 -q:v 70 "$OUT/wall-poster.webp"
for f in wall.webm wall.mp4 wall-poster.webp; do
  size=$(wc -c < "$OUT/$f")
  echo "$f $size bytes"
  if [ "$size" -gt 512000 ]; then echo "NG: $f が 500KB を超えています" >&2; exit 1; fi
done
echo OK
```

- [ ] **Step 2: 実行してサイズ上限を確認する**

Run: `bash scripts/milspec-polish/encode-wall-video.sh "C:/Users/masay/Downloads/$(ls /c/Users/masay/Downloads | grep '^Industrial_mechanical_wall')"`
Expected: 3 行のサイズ表示のあとに `OK`(exit 0)

- [ ] **Step 3: 音声トラックが無いことを確認する**

Run: `ffprobe -v error -show_entries stream=codec_type -of csv=p=0 src/assets/milspec/wall.mp4`
Expected: `video` の 1 行だけ

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/milspec-polish/encode-wall-video.sh src/assets/milspec/
rtk git commit -m "feat(milspec): 背景動画素材の再エンコードスクリプトと成果物(音声除去・500KB上限)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Phase 0 見本ページ(司令塔が直接作る・masaya 承認ゲート)

見た目の質そのものが成果物なので、サブエージェントには出さず司令塔(Opus)が作る。SP1 の教訓として、機能が揃っても見た目が見本に届かなければ不合格になる。

**Files:**
- Create: `docs/.private/theme-refs/milspec-v2-mockup.html`(単体。CSS/JS はファイル内。動画は `../../../src/assets/milspec/wall.webm` を相対参照)

**Interfaces:**
- Consumes: Task 1 の成果物
- Produces: Phase 2〜5 の正典。承認後、ここから次の計画を書く。

- [ ] **Step 1: 作業前に正典資料を読む**

`docs/.private/theme-refs/milspec-material-language.md`(末尾の 9 項目チェックリスト)と `milspec-mecha-language.md` §9「やってはいけない」。現行の `milspec-mockup.html` から、masaya が気に入っている要素(タービン・ステンシル・パネルライン)を把握する。

- [ ] **Step 2: 見本を作る。必須の構成**(spec の節番号どおり)

1. §1 の 5 層: 背景動画(暗幕トークン `--ms-backdrop-veil` で明るさ調整)/ フレーム + 隙間 / 装甲パネル / 配線 SVG / 操作部品 + タービン
2. 本体と同じゾーン配置: サイドバー / ヘッダー 2 段 / 表(本物の行を 12 行程度・時間・攻撃名・ダメージ・軽減アイコン。1/2/3 段の混在行・「+」ボタン・ホバー状態を含む。1 段 25px)/ フッター
3. §2 の形の言語: 角の落とし方を 3 種以上パネルごとに変える / 段差・沈み込み / クランクするスジボリ / Nothing 風ドット文字の飾りラベル
4. §3 の配色: ダークとライトの切替ボタン(見本専用)。光は赤 1 色。致死の警告は赤 + 斜線(致死の段だけ・点滅なし)
5. §4 の配線光: スイッチ操作で該当配線に 1 回パルスが走る / 常時は十数秒に 1 本・決まった順序・同時発光は 2 本まで
6. §7 のスイッチ 5 種を実際に操作できる状態で: スライドパネル(表の展開)/ 沈む押しボタン(パーティ編成)/ ロータリー(零式・絶・その他・アーカイブ)/ カバー付き(削除・数秒で自動で閉じる)/ 両手の大レバー
7. §8 の電源投入の演出: 約 1 秒(暗転 → パネルの順次点灯 → 配線の疾走 → タービンの回転上昇)。戻すときは 0.3 秒の電源断
8. `prefers-reduced-motion` で全停止
9. 動画 10 秒ループのつなぎ目を目視確認し、目立つなら Task 1 のスクリプトにクロスフェード版の処理を追加する

- [ ] **Step 3: 4 幅でスクショを撮り、自己点検する**

Playwright で 1280×800 / 1489×900 / 1920×1080 / 2560×1440 × ダーク/ライトの計 8 枚を scratchpad に撮る。材料言語 doc のチェックリスト 9 項目 + 「操作部品が隠れていない / はみ出していない」を 1 枚ずつ確認し、NG は直してから撮り直す。

- [ ] **Step 4: masaya に見てもらう**

dev サーバ(http://localhost:5173)から見本は配信されないため、`npx serve` などで `docs/.private/theme-refs/` を静的配信し、URL を渡す。フィードバックは 1 件ずつ直す。**masaya が「これで本体に移して OK」と言うまで Task 3 以降に進まない。**

- [ ] **Step 5: 承認時の記録**

`docs/.private/2026-09-25-milspec-polish-brainstorm.md` に、承認日と、反復中に決まったこと(暗幕の値、エンコードの値の変更など)を追記する。暗さの値が変わっていたら Task 1 の Step 2 を再実行し、成果物を差し替えてコミットする。

---

### Task 3: `MilspecBackdropVideo` コンポーネント + レイアウトへの配線

**Files:**
- Modify: `src/components/housing/workspace/SceneryVideo.tsx:17`(`function useVideoLoadRecovery` → `export function useVideoLoadRecovery`)
- Create: `src/components/military/MilspecBackdropVideo.tsx`
- Create: `src/components/military/__tests__/MilspecBackdropVideo.test.tsx`
- Modify: `src/components/military/MilspecLayout.tsx`(ルート `<div data-app-shell ...>` 直下の先頭)
- Modify: `src/components/military/__tests__/MilspecLayout.test.tsx`
- Modify: `src/styles/military.css`(`.theme-military .milspec-zone-footer` 定義行の直後)

**Interfaces:**
- Consumes: `useVideoLoadRecovery(ref: React.RefObject<HTMLVideoElement | null>, active: boolean): void`(SceneryVideo.tsx)/ `useReducedMotion(): boolean`(`src/lib/housing/useReducedMotion.ts`)/ Task 1 の成果物
- Produces: `export function MilspecBackdropVideo(): JSX.Element`。DOM = `div.milspec-backdrop[aria-hidden=true][data-ms-backdrop]` > `video` + `div.milspec-backdrop-veil`。CSS トークン `--ms-backdrop-veil`(Phase 2 で見本の値に合わせる)

- [ ] **Step 1: 失敗するテストを書く**

`src/components/military/__tests__/MilspecBackdropVideo.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecBackdropVideo } from '../MilspecBackdropVideo';

let reduce = false;
beforeEach(() => {
  reduce = false;
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : false,
    media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });

const setHidden = (h: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: h });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('MilspecBackdropVideo', () => {
  it('webm → mp4 の順に source を持ち、muted/loop/playsInline/poster 付きの video を描画する', () => {
    const { container } = render(<MilspecBackdropVideo />);
    const root = container.querySelector('[data-ms-backdrop]')!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    const v = root.querySelector('video')!;
    expect(v.muted).toBe(true);
    expect(v.loop).toBe(true);
    expect(v.hasAttribute('playsinline')).toBe(true);
    expect(v.getAttribute('poster')).toMatch(/wall-poster.*\.webp/);
    const types = [...v.querySelectorAll('source')].map((s) => s.getAttribute('type'));
    expect(types).toEqual(['video/webm', 'video/mp4']);
    expect(root.querySelector('.milspec-backdrop-veil')).not.toBeNull();
  });

  it('タブ非表示で pause、再表示で play する', () => {
    render(<MilspecBackdropVideo />);
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    pause.mockClear(); play.mockClear();
    setHidden(true);
    expect(pause).toHaveBeenCalled();
    setHidden(false);
    expect(play).toHaveBeenCalled();
  });

  it('動きを減らす設定では autoplay せず pause し、再表示でも play しない', () => {
    reduce = true;
    const { container } = render(<MilspecBackdropVideo />);
    const v = container.querySelector('video')!;
    expect(v.autoplay).toBe(false);
    expect(vi.mocked(HTMLMediaElement.prototype.pause)).toHaveBeenCalled();
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    play.mockClear();
    setHidden(true); setHidden(false);
    expect(play).not.toHaveBeenCalled();
  });
});
```

`MilspecLayout.test.tsx` の describe 内に追加する:

```tsx
  it('背景動画レイヤーをルート直下の先頭に描画する', () => {
    const { container } = renderIt();
    const root = container.querySelector('[data-app-shell]')!;
    expect(root.firstElementChild?.hasAttribute('data-ms-backdrop')).toBe(true);
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `npx vitest run src/components/military/__tests__/MilspecBackdropVideo.test.tsx src/components/military/__tests__/MilspecLayout.test.tsx`
Expected: FAIL(`MilspecBackdropVideo` のモジュールが解決できない)

- [ ] **Step 3: 実装する**

`SceneryVideo.tsx:17` の `function useVideoLoadRecovery(` を `export function useVideoLoadRecovery(` に変える(ほかは触らない)。

`src/components/military/MilspecBackdropVideo.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../lib/housing/useReducedMotion';
import { useVideoLoadRecovery } from '../housing/workspace/SceneryVideo';
import wallWebm from '../../assets/milspec/wall.webm';
import wallMp4 from '../../assets/milspec/wall.mp4';
import wallPoster from '../../assets/milspec/wall-poster.webp';

/** MIL-SPEC の最奥レイヤー: パネルの隙間から覗く機械の壁動画(spec 2026-09-25 §1 L1 / §5)。
 *  MilspecLayout(= military かつ PC のときだけ描画)の中にだけ置くので、標準テーマとスマホでは
 *  要素自体が作られない = ダウンロード 0。コスト対策の全項目は spec §5 を参照。
 *  タブ非表示で停止し、reduced-motion では poster のまま再生しない。 */
export function MilspecBackdropVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reduced) { v.pause(); return; }
    const sync = () => { if (document.hidden) v.pause(); else v.play().catch(() => {}); };
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [reduced]);

  useVideoLoadRecovery(ref, !reduced);

  return (
    <div className="milspec-backdrop" aria-hidden="true" data-ms-backdrop>
      <video
        ref={ref}
        autoPlay={!reduced}
        loop
        muted
        playsInline
        preload="auto"
        poster={wallPoster}
        disablePictureInPicture
        disableRemotePlayback
      >
        <source src={wallWebm} type="video/webm" />
        <source src={wallMp4} type="video/mp4" />
      </video>
      <div className="milspec-backdrop-veil" />
    </div>
  );
}
```

`MilspecLayout.tsx`: import を追加し、`<div data-app-shell className="milspec-app" data-theme-military>` の直後(`<MilspecChrome />` の前)に `<MilspecBackdropVideo />` を置く。

`military.css`(`.theme-military .milspec-zone-footer` の行の直後):

```css
/* 2026-09-25 polish Phase 1: 最奥の背景動画。viewport 全面に固定(1489 超の画面では app の外側も埋める)。
   z-index:0 で .milspec-app の背景より上、position:relative の各ゾーン(後続・z-index auto)より下に描かれる。
   明るさは暗幕トークンで調整(値は Phase 0 見本に合わせて Phase 2 で確定)。 */
.theme-military .milspec-backdrop { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.theme-military .milspec-backdrop video { width: 100%; height: 100%; object-fit: cover; display: block; }
.theme-military .milspec-backdrop-veil { position: absolute; inset: 0; background: var(--ms-backdrop-veil, rgba(6, 8, 10, 0.55)); }
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npx vitest run src/components/military/__tests__/MilspecBackdropVideo.test.tsx src/components/military/__tests__/MilspecLayout.test.tsx src/__tests__/housing/SceneryVideo.test.tsx`
Expected: 全 PASS(SceneryVideo は export 追加だけなので不変)

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: exit 0(`vite/client` の型で `.webm` / `.mp4` / `.webp` の import は解決される)

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/military/MilspecBackdropVideo.tsx src/components/military/__tests__/MilspecBackdropVideo.test.tsx src/components/military/MilspecLayout.tsx src/components/military/__tests__/MilspecLayout.test.tsx src/components/housing/workspace/SceneryVideo.tsx src/styles/military.css
rtk git commit -m "feat(milspec): 背景動画レイヤー(タブ非表示で停止・reduced-motion対応・読込リトライ1回)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: コスト対策の機械検証 + 回帰確認

**Files:**
- Create: `scripts/milspec-polish/no-video-in-standard.mjs`

**Interfaces:**
- Consumes: `launch`, `gotoMiti`, `applyFixture` from `scripts/milspec-sp2/_fixture.mjs`(`launch({theme}) → {browser, page}`、`applyFixture(page, {military})`)

- [ ] **Step 1: 検証スクリプトを書く**

```js
// @ts-check
/**
 * no-video-in-standard.mjs — 背景動画のコスト対策を機械検証する(spec 2026-09-25 §5)。
 *  A. 標準モードの /miti で .mp4 / .webm / wall-poster へのリクエストが 0 件
 *  B. 軍事モードでは wall 動画がリクエストされる(配線されていることの確認)
 *  C. --sw 指定時: dist/sw.js の precache に wall が含まれない(事前に npm run build)
 * 前提: dev サーバ http://localhost:5173(C は不要)。exit 0 = 全 OK。
 */
import { readFileSync } from 'node:fs';
import { launch, gotoMiti, applyFixture } from '../milspec-sp2/_fixture.mjs';

let fail = 0;
const isVideo = (u) => /\.(mp4|webm)(\?|$)/.test(u) || u.includes('wall-poster');

if (process.argv.includes('--sw')) {
  const sw = readFileSync('dist/sw.js', 'utf8');
  if (/wall/.test(sw)) { console.error('NG C: dist/sw.js の precache に wall が含まれている'); fail++; }
  else console.log('OK C: SW precache に動画/poster なし');
} else {
  for (const military of [false, true]) {
    const { browser, page } = await launch({ theme: 'dark' });
    const hits = [];
    page.on('request', (r) => { if (isVideo(r.url())) hits.push(r.url()); });
    await gotoMiti(page);
    if (military) await applyFixture(page, { military: true });
    await page.waitForTimeout(2500);
    await browser.close();
    if (!military && hits.length) { console.error('NG A: 標準モードで動画リクエスト', hits); fail++; }
    if (!military && !hits.length) console.log('OK A: 標準モード 動画リクエスト 0 件');
    if (military && !hits.some((u) => u.includes('wall'))) { console.error('NG B: 軍事モードで wall 動画が要求されない'); fail++; }
    if (military && hits.some((u) => u.includes('wall'))) console.log('OK B: 軍事モードで wall 動画を要求');
  }
}
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: A/B を実行する**

Run: `node scripts/milspec-polish/no-video-in-standard.mjs`
Expected: `OK A` と `OK B` が出て exit 0

- [ ] **Step 3: ビルドして C を実行する**

Run: `npm run build 2>&1 | tail -5 && node scripts/milspec-polish/no-video-in-standard.mjs --sw`
Expected: build が exit 0、`OK C`

- [ ] **Step 4: 既存の不変テストとスモーク**

Run: `node scripts/milspec-sp2/standard-invariance.mjs && node scripts/milspec-sp2/military-smoke.mjs`
Expected: 両方 exit 0

- [ ] **Step 5: 4 幅スクショ(司令塔が確認)**

1280 / 1489 / 1920 / 2560 で軍事ダークを撮り、1489 を超える幅で app の外側に動画が見えること、操作部品が隠れていないことを確認する。

- [ ] **Step 6: Commit**

```bash
rtk git add scripts/milspec-polish/no-video-in-standard.mjs
rtk git commit -m "test(milspec): 背景動画のコスト対策を機械検証(標準0件・SW precache除外)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: デプロイ時の確認事項を TODO に残す**(push はこの計画ではしない。SP2 と一緒に main へ出すとき)

`docs/TODO.md` の MIL-SPEC 節に 1 行追記する:「本番反映後: `curl -sI https://lopoly.app/assets/wall-*.webm` で `cf-cache-status: HIT`(2 回目)と `cache-control: ...immutable`、`curl -s -r 0-99 -o /dev/null -w '%{http_code}'` で `206` を確認」

---

## Phase 2〜5 について

Task 2(見本)が承認されたら、見本を正典として `docs/superpowers/plans/YYYY-MM-DD-milspec-polish-phase2-5.md` を writing-plans で書く。そこで決めること: パネルの DOM/CSS の移植単位、スイッチ部品の共通コンポーネント(`MilspecSlideSwitch` など)とボタンの全件割り当て表、配線 SVG の経路データ、電源投入演出の実装、画面幅ごとに飾りを畳む優先度、スクロール性能の計測スクリプト。
