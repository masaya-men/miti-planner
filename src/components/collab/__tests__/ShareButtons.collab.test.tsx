// @vitest-environment happy-dom
// src/components/collab/__tests__/ShareButtons.collab.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareButtons } from '../../ShareButtons';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import { useAuthStore } from '../../../store/useAuthStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
// ShareModal/Tooltip/LoginModal は本テストの対象外。軽量モックで描画を単純化。
vi.mock('../../ShareModal', () => ({ ShareModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="share-modal" /> : null }));
vi.mock('../../ui/Tooltip', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../LoginModal', () => ({ LoginModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="login-modal" /> : null }));
vi.mock('../../../store/useTutorialStore', () => ({ useTutorialStore: { getState: () => ({ completed: { share: true }, isActive: false, startTutorial: vi.fn() }) } }));

const plan = { id: 'plan1', ownerId: 'uid1' } as any;

beforeEach(() => {
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null, start: vi.fn().mockResolvedValue(undefined) } as any);
  useAuthStore.setState({ user: { uid: 'uid1' } } as any);
});

describe('ShareButtons + collab', () => {
  it('共有クリックで2択が出る', () => {
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('collab.choice_title')).toBeInTheDocument();
  });

  it('「コピーを配る」で ShareModal が開く', () => {
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('collab.choice_copy_title'));
    expect(screen.getByTestId('share-modal')).toBeInTheDocument();
  });

  it('「一緒に編集」(ログイン済)で start を呼ぶ', () => {
    const start = vi.fn().mockResolvedValue(undefined);
    useCollabSessionStore.setState({ start } as any);
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('collab.choice_collab_title'));
    expect(start).toHaveBeenCalledWith('plan1');
  });

  it('_collabActive 時は常設チップを表示', () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', session: {} as any } as any);
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    expect(screen.getByText('collab.chip_active')).toBeInTheDocument();
  });
});
