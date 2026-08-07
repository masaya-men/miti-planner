// @vitest-environment happy-dom
// src/components/collab/__tests__/OwnerCollabPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OwnerCollabPanel } from '../OwnerCollabPanel';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';
import type { RosterEntry } from '../../../lib/collab/presence';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => (o?.max ? `${k}:${o.max}` : o?.count != null ? `${k}:${o.count}` : k),
    i18n: { language: 'ja' },
  }),
}));

beforeEach(() => {
  useCollabSessionStore.setState({
    active: true, roomToken: 'tok7Qk2', maxParticipants: 8, session: null,
    start: vi.fn(), setMax: vi.fn(), revoke: vi.fn(), reissue: vi.fn(),
  } as any);
  useCollabPresenceStore.setState({
    roster: [
      { clientId: 7, color: '#34d399', jobId: null, isEditor: true, cursorEnabled: true, isLocal: true } as RosterEntry,
      { clientId: 2, color: '#a78bfa', jobId: null, isEditor: false, cursorEnabled: true, isLocal: false } as RosterEntry,
    ],
  });
});

describe('OwnerCollabPanel', () => {
  it('警告と情報文言・リンク・人数を表示する', () => {
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    expect(screen.getByText('collab.warning')).toBeInTheDocument();
    expect(screen.getByText('collab.info:20')).toBeInTheDocument(); // {{max}}=SYSTEM_MAX(20)
    expect(screen.getByDisplayValue(/tok7Qk2/)).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('＋/− は仮の値だけを変える。確定ボタンを押すまで setMax は呼ばれない', () => {
    const setMax = vi.fn().mockResolvedValue(undefined);
    useCollabSessionStore.setState({ setMax } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('inc-people'));
    expect(setMax).not.toHaveBeenCalled();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('変更していない間は確定ボタンが出ない', () => {
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    expect(screen.queryByText(/collab.confirm_max/)).not.toBeInTheDocument();
  });

  it('仮の値を変えると確定ボタンが出る。押すと setMax(planId, 仮の値) を呼び、成功後はボタンが消える', async () => {
    const setMax = vi.fn().mockImplementation(async (_planId: string, n: number) => {
      useCollabSessionStore.setState({ maxParticipants: n });
    });
    useCollabSessionStore.setState({ setMax } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('inc-people'));
    const confirmBtn = screen.getByText('collab.confirm_max:9');
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(setMax).toHaveBeenCalledWith('plan1', 9));
    await waitFor(() => expect(screen.queryByText(/collab.confirm_max/)).not.toBeInTheDocument());
  });

  it('確定API応答待ち中は+/-ボタンを無効化し、未送信の変更が無言で消えるのを防ぐ', async () => {
    let resolveSetMax: (() => void) | undefined;
    const setMax = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveSetMax = () => resolve();
    }));
    useCollabSessionStore.setState({ setMax } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('inc-people'));
    fireEvent.click(screen.getByText('collab.confirm_max:9'));
    await waitFor(() => expect(setMax).toHaveBeenCalledWith('plan1', 9));
    expect(screen.getByLabelText('inc-people')).toBeDisabled();
    expect(screen.getByLabelText('dec-people')).toBeDisabled();
    resolveSetMax?.();
    await waitFor(() => expect(screen.getByLabelText('inc-people')).not.toBeDisabled());
  });

  it('OFFボタンは即 revoke せず確認モーダルを挟む→確認で revoke', () => {
    const revoke = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    useCollabSessionStore.setState({ revoke } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={onClose} />);
    // OFF ボタンを押しただけでは切断しない (誤操作防止の確認 1 枚)
    fireEvent.click(screen.getByText('collab.turn_off'));
    expect(revoke).not.toHaveBeenCalled();
    // 確認モーダルの「OFF にする」で実行
    fireEvent.click(screen.getByText('collab.off_confirm_ok'));
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

  it('参加者リストを色ドット + 編集/閲覧バッジで表示する', () => {
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    expect(screen.getByText('collab.roster_title')).toBeInTheDocument();
    expect(screen.getByText('collab.roster_you')).toBeInTheDocument();   // 自分の行
    expect(screen.getByText('collab.roster_editor')).toBeInTheDocument(); // 編集バッジ
    expect(screen.getByText('collab.roster_viewer')).toBeInTheDocument(); // 閲覧バッジ
  });
});
