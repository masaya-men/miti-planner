import { describe, it, expect } from 'vitest';
import { parseYouTubeId } from '../youtube';

describe('parseYouTubeId', () => {
    it('youtu.be 短縮URL', () => {
        expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('watch?v= 形式', () => {
        expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('watch?v= に余分なクエリ(t,list)が付いても抽出', () => {
        expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s&list=ABC')).toBe('dQw4w9WgXcQ');
    });
    it('youtu.be にタイムスタンプ付き', () => {
        expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    });
    it('embed 形式', () => {
        expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('shorts 形式', () => {
        expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('live 形式 (ライブ配信URL)', () => {
        expect(parseYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('live 形式 にクエリ(si,feature)が付いても抽出', () => {
        expect(parseYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ?si=abc&feature=share')).toBe('dQw4w9WgXcQ');
    });
    it('m.youtube.com', () => {
        expect(parseYouTubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('生の11文字ID', () => {
        expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });
    it('不正なURLは null', () => {
        expect(parseYouTubeId('https://example.com/watch?v=xxx')).toBeNull();
    });
    it('空文字は null', () => {
        expect(parseYouTubeId('')).toBeNull();
    });
});
