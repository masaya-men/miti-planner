import { describe, it, expect } from 'vitest';
import { parseMemoLinks } from '../parseMemoLinks';

describe('parseMemoLinks', () => {
  it('URLのみ → url セグメント1つ', () => {
    expect(parseMemoLinks('https://example.com')).toEqual([
      { type: 'url', value: 'https://example.com' },
    ]);
  });

  it('文章+URL+文章の混在を分解する', () => {
    expect(parseMemoLinks('見て https://a.com ここで軽減')).toEqual([
      { type: 'text', value: '見て ' },
      { type: 'url', value: 'https://a.com' },
      { type: 'text', value: ' ここで軽減' },
    ]);
  });

  it('1メモ内の複数URLをすべて拾う', () => {
    expect(parseMemoLinks('a https://x.com b https://y.com c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'url', value: 'https://x.com' },
      { type: 'text', value: ' b ' },
      { type: 'url', value: 'https://y.com' },
      { type: 'text', value: ' c' },
    ]);
  });

  it('全角括弧で囲まれたURLは括弧をリンクに含めない', () => {
    expect(parseMemoLinks('（https://example.com）')).toEqual([
      { type: 'text', value: '（' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '）' },
    ]);
  });

  it('末尾の句点はリンクに含めない', () => {
    expect(parseMemoLinks('https://example.com。')).toEqual([
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '。' },
    ]);
  });

  it('javascript: はリンクにしない(ただの文字)', () => {
    expect(parseMemoLinks('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('data: はリンクにしない', () => {
    expect(parseMemoLinks('data:text/html,x')).toEqual([
      { type: 'text', value: 'data:text/html,x' },
    ]);
  });

  it('www.(scheme無し) はリンクにしない', () => {
    expect(parseMemoLinks('www.example.com')).toEqual([
      { type: 'text', value: 'www.example.com' },
    ]);
  });

  it('ドットを含むただの文字を誤爆しない', () => {
    expect(parseMemoLinks('P12S.2 で 8.0 を使う')).toEqual([
      { type: 'text', value: 'P12S.2 で 8.0 を使う' },
    ]);
  });

  it('http(s)://で始まるが new URL で無効なものは文字扱い(二重ガード)', () => {
    expect(parseMemoLinks('https://[bad')).toEqual([
      { type: 'text', value: 'https://[bad' },
    ]);
  });

  it('空文字は空配列', () => {
    expect(parseMemoLinks('')).toEqual([]);
  });
});
