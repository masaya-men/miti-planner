// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumericInput } from '../NumericInput';

const get = () => screen.getByTestId('n') as HTMLInputElement;

describe('NumericInput', () => {
  it('桁区切りで初期表示する(非フォーカス時)', () => {
    render(<NumericInput value={50000} onChange={() => {}} thousandSeparator data-testid="n" />);
    expect(get().value).toBe('50,000');
  });

  it('入力すると数値を emit する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '1234' } });
    expect(onChange).toHaveBeenLastCalledWith(1234);
  });

  it('空欄を許す(表示は空・値は0を emit)', () => {
    const onChange = vi.fn();
    render(<NumericInput value={5} onChange={onChange} data-testid="n" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '' } });
    expect(get().value).toBe('');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('全角数字を半角化する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '５０００' } });
    expect(onChange).toHaveBeenLastCalledWith(5000);
  });

  it('blur で max を clamp し整形する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} min={0} max={100} thousandSeparator data-testid="n" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '150' } });
    fireEvent.blur(get());
    expect(onChange).toHaveBeenLastCalledWith(100);
    expect(get().value).toBe('100');
  });

  it('blur で min を clamp する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={50} onChange={onChange} min={10} data-testid="n" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '3' } });
    fireEvent.blur(get());
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('整数モードでドットを除去し NaN を防ぐ', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '1.2.3' } });
    expect(onChange).toHaveBeenLastCalledWith(123);
  });

  it('小数モードで小数を受ける', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} decimalPlaces={1} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });
});
