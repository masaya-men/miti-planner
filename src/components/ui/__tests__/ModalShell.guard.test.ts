import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// 窓(モーダル)は ModalShell を使う(2026-10-26 整頓③)。殻を使わない窓が増えたらここで止める。
// 対象=画面全体を覆う幕(fixed inset-0 + 幕 .modal-scrim / 黒い背景 bg-black/)を持つ部品。ハウジング・管理画面・MIL-SPEC は独自の決まりなので対象外。
const ROOT = resolve(__dirname, '../../');
const EXCLUDED_DIRS = ['housing', 'admin', 'military', '__tests__'];

/** 殻を使っていない既存の部品。載せ替えたら消す(消し忘れも下のテストで落ちる)。 */
const LEGACY: Record<string, 'window' | 'not-window'> = {
    // 殻に載せない窓(クリック位置に出る・スマホは下から出る形。Esc・幕 .modal-scrim は対応済み)
    'BoundaryEditModal.tsx': 'window',
    'EventModal.tsx': 'window',
    'MitigationSelector.tsx': 'window',
    // 下から出るシート(見た目は独自・Esc は対応済み)
    'LimitResolutionSheet.tsx': 'window',
    'ShareImportSheet.tsx': 'window',
    'fflogsImport/FFLogsMobileSheet.tsx': 'window',
    // 窓ではない(スマホのメニュー・案内・チュートリアル・表の中の覆い等)
    'MobileGuide.tsx': 'not-window',
    'MobileBottomSheet.tsx': 'not-window', // スマホの下から出るシートの殻そのもの
    'MobileContextMenu.tsx': 'not-window',
    'pip/PipEditMenu.tsx': 'not-window',
    'Sidebar.tsx': 'not-window',
    'timeline/TimelinePopovers.tsx': 'not-window',
    'WelcomeSetup.tsx': 'not-window',
    'tutorial/TutorialOverlay.tsx': 'not-window',
    'tutorial/animations/CompletionCard.tsx': 'not-window',
    'tutorial/animations/FakeCompletionCard.tsx': 'not-window',
};

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return EXCLUDED_DIRS.includes(name) ? [] : walk(full);
        return name.endsWith('.tsx') ? [full] : [];
    });
}

const files = walk(ROOT).map((full) => ({
    key: relative(ROOT, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
}));
const isOverlay = (src: string) => src.includes('fixed inset-0') && (src.includes('bg-black/') || src.includes('modal-scrim'));
const usesShell = (src: string) => src.includes('<ModalShell');

describe('窓は共通の殻(ModalShell)を使う', () => {
    it('殻を使わない新しい窓が無い', () => {
        const offenders = files
            .filter((f) => isOverlay(f.src) && !usesShell(f.src) && !(f.key in LEGACY))
            .map((f) => f.key);
        expect(offenders, '新しい窓は src/components/ui/ModalShell.tsx を使う').toEqual([]);
    });

    it('一覧の古い記載が残っていない(載せ替えたら LEGACY から消す)', () => {
        const stale = Object.keys(LEGACY).filter((key) => {
            const f = files.find((x) => x.key === key);
            return !f || !isOverlay(f.src) || usesShell(f.src);
        });
        expect(stale).toEqual([]);
    });

    it('殻に載せていない窓も Esc で閉じる', () => {
        const noEsc = Object.entries(LEGACY)
            .filter(([, kind]) => kind === 'window')
            .filter(([key]) => !files.find((x) => x.key === key)!.src.includes('Escape'))
            .map(([key]) => key);
        expect(noEsc).toEqual([]);
    });

    // 外側クリックは共通の backdropClose で(押し始め・離しの位置の判定と、下の要素へ届かせないのを揃える・2026-10-27)
    it('殻に載せていない窓も外側クリックは共通の backdropClose を使う', () => {
        const noBackdrop = Object.entries(LEGACY)
            .filter(([, kind]) => kind === 'window')
            .filter(([key]) => !files.find((x) => x.key === key)!.src.includes('backdropClose('))
            .map(([key]) => key);
        expect(noBackdrop).toEqual([]);
    });
});

// 窓・シートの後ろの幕の見た目(暗さ・ぼかし)は .modal-scrim の 1 か所で決める(2026-10-29 masaya)。
// 部品に暗さを直接書くと「幕を外した」のに一部だけ暗いまま残る(チュートリアルの終了確認で実際に漏れた)。
// 全画面を覆う要素(inset-0)に黒(bg-black/)や --color-overlay を直接書いたら落とす。
const DIM_RE = /inset-0[^"'`]*bg-black\/\d+|bg-black\/\d+[^"'`]*inset-0|inset-0 \$\{[^}]*bg-black\/|color-overlay/;
/** 幕ではない黒(ボタンや画像の上だけの覆い)。行の一部で見分ける */
const NOT_SCRIM = [
    'group-hover:opacity-100', // アバター画像にマウスを乗せた時の覆い(LoginModal・WelcomeSetup)
    'absolute inset-0 bg-black/30">', // スマホの軽減追加で、置けない技のボタンの上の覆い(TimelineMobileSheets)
];

describe('後ろの幕は共通の .modal-scrim を使う', () => {
    it('全画面の幕に暗さを直接書いていない', () => {
        const offenders = files.flatMap((f) => f.src.split('\n').flatMap((line, i) =>
            DIM_RE.test(line) && !NOT_SCRIM.some((ok) => line.includes(ok)) ? [`${f.key}:${i + 1}`] : []));
        expect(offenders, '幕は className に modal-scrim を付ける(見た目は src/styles/base/float-surface.css)').toEqual([]);
    });
});
