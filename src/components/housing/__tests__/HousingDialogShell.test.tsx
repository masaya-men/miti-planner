// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HousingDialogShell } from '../HousingDialogShell';
import { HousingPanelModal } from '../HousingPanelModal';

const clickBackdrop = (el: Element) => {
  fireEvent.pointerDown(el);
  fireEvent.pointerUp(el);
  fireEvent.click(el);
};

const Dialog = ({ onClose, locked }: { onClose: () => void; locked?: boolean }) => (
  <HousingDialogShell data-testid="bd" className="housing-modal-backdrop" onClose={onClose} locked={locked}>
    <div role="dialog" aria-modal="true">
      <input aria-label="欄" />
      <button type="button">中のボタン</button>
    </div>
  </HousingDialogShell>
);

describe('HousingDialogShell', () => {
  it('背景のクラスはそのまま付く(見た目は各窓のまま)', () => {
    render(<Dialog onClose={() => {}} />);
    expect(screen.getByTestId('bd').className).toBe('housing-modal-backdrop');
  });

  it('Esc で閉じる', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('外側クリックで閉じ、中のクリックでは閉じない', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    clickBackdrop(screen.getByText('中のボタン'));
    expect(onClose).not.toHaveBeenCalled();
    clickBackdrop(screen.getByTestId('bd'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('入力したあとの外側クリックでは閉じない(Esc は効く)', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.input(screen.getByLabelText('欄'), { target: { value: 'a' } });
    clickBackdrop(screen.getByTestId('bd'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locked の間は Esc も外側クリックも効かない', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} locked />);
    fireEvent.keyDown(document, { key: 'Escape' });
    clickBackdrop(screen.getByTestId('bd'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ガラス窓の上に重なっていたら Esc は上の確認窓だけ閉じる', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(
      <>
        <HousingPanelModal open onClose={lower} title="下" closeLabel="閉じる">
          <p />
        </HousingPanelModal>
        <Dialog onClose={upper} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });
});

describe('HousingPanelModal の閉じ方', () => {
  const Panel = ({ onClose, dirty }: { onClose: () => void; dirty?: boolean }) => (
    <HousingPanelModal
      open
      onClose={onClose}
      title="窓"
      closeLabel="閉じる"
      backdropOptions={dirty === undefined ? undefined : { autoGuard: false, dirty }}
    >
      <textarea aria-label="本文" />
    </HousingPanelModal>
  );
  const backdrop = () => document.querySelector('.housing-panel-modal-backdrop')!;

  it('外側クリックで閉じる', () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    clickBackdrop(backdrop());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('入力したあとの外側クリックでは閉じない', () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    fireEvent.input(screen.getByLabelText('本文'), { target: { value: 'a' } });
    clickBackdrop(backdrop());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('自動判定を切った窓は dirty の間だけ閉じない(一時追加の窓: 追加後は閉じられる)', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Panel onClose={onClose} dirty />);
    fireEvent.input(screen.getByLabelText('本文'), { target: { value: 'a' } });
    clickBackdrop(backdrop());
    expect(onClose).not.toHaveBeenCalled();
    rerender(<Panel onClose={onClose} dirty={false} />);
    clickBackdrop(backdrop());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('重なったガラス窓は Esc で上だけ閉じる(アカウント窓の上のアイコン変更など)', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(
      <>
        <Panel onClose={lower} />
        <Panel onClose={upper} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
  });
});
