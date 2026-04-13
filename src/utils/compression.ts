import type { PlanData } from '../types';

/** PlanData を gzip 圧縮して base64 文字列に変換する */
export async function compressPlanData(data: PlanData): Promise<string> {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const input = encoder.encode(json);

    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(input);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }

    return btoa(String.fromCharCode(...merged));
}

/** base64 + gzip 圧縮データを PlanData に復元する */
export async function decompressPlanData(compressed: string): Promise<PlanData> {
    const binary = atob(compressed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(merged));
}
