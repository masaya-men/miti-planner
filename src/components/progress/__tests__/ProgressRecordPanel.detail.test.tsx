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

  it('シェブロンで詳細パネルを開閉する（常時マウント・data-open で双方向トグル）', () => {
    render(<ProgressRecordPanel />);
    // 詳細パネルは常時マウント（開閉アニメを双方向にするため）。状態は data-open で表す。
    const panel = document.querySelector('.progress-detail');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('data-open')).toBe('false'); // 開く前は折りたたみ
    fireEvent.click(screen.getByLabelText('progress.toggle_detail'));
    expect(panel?.getAttribute('data-open')).toBe('true');  // クリックで展開
    fireEvent.click(screen.getByLabelText('progress.toggle_detail'));
    expect(panel?.getAttribute('data-open')).toBe('false'); // 再クリックで閉じる
  });
});
