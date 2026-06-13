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
    useCollabPresenceStore.getState().setCursorEnabled(true); // ③: アイコンボタンは ON のときだけ出る
    const { container } = render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('job-select'));
    // ピッカーのヘッダ(jobs.select_job)はコンポーネント subtree の外＝body に出る。
    expect(within(container).queryByText('jobs.select_job')).toBeNull();
    expect(screen.getByText('jobs.select_job')).toBeInTheDocument();
  });

  // ②表記ゆれ統一: トグル自身が状態(英語 ON/OFF)を表示。別注釈は廃止。
  it('トグルが状態(英語 ON/OFF)を表示する', () => {
    render(<PresenceControls />);
    expect(screen.getByLabelText('cursor-toggle')).toHaveTextContent('collab.cursor_share_off');
    // 旧: 動作カタカナ + 状態注釈の二重表記は廃止
    expect(screen.queryByText('collab.cursor_status_off')).toBeNull();
  });

  it('ON のときトグルは ON 状態を表示する', () => {
    useCollabPresenceStore.getState().setCursorEnabled(true);
    render(<PresenceControls />);
    expect(screen.getByLabelText('cursor-toggle')).toHaveTextContent('collab.cursor_share_on');
  });

  // ③ゲート化: OFF のときアイコン選択ボタンは出さない。ON のとき出る。
  it('OFF のときアイコン選択ボタンは非表示、ON のとき表示', () => {
    const { rerender } = render(<PresenceControls />);
    expect(screen.queryByLabelText('job-select')).toBeNull();
    useCollabPresenceStore.getState().setCursorEnabled(true);
    rerender(<PresenceControls />);
    expect(screen.getByLabelText('job-select')).toBeInTheDocument();
  });

  // ②導線: ON にしたら(OptIn 確認後)アイコン選択ピッカーが自動で開く。
  it('OptIn 確認で ON になり、続けて JobPicker が自動で開く', () => {
    render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('cursor-toggle'));
    fireEvent.click(screen.getByText('collab.cursor_optin_confirm'));
    expect(useCollabPresenceStore.getState().cursorEnabled).toBe(true);
    expect(screen.getByText('jobs.select_job')).toBeInTheDocument();
  });
});
