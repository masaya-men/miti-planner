// @vitest-environment happy-dom

import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PopularBrowseView } from '../components/admin/PopularBrowseView';

vi.mock('../lib/apiClient', () => ({
    apiFetch: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            // ローディングテキストは日本語で返す（テストの正規表現に合わせる）
            const map: Record<string, string> = {
                'admin.popular_loading': '読み込み中',
                'admin.popular_hide_button': '非表示にする',
                'admin.popular_unhide_button': '再表示する',
                'admin.featured_set_button': 'Featuredにする',
                'admin.featured_unset_button': 'Featured解除',
                'admin.popular_hide_confirm': `本当に非表示にしますか？ ${opts?.title ?? ''}`,
                'admin.popular_unhide_confirm': `再表示しますか？ ${opts?.title ?? ''}`,
            };
            return map[key] ?? key;
        },
        i18n: { language: 'ja' },
    }),
    initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { apiFetch } from '../lib/apiClient';
const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

const mockPlans = [
    {
        shareId: 'aaa',
        title: 'Test 1',
        contentId: 'm9s',
        copyCount: 12,
        score7d: 5,
        featured: false,
        hidden: false,
        hiddenAt: null,
        createdAt: 1730000000000,
        ownerUidSuffix: 'a3f1',
        partyMembers: [],
        imageHash: null,
    },
    {
        shareId: 'bbb',
        title: 'Test 2',
        contentId: 'm9s',
        copyCount: 3,
        score7d: 2,
        featured: false,
        hidden: true,
        hiddenAt: 1730000001000,
        createdAt: 1730000000000,
        ownerUidSuffix: 'b3f2',
        partyMembers: [],
        imageHash: null,
    },
];

beforeEach(() => {
    mockApiFetch.mockReset();
});

describe('PopularBrowseView', () => {
    it('shows the loading state initially', () => {
        mockApiFetch.mockImplementationOnce(() => new Promise(() => {}));
        render(<PopularBrowseView />);
        expect(screen.getByText(/読み込み中|Loading|加载|로딩/)).toBeInTheDocument();
    });

    it('shows ranked cards after fetch', async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ contentId: 'm9s', plans: mockPlans }),
        });
        render(<PopularBrowseView />);
        await waitFor(() => expect(screen.getAllByText('Test 1').length).toBeGreaterThan(0));
        expect(screen.getAllByText('Test 2').length).toBeGreaterThan(0);
    });

    it('marks hidden cards visually', async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ contentId: 'm9s', plans: mockPlans }),
        });
        render(<PopularBrowseView />);
        await waitFor(() => expect(screen.getAllByText('Test 2').length).toBeGreaterThan(0));
        // Test 2 は hidden=true なので、card の data-hidden 属性のみで識別
        const hiddenCard = screen.getAllByText('Test 2')
            .map(el => el.closest('[data-testid="popular-card"]'))
            .find(card => card !== null);
        expect(hiddenCard).toHaveAttribute('data-hidden', 'true');
    });

    it('PATCHes hidden=true when hide button clicked', async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ contentId: 'm9s', plans: mockPlans }),
        });
        render(<PopularBrowseView />);
        await waitFor(() => expect(screen.getAllByText('Test 1').length).toBeGreaterThan(0));
        // 最初の Test 1 (card) をクリック
        const cards = screen.getAllByText('Test 1');
        const firstCard = cards.find(el => el.closest('[data-testid="popular-card"]'));
        fireEvent.click(firstCard!);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        mockApiFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, hidden: true }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    contentId: 'm9s',
                    plans: [{ ...mockPlans[0], hidden: true }, mockPlans[1]],
                }),
            });
        const hideBtn = await screen.findByRole('button', {
            name: /非表示にする|Hide|隐藏|숨기기/,
        });
        fireEvent.click(hideBtn);
        await waitFor(() => {
            const calls = mockApiFetch.mock.calls;
            const patchCall = calls.find(c => c[1]?.method === 'PATCH');
            expect(patchCall).toBeDefined();
            expect(patchCall![1].body).toContain('"hidden":true');
            expect(patchCall![1].body).toContain('"shareId":"aaa"');
        });
    });
});
