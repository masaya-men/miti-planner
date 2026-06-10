// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresenceControls } from '../PresenceControls';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe('PresenceControls', () => {
  beforeEach(() => useCollabPresenceStore.getState().clear());

  it('OFF→トグル ON で説明モーダルが出て、確認するまで cursorEnabled は false', () => {
    render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('cursor-toggle'));
    expect(screen.getByText('collab.cursor_optin_title')).toBeInTheDocument();
    expect(useCollabPresenceStore.getState().cursorEnabled).toBe(false); // まだ
  });

  it('モーダルで確認すると cursorEnabled=true', () => {
    render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('cursor-toggle'));
    fireEvent.click(screen.getByText('collab.cursor_optin_confirm'));
    expect(useCollabPresenceStore.getState().cursorEnabled).toBe(true);
  });

  it('ON→トグルで即 OFF(説明なし)', () => {
    useCollabPresenceStore.getState().setCursorEnabled(true);
    render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('cursor-toggle'));
    expect(useCollabPresenceStore.getState().cursorEnabled).toBe(false);
  });
});
