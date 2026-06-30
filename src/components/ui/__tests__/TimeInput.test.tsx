// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeInput } from '../TimeInput';

const get = () => screen.getByTestId('t') as HTMLInputElement;

describe('TimeInput', () => {
  it('秒を M:SS で表示する', () => {
    render(<TimeInput value={375} onChange={() => {}} data-testid="t" />);
    expect(get().value).toBe('6:15');
  });

  it('null は空表示', () => {
    render(<TimeInput value={null} onChange={() => {}} data-testid="t" />);
    expect(get().value).toBe('');
  });

  it('"6:15" を秒に変換して emit', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '6:15' } });
    expect(onChange).toHaveBeenLastCalledWith(375);
  });

  it('裸の秒数も受ける', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '375' } });
    expect(onChange).toHaveBeenLastCalledWith(375);
  });

  it('全角 ６：１５ を受ける', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '６：１５' } });
    expect(onChange).toHaveBeenLastCalledWith(375);
  });

  it('空にすると null を emit', () => {
    const onChange = vi.fn();
    render(<TimeInput value={375} onChange={onChange} data-testid="t" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('maxSeconds で上限を clamp(emit時)', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} maxSeconds={100} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '5:00' } });
    expect(onChange).toHaveBeenLastCalledWith(100);
  });
});
