// @vitest-environment happy-dom
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HousingNumberStepper } from '../HousingNumberStepper';

/** value を state で保持し onChange を反映する検証用ラッパ。 */
function Harness({ initial, min = 1, max = 30 }: { initial?: number; min?: number; max?: number }) {
  const [v, setV] = useState<number | undefined>(initial);
  return (
    <>
      <label htmlFor="stepper-test">区</label>
      <HousingNumberStepper id="stepper-test" value={v} min={min} max={max} onChange={setV} />
    </>
  );
}

const input = () => screen.getByLabelText('区') as HTMLInputElement;
const up = () => screen.getByTestId('stepper-test-up');
const down = () => screen.getByTestId('stepper-test-down');

describe('HousingNumberStepper', () => {
  it('未入力で ▼(減らす) を押すと「選べる最大値」になる (自然な下方向)', () => {
    render(<Harness min={1} max={30} />);
    expect(input().value).toBe('');
    fireEvent.click(down());
    expect(input().value).toBe('30');
  });

  it('未入力で ▲(増やす) を押すと最小値 1 になる', () => {
    render(<Harness min={1} max={30} />);
    fireEvent.click(up());
    expect(input().value).toBe('1');
  });

  it('値ありは ▲/▼ で ±1 する', () => {
    render(<Harness initial={5} min={1} max={30} />);
    fireEvent.click(up());
    expect(input().value).toBe('6');
    fireEvent.click(down());
    expect(input().value).toBe('5');
  });

  it('上限でクランプ (30 で ▲ しても 30)', () => {
    render(<Harness initial={30} min={1} max={30} />);
    fireEvent.click(up());
    expect(input().value).toBe('30');
  });

  it('下限でクランプ (1 で ▼ しても 1)', () => {
    render(<Harness initial={1} min={1} max={30} />);
    fireEvent.click(down());
    expect(input().value).toBe('1');
  });

  it('キーボード ↓ でも未入力→最大値になる', () => {
    render(<Harness min={1} max={60} />);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(input().value).toBe('60');
  });

  it('直接入力はそのまま onChange される (範囲外はバリデーション側の責務でクランプしない)', () => {
    render(<Harness min={1} max={30} />);
    fireEvent.change(input(), { target: { value: '12' } });
    expect(input().value).toBe('12');
  });
});
