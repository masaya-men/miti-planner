import { describe, it, expect } from 'vitest';
import { twitterImageVariant } from '../twitterImageVariant';

describe('twitterImageVariant', () => {
  it('pbs.twimg.com/media の .jpg に ?name= を付ける', () => {
    expect(twitterImageVariant('https://pbs.twimg.com/media/ABC.jpg', 'small')).toBe(
      'https://pbs.twimg.com/media/ABC.jpg?name=small',
    );
  });

  it('既存クエリがあればマージする', () => {
    expect(twitterImageVariant('https://pbs.twimg.com/media/ABC.jpg?format=jpg', 'small')).toBe(
      'https://pbs.twimg.com/media/ABC.jpg?format=jpg&name=small',
    );
  });

  it('既に name= があれば上書きする', () => {
    expect(twitterImageVariant('https://pbs.twimg.com/media/ABC.jpg?name=large', 'small')).toBe(
      'https://pbs.twimg.com/media/ABC.jpg?name=small',
    );
  });

  it('media 以外の pbs.twimg.com(amplify_video_thumb 等)は素通し', () => {
    const u = 'https://pbs.twimg.com/amplify_video_thumb/123/img/xyz.jpg';
    expect(twitterImageVariant(u, 'small')).toBe(u);
  });

  it('pbs.twimg.com 以外(YouTube・housing-media)は素通し', () => {
    for (const u of [
      'https://img.youtube.com/vi/ID/hqdefault.jpg',
      'https://lopoly.app/housing-media/L1/u.webp',
      'garbage',
    ]) {
      expect(twitterImageVariant(u, 'small')).toBe(u);
    }
  });
});
