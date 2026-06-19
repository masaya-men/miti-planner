// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressRecordPanel } from '../ProgressRecordPanel';
import { useProgressRecording } from '../useProgressRecording';
import { useMitigationStore } from '../../../store/useMitigationStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

describe('ProgressRecordPanel 詳細トグル（モバイル）', () => {
  beforeEach(() => {
    (window as any).innerWidth = 375;
    useMitigationStore.getState().resetForTutorial();
    useMitigationStore.setState({
      progress: { points: [{ ts: 1, reachedPos: 100 }], cleared: false },
      _collabReadonly: false, _collabActive: false,
    } as any);
    useProgressRecording.setState({ panelOpen: true, pendingClose: 0 } as any);
  });

  it('シェブロンで詳細パネルを開閉する', () => {
    render(<ProgressRecordPanel />);
    // 開く前は詳細見出しが無い
    expect(screen.queryByText('progress.detail_title')).toBeNull();
    fireEvent.click(screen.getByLabelText('progress.toggle_detail'));
    expect(screen.getByText('progress.detail_title')).toBeTruthy();
  });
});
