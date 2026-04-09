// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { getPipNotes, setPipNote, clearPipNotes } from '../hooks/usePipNotes';

describe('usePipNotes', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns empty object for unknown planId', () => {
        expect(getPipNotes('plan-123')).toEqual({});
    });

    it('sets and gets a note for an event', () => {
        setPipNote('plan-123', 'event-1', '散開');
        expect(getPipNotes('plan-123')).toEqual({ 'event-1': '散開' });
    });

    it('overwrites existing note', () => {
        setPipNote('plan-123', 'event-1', '散開');
        setPipNote('plan-123', 'event-1', '頭割り');
        expect(getPipNotes('plan-123')).toEqual({ 'event-1': '頭割り' });
    });

    it('clears a note when set to empty string', () => {
        setPipNote('plan-123', 'event-1', '散開');
        setPipNote('plan-123', 'event-1', '');
        expect(getPipNotes('plan-123')).toEqual({});
    });

    it('isolates notes per planId', () => {
        setPipNote('plan-A', 'event-1', 'メモA');
        setPipNote('plan-B', 'event-1', 'メモB');
        expect(getPipNotes('plan-A')).toEqual({ 'event-1': 'メモA' });
        expect(getPipNotes('plan-B')).toEqual({ 'event-1': 'メモB' });
    });

    it('clearPipNotes removes all notes for a plan', () => {
        setPipNote('plan-123', 'event-1', 'メモ1');
        setPipNote('plan-123', 'event-2', 'メモ2');
        clearPipNotes('plan-123');
        expect(getPipNotes('plan-123')).toEqual({});
    });
});
