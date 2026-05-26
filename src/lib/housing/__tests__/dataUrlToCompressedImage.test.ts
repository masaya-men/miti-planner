import { describe, it, expect } from 'vitest';
import { dataUrlToCompressedImage } from '../dataUrlToCompressedImage';

// "Hi" の base64 (= "SGk=") を含む最小 data URL
const TWO_BYTES_BASE64 = 'SGk=';
const TWO_BYTES_DATA_URL = `data:image/webp;base64,${TWO_BYTES_BASE64}`;

describe('dataUrlToCompressedImage', () => {
    it('valid な data URL から CompressedImage を組み立てる', () => {
        const img = dataUrlToCompressedImage(TWO_BYTES_DATA_URL, 'tweet-frame-0.webp');
        expect(img.mimeType).toBe('image/webp');
        expect(img.base64).toBe(TWO_BYTES_BASE64);
        expect(img.file).toBeInstanceOf(File);
        expect(img.file.name).toBe('tweet-frame-0.webp');
        expect(img.file.type).toBe('image/webp');
        expect(img.file.size).toBe(2); // "Hi" = 2 bytes
        expect(img.originalBytes).toBe(2);
        expect(img.compressedBytes).toBe(2);
    });

    it('JPEG data URL でも mimeType を保持', () => {
        const img = dataUrlToCompressedImage(
            `data:image/jpeg;base64,${TWO_BYTES_BASE64}`,
            'frame.jpg',
        );
        expect(img.mimeType).toBe('image/jpeg');
        expect(img.file.type).toBe('image/jpeg');
    });

    it('プレフィックスが data: で始まらないと throw', () => {
        expect(() =>
            dataUrlToCompressedImage('not-a-data-url', 'x.webp'),
        ).toThrow('invalid data URL');
    });

    it('base64 部分が欠けていると throw', () => {
        expect(() =>
            dataUrlToCompressedImage('data:image/webp;base64,', 'x.webp'),
        ).toThrow('invalid data URL');
    });
});
