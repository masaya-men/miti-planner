// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ShareImportSheet } from '../ShareImportSheet';
import { useShareImportFlow } from '../../store/useShareImportFlow';

// Firebase mock block — ShareImportSheet → executeShareImport → usePlanStore → planService → firebase の連鎖を遮断する。
vi.mock('../../lib/firebase', () => ({
    auth: { currentUser: null },
    db: {},
    ensureAppCheck: () => null,
    getActiveAppCheck: () => null,
}));
vi.mock('../../lib/appCheck', () => ({
    createLazyAppCheck: () => ({ ensureAppCheck: () => null, getActiveAppCheck: () => null }),
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

vi.mock('../../lib/executeShareImport', () => ({
    executeShareImport: vi.fn().mockResolvedValue(undefined),
}));
// 中央オーバーレイの進捗アニメは unmount 時に happy-dom で AbortError を出すので、このファイルでは差し替える。
vi.mock('../ImportProgressOverlay', () => ({ ImportProgressOverlay: () => null }));
import { executeShareImport } from '../../lib/executeShareImport';

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

const item = (id: string, title: string) => ({
    sourceShareId: id, contentId: 'fru', title, planData: { tag: id } as any,
});

function openBundle(status: 'preview' | 'loading' | 'done' = 'preview') {
    useShareImportFlow.setState({
        status,
        shareId: 'a',
        sharedData: { shareId: 'a', title: 'A', contentId: 'fru', planData: {} as any, createdAt: 0 },
        importItems: [item('a', 'Plan A'), item('b', 'Plan B')],
        selectedItemIds: new Set(['a', 'b']),
    });
}

describe('ShareImportSheet (操作の動き)', () => {
    beforeEach(() => {
        vi.mocked(executeShareImport).mockClear();
        useShareImportFlow.setState({
            status: 'idle', shareId: null, sharedData: null, importItems: [],
            selectedItemIds: new Set(), progressMap: new Map(), deleteProgressMap: new Map(),
            limitContext: null, errorMessage: null,
        });
    });

    it('最初のアイテムがプレビューされ、行をクリックするとプレビューが切り替わる', () => {
        openBundle();
        render(<ShareImportSheet />);
        expect(screen.getByTestId('preview').textContent).toContain('"tag":"a"');
        fireEvent.click(screen.getByText('Plan B'));
        expect(screen.getByTestId('preview').textContent).toContain('"tag":"b"');
    });

    it('チェックボックスで選択を外すと取り込みボタンの件数が減る', () => {
        openBundle();
        render(<ShareImportSheet />);
        fireEvent.click(screen.getAllByRole('checkbox')[0]);
        expect(screen.getByRole('button', { name: /button_import_count 1/ })).toBeInTheDocument();
    });

    it('キャンセルボタンで閉じる (status が idle に戻る)', () => {
        openBundle();
        render(<ShareImportSheet />);
        fireEvent.click(screen.getByLabelText('share_import.button_cancel'));
        expect(useShareImportFlow.getState().status).toBe('idle');
    });

    it('Esc は preview では閉じ、loading では閉じない', () => {
        openBundle('loading');
        const { unmount } = render(<ShareImportSheet />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(useShareImportFlow.getState().status).toBe('loading');
        unmount();
        useShareImportFlow.setState({ status: 'preview' });
        render(<ShareImportSheet />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(useShareImportFlow.getState().status).toBe('idle');
    });

    it('取り込みボタンで選択分だけ executeShareImport に渡り、終わると done になる', async () => {
        openBundle();
        useShareImportFlow.setState({ selectedItemIds: new Set(['b']) });
        render(<ShareImportSheet />);
        await act(async () => {
            fireEvent.click(screen.getAllByRole('button', { name: /button_import_count 1/ })[0]);
        });
        await waitFor(() => expect(useShareImportFlow.getState().status).toBe('done'));
        const passed = vi.mocked(executeShareImport).mock.calls[0][0];
        expect(passed.map((i: any) => i.sourceShareId)).toEqual(['b']);
    });

    it('done になって 1200ms 後に自動で閉じる', () => {
        vi.useFakeTimers();
        try {
            openBundle('done');
            render(<ShareImportSheet />);
            expect(useShareImportFlow.getState().status).toBe('done');
            act(() => { vi.advanceTimersByTime(1300); });
            expect(useShareImportFlow.getState().status).toBe('idle');
        } finally {
            vi.useRealTimers();
        }
    });
});
