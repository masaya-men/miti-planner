// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  // glass-tier(backdrop-filter)の中だと fixed の JobPicker が枠内に閉じ込められ画面外に出る。
  // document.body へ portal して containing block を回避する(回帰防止)。
  it('ジョブ選択ボタンで JobPicker が body へ portal される(glass 枠の外)', () => {
    const { container } = render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('job-select'));
    // ピッカーのヘッダ(jobs.select_job)はコンポーネント subtree の外＝body に出る。
    expect(within(container).queryByText('jobs.select_job')).toBeNull();
    expect(screen.getByText('jobs.select_job')).toBeInTheDocument();
  });

  it('状態テキストを常時表示する(OFF→ON で文言が切り替わる)', () => {
    render(<PresenceControls />);
    expect(screen.getByText('collab.cursor_status_off')).toBeInTheDocument();
    expect(screen.getByLabelText('cursor-toggle')).toHaveTextContent('collab.cursor_turn_on');
  });

  it('ON のとき状態テキストとボタン文言が ON 用になる', () => {
    useCollabPresenceStore.getState().setCursorEnabled(true);
    render(<PresenceControls />);
    expect(screen.getByText('collab.cursor_status_on')).toBeInTheDocument();
    expect(screen.getByLabelText('cursor-toggle')).toHaveTextContent('collab.cursor_turn_off');
  });
});
