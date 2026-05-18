import { useEffect } from 'react';
import { useHousingTourStore } from '../../../store/useHousingTourStore';

/**
 * Headless controller that wires keyboard navigation to the tour store.
 * §6.2: Enter / Space → next, ArrowRight → next, ArrowLeft → prev.
 * Listener only attaches while a tour is running, and ignores keys typed into
 * form fields / contenteditable surfaces.
 */
export const TourKeyboardController: React.FC = () => {
    const running = useHousingTourStore((s) => s.running);
    const next = useHousingTourStore((s) => s.next);
    const prev = useHousingTourStore((s) => s.prev);

    useEffect(() => {
        if (!running) return;
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
            }
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                e.preventDefault();
                next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prev();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [running, next, prev]);

    return null;
};
