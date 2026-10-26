import { describe, it, expect } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { classifyRequest, apiFixtureKey, mulberry32 } from '../lib/determinism.mjs';

const APP = 'http://localhost:5182';

describe('classifyRequest', () => {
  const table: [string, string][] = [
    ['http://localhost:5182/src/main.tsx', 'app'],
    ['http://localhost:5182/housing/a.webp', 'app'],
    ['http://localhost:5182/api/housing/public?action=gallery', 'api'],
    ['http://localhost:5182/api/collab/_roomLogic.ts', 'app'],
    ['http://localhost:5182/api/x.js', 'api'],
    ['https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen', 'block'],
    ['https://fonts.gstatic.com/s/x.woff2', 'font'],
    ['https://fonts.googleapis.com/css2?family=Inter', 'font'],
    ['https://pbs.twimg.com/media/a.jpg', 'image'],
    ['https://firebasestorage.googleapis.com/v0/b/x/o/y.png', 'image'],
    ['https://lopoly.app/housing-media/a.webp', 'image'],
    ['https://media.lopoly.app/a.webp', 'image'],
    ['https://i.ytimg.com/vi/x/hq.jpg', 'image'],
    ['https://www.google.com/recaptcha/api.js', 'block'],
    ['https://www.youtube.com/embed/x', 'block'],
    ['https://example.com/x', 'unknown'],
    ['wss://lopo-collab.x.workers.dev', 'block'],
  ];
  it.each(table)('%s -> %s', (url, expected) => {
    expect(classifyRequest(url, APP)).toBe(expected);
  });
});

describe('apiFixtureKey', () => {
  const table: [string, string][] = [
    ['/api/housing/public?action=gallery&v=123', 'housing-public.gallery'],
    ['/api/template?action=public-template&id=X', 'template.public-template.X'],
    ['/api/template?action=public-notifications', 'template.public-notifications'],
    ['/api/housing/public?action=listing&id=vr-l1&v=9', 'housing-public.listing.vr-l1'],
  ];
  it.each(table)('%s -> %s', (url, expected) => {
    expect(apiFixtureKey(url)).toBe(expected);
  });
});

describe('mulberry32', () => {
  it('同じ種なら最初の 3 値が一致する', () => {
    const a = mulberry32(20261026);
    const b = mulberry32(20261026);
    const va = [a(), a(), a()];
    const vb = [b(), b(), b()];
    expect(va).toEqual(vb);
    expect(va.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});
