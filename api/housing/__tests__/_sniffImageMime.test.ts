import { describe, it, expect } from 'vitest';
import { sniffUploadImageMime } from '../_sniffImageMime.js';

const bytes = (...n: number[]) => new Uint8Array(n);
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

describe('sniffUploadImageMime', () => {
  it('PNG を判定する', () => {
    expect(sniffUploadImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
  });
  it('JPEG を判定する', () => {
    expect(sniffUploadImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });
  it('WebP を判定する', () => {
    expect(sniffUploadImageMime(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))).toBe('image/webp');
  });
  it('RIFF でも WEBP でなければ null', () => {
    expect(sniffUploadImageMime(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')))).toBeNull();
  });
  it('AVIF (avif / avis) を判定する', () => {
    expect(sniffUploadImageMime(bytes(0, 0, 0, 0x1c, ...ascii('ftyp'), ...ascii('avif')))).toBe('image/avif');
    expect(sniffUploadImageMime(bytes(0, 0, 0, 0x1c, ...ascii('ftyp'), ...ascii('avis')))).toBe('image/avif');
  });
  it('ftyp でも heic などは null', () => {
    expect(sniffUploadImageMime(bytes(0, 0, 0, 0x1c, ...ascii('ftyp'), ...ascii('heic')))).toBeNull();
  });
  it('SVG テキストは null', () => {
    expect(sniffUploadImageMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });
  it('短すぎる buf は null', () => {
    expect(sniffUploadImageMime(bytes())).toBeNull();
    expect(sniffUploadImageMime(bytes(0x89, 0x50))).toBeNull();
  });
});
