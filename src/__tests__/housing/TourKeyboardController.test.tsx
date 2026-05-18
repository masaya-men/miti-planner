// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TourKeyboardController } from '../../components/housing/workspace/TourKeyboardController';
import { useHousingTourStore } from '../../store/useHousingTourStore';

describe('TourKeyboardController', () => {
    beforeEach(() => {
        useHousingTourStore.getState().reset();
        useHousingTourStore.getState().setListings(['a', 'b', 'c']);
        useHousingTourStore.getState().start();
    });

    it('advances on Enter', () => {
        render(<TourKeyboardController />);
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(useHousingTourStore.getState().currentIndex).toBe(1);
    });

    it('advances on Space', () => {
        render(<TourKeyboardController />);
        fireEvent.keyDown(window, { key: ' ' });
        expect(useHousingTourStore.getState().currentIndex).toBe(1);
    });

    it('advances on ArrowRight', () => {
        render(<TourKeyboardController />);
        fireEvent.keyDown(window, { key: 'ArrowRight' });
        expect(useHousingTourStore.getState().currentIndex).toBe(1);
    });

    it('retreats on ArrowLeft after advancing', () => {
        useHousingTourStore.getState().next();
        render(<TourKeyboardController />);
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        expect(useHousingTourStore.getState().currentIndex).toBe(0);
    });

    it('ignores Enter when tour is not running', () => {
        useHousingTourStore.getState().stop();
        render(<TourKeyboardController />);
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(useHousingTourStore.getState().currentIndex).toBe(0);
    });

    it('ignores keys while focus is in an INPUT', () => {
        const { container } = render(
            <>
                <TourKeyboardController />
                <input data-testid="ipt" />
            </>,
        );
        const input = container.querySelector('input') as HTMLInputElement;
        input.focus();
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(useHousingTourStore.getState().currentIndex).toBe(0);
    });
});
