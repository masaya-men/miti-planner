import { describe, it, expect } from 'vitest';
import { buildHousingerCard, buildHousingerFallbackCard } from '../_housingerCard.js';

function findByText(node: any, text: string): boolean {
  if (node == null) return false;
  if (typeof node === 'string') return node === text;
  if (Array.isArray(node)) return node.some((n) => findByText(n, text));
  if (node.props?.children != null) return findByText(node.props.children, text);
  return false;
}

function countImgNodes(node: any): number {
  if (node == null) return 0;
  if (Array.isArray(node)) return node.reduce((sum, n) => sum + countImgNodes(n), 0);
  if (typeof node !== 'object') return 0;
  let count = node.type === 'img' ? 1 : 0;
  if (node.props?.children != null) count += countImgNodes(node.props.children);
  return count;
}

describe('buildHousingerCard', () => {
  it('画像0枚(物件0件/全滅)でもフォールバック背景付きで破綻しない', () => {
    const tree = buildHousingerCard({ name: 'ソロ活動家', bio: null, avatarSrc: null, imageSrcs: [] });
    expect(countImgNodes(tree)).toBe(0);
    expect(findByText(tree, 'ソロ活動家')).toBe(true);
  });

  it('画像1枚は背景兼ヒーローとして使われる(背景はCSS backgroundImageスタイルのdivのため、imgノードとしてはヒーロー表示の1回のみ)', () => {
    const tree = buildHousingerCard({ name: 'テスト', bio: null, avatarSrc: null, imageSrcs: ['data:image/png;base64,AAA'] });
    // 背景は既存_tourInviteCard.tsと同じくCSS backgroundImageスタイルで敷かれる(imgタグではない)ため
    // imgノードとしてはパネル内ヒーロー表示の1回のみ
    expect(countImgNodes(tree)).toBe(1);
    // 背景兼ヒーロー使用の核心: 背景レイヤー(children[0])のbackgroundImageが
    // ヒーロー画像と同じdata URIを指していること(配線ミスで背景に渡し忘れる事故を検知する)
    const backgroundLayer = tree.props.children[0];
    expect(backgroundLayer.props.style.backgroundImage).toContain('data:image/png;base64,AAA');
  });

  it('画像10枚全てがグリッドに描画される(背景兼ヒーロー1 + 上4 + 中1 + 下4)', () => {
    const imageSrcs = Array.from({ length: 10 }, (_, i) => `data:image/png;base64,IMG${i}`);
    const tree = buildHousingerCard({ name: 'テスト', bio: 'よろしく', avatarSrc: null, imageSrcs });
    // 背景はCSS backgroundImageスタイルのためimgノードにカウントされない。ヒーロー1 + 残り9枚 = 10個のimgノード
    expect(countImgNodes(tree)).toBe(10);
    expect(findByText(tree, 'よろしく')).toBe(true);
  });

  it('紹介文が無ければbio行を出さない', () => {
    const tree = buildHousingerCard({ name: 'テスト', bio: '', avatarSrc: null, imageSrcs: [] });
    expect(findByText(tree, '')).toBe(false);
  });

  it('「Shared via LoPo Housing」の固定英語表記を必ず含む', () => {
    const tree = buildHousingerCard({ name: 'テスト', bio: null, avatarSrc: null, imageSrcs: [] });
    expect(findByText(tree, 'Shared via LoPo Housing')).toBe(true);
  });
});

describe('buildHousingerFallbackCard', () => {
  it('従来どおり名前とLoPo Housing表記のみで構成される', () => {
    const tree = buildHousingerFallbackCard('テスト');
    expect(findByText(tree, 'テスト')).toBe(true);
    expect(findByText(tree, 'LoPo Housing')).toBe(true);
  });
});
