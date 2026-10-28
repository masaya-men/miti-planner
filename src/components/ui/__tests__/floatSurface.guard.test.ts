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
    'ConsolidatedHeader.tsx': '常設のヘッダー(glass-tier3 の面)',
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

/** まだ載せ替えていない浮かぶもの。載せ替えたら消す(消し忘れも下で落ちる)。 */
const PENDING: Record<string, string> = {
    'ui/ModalShell.tsx': 'Task 3',
    'Toast.tsx': 'Task 3',
    'ui/Tooltip.tsx': 'Task 3',
    'AASettingsPopover.tsx': 'Task 4',
    'BoundaryEditModal.tsx': 'Task 4',
    'ClearMitigationsPopover.tsx': 'Task 4',
    'EventModal.tsx': 'Task 4',
    'MitigationSelector.tsx': 'Task 4',
    'PartySettingsModal.tsx': 'Task 4',
    'PartyStatusPopover.tsx': 'Task 4',
    'PulseSettings.tsx': 'Task 4',
    'progress/ProgressRecordPanel.tsx': 'Task 4',
    'collab/OwnerCollabPanel.tsx': 'Task 4',
    'timeline/TimelinePopovers.tsx': 'Task 4',
    'timeline/sheet/SheetHiddenPopover.tsx': 'Task 4',
    'timeline/sheet/SheetTargetPopover.tsx': 'Task 4',
    'LimitResolutionSheet.tsx': 'Task 4',
    'ShareImportSheet.tsx': 'Task 4',
    'fflogsImport/FFLogsMobileSheet.tsx': 'Task 4',
    'MobilePartySettings.tsx': 'Task 4',
    'MobileContextMenu.tsx': 'Task 4',
    'ImportProgressOverlay.tsx': 'Task 5',
    'RenderPendingIndicator.tsx': 'Task 5',
    'timeline/sheet/PlacementToast.tsx': 'Task 5',
    'timeline/TimelineDialogs.tsx': 'Task 5',
    'Memo/MemoFloatingBar.tsx': 'Task 5',
    'Memo/MemoInputBox.tsx': 'Task 5',
    'timeline/TimelineModeBars.tsx': 'Task 5',
    'sidebar/SidebarFloatingBar.tsx': 'Task 5',
    'ImportMenu.tsx': 'Task 5',
    'HeaderToolsMenu.tsx': 'Task 5',
    'HeaderPhaseDropdown.tsx': 'Task 5',
    'HeaderGimmickDropdown.tsx': 'Task 5',
    'HeaderMechanicSearch.tsx': 'Task 5',
    'HeaderTimeInput.tsx': 'Task 5',
    'LanguageSwitcher.tsx': 'Task 5',
    'JobPicker.tsx': 'Task 5',
    'ui/ContextMenu.tsx': 'Task 5',
    'pip/PipEditMenu.tsx': 'Task 5',
    'collab/PresenceControls.tsx': 'Task 5',
    'fab/FabEffectModeChips.tsx': 'Task 5',
    'fab/FabLanguageChips.tsx': 'Task 5',
    'fab/FabPartyVisGrid.tsx': 'Task 5',
    'tutorial/TutorialCard.tsx': 'Task 5',
    'tutorial/TutorialMenu.tsx': 'Task 5',
};

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return EXCLUDED_DIRS.includes(name) ? [] : walk(full);
        return name.endsWith('.tsx') ? [full] : [];
    });
}

const files = walk(ROOT).map((full) => ({ key: relative(ROOT, full).replace(/\\/g, '/'), src: readFileSync(full, 'utf8') }));

/** 古い素材(glass-tier3 の面・ライトで白地にする --share-modal-bg) */
const usesOldMaterial = (src: string) => src.includes('glass-tier3') || src.includes('share-modal-bg');

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

    it('PENDING と EXEMPT のファイルが実在する', () => {
        const missing = [...Object.keys(PENDING), ...Object.keys(EXEMPT)].filter((k) => !existsSync(join(ROOT, k)));
        expect(missing).toEqual([]);
    });

    it('PENDING にあるのに載せ替え済み(消し忘れ)', () => {
        const done = files.filter((f) => f.key in PENDING && usesSurface(f.src)).map((f) => f.key);
        expect(done, '載せ替えたら PENDING から消す').toEqual([]);
    });

    it('float-surface と同じ className に背景(bg-*)や --glass-tier3-bg を並べない', () => {
        const bad = files.flatMap((f) =>
            f.src
                .split('\n')
                .filter((line) => line.includes('float-surface') && (/\bbg-(?!clip|black\/)[a-z[]/.test(line) || line.includes('--glass-tier3-bg')))
                .map((line) => `${f.key}: ${line.trim()}`),
        );
        expect(bad).toEqual([]);
    });
});
