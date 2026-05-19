// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHousingFieldState } from '../../lib/housing/housingFieldState';

describe('useHousingFieldState', () => {
    it('initial state is empty for all fields', () => {
        const { result } = renderHook(() => useHousingFieldState());
        expect(result.current.getState('dc')).toBe('empty');
    });

    it('setAutoFilled marks field as auto-filled', () => {
        const { result } = renderHook(() => useHousingFieldState());
        act(() => result.current.setAutoFilled('dc', 'Mana'));
        expect(result.current.getState('dc')).toBe('auto-filled');
        expect(result.current.getValue('dc')).toBe('Mana');
    });

    it('confirm transitions auto-filled → confirmed', () => {
        const { result } = renderHook(() => useHousingFieldState());
        act(() => result.current.setAutoFilled('dc', 'Mana'));
        act(() => result.current.confirm('dc'));
        expect(result.current.getState('dc')).toBe('confirmed');
    });

    it('userEdit transitions auto-filled → edited', () => {
        const { result } = renderHook(() => useHousingFieldState());
        act(() => result.current.setAutoFilled('dc', 'Mana'));
        act(() => result.current.userEdit('dc', 'Materia'));
        expect(result.current.getState('dc')).toBe('edited');
        expect(result.current.getValue('dc')).toBe('Materia');
    });

    it('isReadyToSubmit returns false when required field is empty', () => {
        const { result } = renderHook(() => useHousingFieldState(['dc', 'server']));
        expect(result.current.isReadyToSubmit()).toBe(false);
    });

    it('isReadyToSubmit returns true when all required fields are confirmed or edited', () => {
        const { result } = renderHook(() => useHousingFieldState(['dc']));
        act(() => result.current.setAutoFilled('dc', 'Mana'));
        expect(result.current.isReadyToSubmit()).toBe(false);
        act(() => result.current.confirm('dc'));
        expect(result.current.isReadyToSubmit()).toBe(true);
    });

    it('isReadyToSubmit returns false when any field is in error state', () => {
        const { result } = renderHook(() => useHousingFieldState(['dc']));
        act(() => result.current.userEdit('dc', 'Mana'));
        act(() => result.current.setError('dc', 'required'));
        expect(result.current.isReadyToSubmit()).toBe(false);
    });
});
