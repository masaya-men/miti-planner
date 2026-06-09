// @vitest-environment happy-dom
// src/components/collab/__tests__/OwnerCollabPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OwnerCollabPanel } from '../OwnerCollabPanel';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.max ? `${k}:${o.max}` : k) }),
}));

beforeEach(() => {
  useCollabSessionStore.setState({
    active: true, roomToken: 'tok7Qk2', maxParticipants: 8, session: null,
    start: vi.fn(), setMax: vi.fn(), revoke: vi.fn(), reissue: vi.fn(),
  } as any);
});

describe('OwnerCollabPanel', () => {
  it('警告と情報文言・リンク・人数を表示する', () => {
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    expect(screen.getByText('collab.warning')).toBeInTheDocument();
    expect(screen.getByText('collab.info:20')).toBeInTheDocument(); // {{max}}=SYSTEM_MAX(20)
    expect(screen.getByDisplayValue(/tok7Qk2/)).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('＋/− で setMax を呼ぶ(1..20 クランプ)', () => {
    const setMax = vi.fn();
    useCollabSessionStore.setState({ setMax } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('inc-people'));
    expect(setMax).toHaveBeenCalledWith('plan1', 9);
  });

  it('失効ボタンで revoke→onClose', () => {
    const revoke = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    useCollabSessionStore.setState({ revoke } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={onClose} />);
    fireEvent.click(screen.getByText('collab.revoke'));
    expect(revoke).toHaveBeenCalledWith('plan1');
  });

  it('再発行ボタンで reissue を呼ぶ', () => {
    const reissue = vi.fn().mockResolvedValue(undefined);
    useCollabSessionStore.setState({ reissue } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByText('collab.reissue'));
    // ⑤-3c: ラベル入力欄が空のときは空文字を渡す(store/API 側で空は未設定に正規化)。
    expect(reissue).toHaveBeenCalledWith('plan1', '');
  });
});
