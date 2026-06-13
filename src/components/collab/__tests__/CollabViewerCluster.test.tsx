// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollabViewerCluster } from '../CollabViewerCluster';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';

const navigate = vi.fn();
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../PresenceControls', () => ({ PresenceControls: () => <div data-testid="presence-controls" /> }));

describe('CollabViewerCluster', () => {
  beforeEach(() => { navigate.mockReset(); useCollabPresenceStore.getState().clear(); });

  it('参加者ドットとカーソル操作と抜けるボタンを表示する', () => {
    useCollabPresenceStore.setState({ roster: [{ clientId: 1, color: '#fff', isLocal: true, isEditor: true }] as any });
    render(<CollabViewerCluster />);
    expect(screen.getByTestId('presence-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'collab.leave' })).toBeInTheDocument();
  });

  it('抜けるボタンで / へ遷移する', () => {
    render(<CollabViewerCluster />);
    fireEvent.click(screen.getByRole('button', { name: 'collab.leave' }));
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
