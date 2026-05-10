// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareImportSheet } from '../ShareImportSheet';
import { useShareImportFlow } from '../../store/useShareImportFlow';

// Firebase mock block — ShareImportSheet → executeShareImport → usePlanStore → planService → firebase の連鎖を遮断する。
vi.mock('../../lib/firebase', () => ({
    auth: { currentUser: null },
    db: {},
    appCheck: null,
}));
vi.mock('../../lib/appCheck', () => ({
    appCheckReady: Promise.resolve(),
    ensureAppCheckToken: vi.fn().mockResolvedValue(''),
}));
vi.mock('firebase/auth', () => ({
    onAuthStateChanged: () => () => {},
    signInWithCustomToken: vi.fn(),
    signOut: vi.fn(),
    deleteUser: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    collection: vi.fn(),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    writeBatch: vi.fn(),
    updateDoc: vi.fn(),
}));
vi.mock('firebase/app-check', () => ({
    getToken: vi.fn(),
}));

// MitigationSheetPreview は内部で useSkillsData / useThemeStore を使うので
// このテストでは data-testid="preview" のスタブに置き換える。
vi.mock('../MitigationSheetPreview', () => ({
    MitigationSheetPreview: ({ planData }: any) => (
        <div data-testid="preview">{JSON.stringify(planData)}</div>
    ),
}));

// LimitResolutionSheet は Task 15 のテストで独立に検証されているため、
// このテストでは ShareImportSheet 単体に集中するため空コンポーネントに差し替える。
vi.mock('../LimitResolutionSheet', () => ({
    LimitResolutionSheet: () => null,
}));

// react-i18next: テスト中は実際の翻訳リソースを読まないため、 t() がプレースホルダーを
// 解決できるよう、 既知のキーに対してテンプレ文字列を返すマップを併用する。
// (例: `share_import.button_import_count` に opts={count: 2} を渡すと `share_import.button_import_count 2 件` を返す)
// 該当キーが無いものはキーをそのまま返す既存挙動。
const I18N_TEMPLATES: Record<string, string> = {
    'share_import.title': 'share_import.title',
    'share_import.title_bundle': 'share_import.title_bundle ({{count}})',
    'share_import.loading': 'share_import.loading',
    'share_import.not_found': 'share_import.not_found',
    'share_import.error': 'share_import.error',
    'share_import.button_import_single': 'share_import.button_import_single',
    'share_import.button_import_count':
        'share_import.button_import_count {{count}}',
    'share_import.button_cancel': 'share_import.button_cancel',
    'limit_resolution.selection_count':
        'limit_resolution.selection_count {{count}}',
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: any) => {
            const template = I18N_TEMPLATES[key] ?? key;
            if (opts && typeof opts === 'object') {
                let result = template;
                Object.keys(opts).forEach((k) => {
                    result = result.replace(`{{${k}}}`, String(opts[k]));
                });
                return result;
            }
            return template;
        },
        i18n: { language: 'ja' },
    }),
}));

describe('ShareImportSheet', () => {
    beforeEach(() => {
        // Store の初期化。 status='idle' に戻し、 importItems / progressMap 等をリセット。
        useShareImportFlow.setState({
            status: 'idle',
            shareId: null,
            sharedData: null,
            importItems: [],
            selectedItemIds: new Set(),
            progressMap: new Map(),
            deleteProgressMap: new Map(),
            limitContext: null,
            errorMessage: null,
        });
    });

    it('status が idle のとき何も描画しない', () => {
        const { container } = render(<ShareImportSheet />);
        expect(
            container.querySelector('[data-testid="share-import-sheet"]'),
        ).toBeNull();
    });

    it('loading 状態を描画する', () => {
        useShareImportFlow.setState({ status: 'loading', shareId: 'abc' });
        render(<ShareImportSheet />);
        expect(screen.getByText('share_import.loading')).toBeInTheDocument();
    });

    it('preview 状態 (single item) ではチェックボックス列を表示しない', () => {
        useShareImportFlow.setState({
            status: 'preview',
            shareId: 'abc',
            sharedData: { shareId: 'abc', title: 'Single Sheet', contentId: 'fru', planData: {} as any, createdAt: 0 },
            importItems: [
                {
                    sourceShareId: 'abc',
                    contentId: 'fru',
                    title: 'Single Sheet',
                    planData: {} as any,
                },
            ],
            selectedItemIds: new Set(['abc']),
        });
        render(<ShareImportSheet />);
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(
            screen.getByRole('button', { name: /button_import_single/i }),
        ).toBeInTheDocument();
    });

    it('preview 状態 (bundle) ではアイテムごとにチェックボックスを表示する', () => {
        useShareImportFlow.setState({
            status: 'preview',
            shareId: 'abc',
            sharedData: { shareId: 'abc', type: 'bundle', plans: [], createdAt: 0 } as any,
            importItems: [
                {
                    sourceShareId: 'abc',
                    contentId: 'fru',
                    title: 'Item 1',
                    planData: {} as any,
                    sourcePlanId: 'p1',
                },
                {
                    sourceShareId: 'abc',
                    contentId: 'fru',
                    title: 'Item 2',
                    planData: {} as any,
                    sourcePlanId: 'p2',
                },
            ],
            selectedItemIds: new Set(['p1', 'p2']),
        });
        render(<ShareImportSheet />);
        expect(screen.getAllByRole('checkbox')).toHaveLength(2);
        expect(
            screen.getByRole('button', { name: /button_import_count.*2/i }),
        ).toBeInTheDocument();
    });

    it('選択数の変化に応じてボタンラベルが更新される', () => {
        useShareImportFlow.setState({
            status: 'preview',
            shareId: 'abc',
            sharedData: { shareId: 'abc', type: 'bundle', plans: [], createdAt: 0 } as any,
            importItems: [
                {
                    sourceShareId: 'abc',
                    contentId: 'fru',
                    title: 'Item 1',
                    planData: {} as any,
                    sourcePlanId: 'p1',
                },
                {
                    sourceShareId: 'abc',
                    contentId: 'fru',
                    title: 'Item 2',
                    planData: {} as any,
                    sourcePlanId: 'p2',
                },
            ],
            selectedItemIds: new Set(['p1']),
        });
        render(<ShareImportSheet />);
        expect(
            screen.getByRole('button', { name: /button_import_count.*1/i }),
        ).toBeInTheDocument();
    });

    it('選択 0 件のときボタンが disabled になる', () => {
        useShareImportFlow.setState({
            status: 'preview',
            shareId: 'abc',
            sharedData: { shareId: 'abc', type: 'bundle', plans: [], createdAt: 0 } as any,
            importItems: [
                {
                    sourceShareId: 'abc',
                    contentId: 'fru',
                    title: 'Item 1',
                    planData: {} as any,
                    sourcePlanId: 'p1',
                },
            ],
            selectedItemIds: new Set(),
        });
        render(<ShareImportSheet />);
        const button = screen.getByRole('button', { name: /button_import/i });
        expect(button).toBeDisabled();
    });

    it('error 状態 (not_found) を描画する', () => {
        useShareImportFlow.setState({
            status: 'error',
            errorMessage: 'not_found',
        });
        render(<ShareImportSheet />);
        expect(screen.getByText('share_import.not_found')).toBeInTheDocument();
    });

    it('単一プランのときも左カラム (リスト) が描画される', () => {
        useShareImportFlow.setState({
            status: 'preview',
            shareId: 's1',
            sharedData: { shareId: 's1', title: 'プランA', contentId: 'fru', planData: {} as any, createdAt: 0 },
            importItems: [
                {
                    sourceShareId: 's1',
                    contentId: 'fru',
                    title: 'プランA',
                    planData: {} as any,
                },
            ],
            selectedItemIds: new Set(['s1']),
        });
        render(<ShareImportSheet />);
        // 左カラムにカード 1 件 + プレビューが両方描画される
        expect(screen.getAllByTestId('share-plan-card').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByTestId('preview')).toBeInTheDocument();
    });

    it('preview 状態のときキャンセルボタンが描画され enabled', () => {
        useShareImportFlow.setState({
            status: 'preview',
            shareId: 's1',
            sharedData: { shareId: 's1', title: 't1', contentId: 'fru', planData: {} as any, createdAt: 0 },
            importItems: [
                { sourceShareId: 's1', contentId: 'fru', title: 't1', planData: {} as any },
            ],
            selectedItemIds: new Set(['s1']),
        });
        render(<ShareImportSheet />);
        const cancel = screen.getByLabelText('share_import.button_cancel');
        expect(cancel).toBeInTheDocument();
        expect(cancel).not.toBeDisabled();
    });

    it('importing 状態のときキャンセルボタンは disabled', () => {
        useShareImportFlow.setState({
            status: 'importing',
            shareId: 's1',
            sharedData: { shareId: 's1', title: 't1', contentId: 'fru', planData: {} as any, createdAt: 0 },
            importItems: [
                { sourceShareId: 's1', contentId: 'fru', title: 't1', planData: {} as any },
            ],
            selectedItemIds: new Set(['s1']),
        });
        render(<ShareImportSheet />);
        const cancel = screen.getByLabelText('share_import.button_cancel');
        expect(cancel).toBeDisabled();
    });
});
