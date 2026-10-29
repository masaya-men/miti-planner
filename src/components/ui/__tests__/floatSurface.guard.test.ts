import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// 浮かぶもの(窓・シート・通知・帯・メニュー・ツールチップ・押した所に出る窓)は素材 .float-surface を使う(2026-10-28)。
// 設計書 = docs/superpowers/specs/2026-10-28-floating-surface-unify-design.md
// 見逃しを出さない側の規則で候補を拾い、浮かぶものでない物は EXEMPT に理由つきで載せる。
// 対象 = src/components(ハウジング・管理画面・MIL-SPEC 専用部品は独自の決まりなので除く)。
const ROOT = resolve(__dirname, '../..');
const EXCLUDED_DIRS = ['housing', 'admin', 'military', '__tests__'];

/** 浮かぶものではない/今回の対象外(spec の「対象外」)。 */
const EXEMPT: Record<string, string> = {
    'AppFooter.tsx': '常設のフッター',
    'ConsolidatedHeader.tsx': '常設のヘッダー(frame-surface の面)',
    'header/HeaderCollapseHandle.tsx': '常設のヘッダーの取っ手',
    'Sidebar.tsx': '常設のサイドバー',
    'sidebar/SidebarHandle.tsx': '常設のサイドバーの取っ手',
    'layout/FocusModeRail.tsx': '常設の集中モードの縦帯',
    'CollabJoinerPage.tsx': '共同編集の参加者の画面そのもの',
    'GridOverlay.tsx': '背景の格子(画面の下地)',
    'MobileFab.tsx': 'スマホの FAB ボタン本体(開いた中身は fab/ で対象)',
    'MobileGuide.tsx': '初回の案内画面(窓ではなく画面)',
    'WelcomeSetup.tsx': '初回の設定画面(窓ではなく画面)',
    'layout/AuthRedirectingOverlay.tsx': 'ログインの移動中に画面全体を覆う表示(画面)',
    'party/PartyDragGhost.tsx': 'ドラッグ中の影(演出)',
    'MobilePartySettings.tsx': 'portal はドラッグ中の影(演出)だけ。シート本体は MobileBottomSheet',
    'collab/PresenceControls.tsx': 'portal で JobPicker を出すだけ(素材は JobPicker 側)',
    'fab/FabPartyVisGrid.tsx': 'FAB から出るジョブのアイコンのボタン(面を持たない)',
    'progress/ProgressCelebration.tsx': '進捗のお祝いの演出',
    'timeline/TimelinePipLayer.tsx': '小窓表示(PiP)の層。画面そのもの',
    'tutorial/TutorialBlocker.tsx': 'チュートリアルの操作止め(暗幕)',
    'tutorial/TutorialOverlay.tsx': 'チュートリアルの暗幕と穴あき',
    'tutorial/TutorialPill.tsx': 'チュートリアルの「CLICK」ピル(演出)',
    'tutorial/animations/CompletionCard.tsx': 'チュートリアル完了の演出',
    'tutorial/animations/FakeCompletionCard.tsx': 'チュートリアル完了の演出',
    'tutorial/animations/PaletteHint.tsx': 'チュートリアルの演出',
    'tutorial/animations/PartyAutoFill.tsx': 'チュートリアルの演出',
    'tutorial/animations/PillFly.tsx': 'チュートリアルの演出',
};

/** 演出・初回の案内画面として、窓に似た面(背景+大きな影)を持ってよいファイル(上の EXEMPT の一部)。 */
const PANEL_OK = new Set([
    'MobileGuide.tsx',
    'MobilePartySettings.tsx',
    'party/PartyDragGhost.tsx',
    'tutorial/animations/CompletionCard.tsx',
    'tutorial/animations/FakeCompletionCard.tsx',
    'tutorial/animations/PartyAutoFill.tsx',
]);

/** まだ載せ替えていない浮かぶもの。2026-10-28 に全部載せ替えて空。以後は足さない(下のテストで止める)。 */
const PENDING: Record<string, string> = {
};

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return EXCLUDED_DIRS.includes(name) ? [] : walk(full);
        return name.endsWith('.tsx') ? [full] : [];
    });
}

const files = walk(ROOT).map((full) => ({ key: relative(ROOT, full).replace(/\\/g, '/'), src: readFileSync(full, 'utf8') }));

/** 古い素材(frame-surface の面・ライトで白地にする --share-modal-bg) */
const usesOldMaterial = (src: string) => src.includes('frame-surface') || src.includes('share-modal-bg');

/** 浮かぶもの候補: portal で出す/fixed で z の高い要素/古い素材を使う */
const isCandidate = (src: string) =>
    src.includes('createPortal(') ||
    /className=[^\n]*\bfixed\b[^\n]*z-\[|className=[^\n]*z-\[[^\n]*\bfixed\b/.test(src) ||
    usesOldMaterial(src);

/** 合格: 素材か共通の殻を使い、古い素材を使っていない */
const usesSurface = (src: string) =>
    !usesOldMaterial(src) &&
    (src.includes('float-surface') ||
        (src.includes('<ModalShell') && !src.includes('frame={false}')) ||
        src.includes('<MobileBottomSheet') ||
        src.includes('TOOLTIP_BOX_CLASS'));

describe('浮かぶものは素材 float-surface を使う', () => {
    it('候補は素材か共通の殻を使っている(例外は EXEMPT / PENDING に理由つき)', () => {
        const bad = files
            .filter((f) => isCandidate(f.src) && !usesSurface(f.src) && !(f.key in EXEMPT) && !(f.key in PENDING))
            .map((f) => f.key);
        expect(bad, '浮かぶものなら className に float-surface を付ける。浮かぶものでなければ EXEMPT に理由つきで足す').toEqual([]);
    });

    it('PENDING は空(新しい浮かぶものは最初から float-surface で作る)', () => {
        expect(Object.keys(PENDING)).toEqual([]);
    });

    it('除外したファイルの中にも、窓・メニューの面(白地の指定や「背景+大きな影」)を残さない', () => {
        // ファイルごと除外したサイドバー・フッターの中に窓が隠れていた(2026-10-28 最終レビュー)。
        const panel = /\bbg-app-(bg|surface2?)\b.*\bshadow-(lg|xl|2xl)\b|\bshadow-(lg|xl|2xl)\b.*\bbg-app-(bg|surface2?)\b/;
        const bad = files
            .filter((f) => isCandidate(f.src) && !PANEL_OK.has(f.key))
            .flatMap((f) => f.src.split('\n').map((line, i) => ({ f, line, i })))
            .filter(({ line }) => line.includes('share-modal-bg') || panel.test(line))
            .map(({ f, i }) => `${f.key}:${i + 1}`);
        expect(bad).toEqual([]);
    });

    it('PENDING と EXEMPT のファイルが実在する', () => {
        const missing = [...Object.keys(PENDING), ...Object.keys(EXEMPT)].filter((k) => !existsSync(join(ROOT, k)));
        expect(missing).toEqual([]);
    });

    it('PENDING にあるのに載せ替え済み(消し忘れ)', () => {
        const done = files.filter((f) => f.key in PENDING && usesSurface(f.src)).map((f) => f.key);
        expect(done, '載せ替えたら PENDING から消す').toEqual([]);
    });

    it('float-surface と同じ className に背景(bg-*)や --frame-surface-bg を並べない', () => {
        const bad = files.flatMap((f) =>
            f.src
                .split('\n')
                .filter((line) => line.includes('float-surface') && (/\bbg-(?!clip|black\/)[a-z[]/.test(line) || line.includes('--frame-surface-bg')))
                .map((line) => `${f.key}: ${line.trim()}`),
        );
        expect(bad).toEqual([]);
    });
});
