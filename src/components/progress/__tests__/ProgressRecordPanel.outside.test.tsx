// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { ProgressRecordPanel } from '../ProgressRecordPanel';
import { useProgressRecording } from '../useProgressRecording';
import { useMitigationStore } from '../../../store/useMitigationStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

// 実ブラウザと同じ順序で「押す→離す→click」を送る
function press(el: Element) {
  fireEvent.pointerDown(el);
  fireEvent.mouseDown(el);
  fireEvent.pointerUp(el);
  fireEvent.mouseUp(el);
  fireEvent.click(el);
}

describe('ProgressRecordPanel 外側を押した時(PC)', () => {
  beforeEach(() => {
    (window as unknown as { innerWidth: number }).innerWidth = 1489;
    useMitigationStore.getState().resetForTutorial();
    useProgressRecording.setState({ panelOpen: true, pendingClose: 0 } as never);
  });
  afterEach(() => { cleanup(); useProgressRecording.setState({ panelOpen: false, recordMode: false } as never); });

  it('記録モード中: 外側(タイムラインのマス)の click は止められず下に届く(記録確定のため)', () => {
    const onCell = vi.fn();
    const { getByTestId } = render(<><button data-testid="cell" onClick={onCell} /><ProgressRecordPanel /></>);
    expect(useProgressRecording.getState().recordMode).toBe(true);
    press(getByTestId('cell'));
    expect(onCell).toHaveBeenCalledTimes(1);
  });

  it('記録モードでない時: 外側を押すと下の click は止められる(共通フック)', () => {
    const onCell = vi.fn();
    const { getByTestId } = render(<><button data-testid="cell" onClick={onCell} /><ProgressRecordPanel /></>);
    act(() => { useProgressRecording.setState({ recordMode: false } as never); });
    press(getByTestId('cell'));
    expect(onCell).toHaveBeenCalledTimes(0);
  });
});
