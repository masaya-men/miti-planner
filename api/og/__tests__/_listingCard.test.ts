import { describe, it, expect } from 'vitest';
import { buildListingPhotoCard, buildListingBrandFallbackCard } from '../_listingCard.js';

function countImgNodes(node: any): number {
  if (node == null) return 0;
  if (Array.isArray(node)) return node.reduce((s, n) => s + countImgNodes(n), 0);
  if (typeof node !== 'object') return 0;
  let c = node.type === 'img' ? 1 : 0;
  if (node.props?.children != null) c += countImgNodes(node.props.children);
  return c;
}
function findByText(node: any, text: string): boolean {
  if (node == null) return false;
  if (typeof node === 'string') return node === text;
  if (Array.isArray(node)) return node.some((n) => findByText(n, text));
  if (node.props?.children != null) return findByText(node.props.children, text);
  return false;
}

describe('buildListingPhotoCard', () => {
  const uri = 'data:image/jpeg;base64,AAA';

  it('写真を img ノードとして 1 つ描画する', () => {
    expect(countImgNodes(buildListingPhotoCard(uri))).toBe(1);
  });

  it('ぼかし背景レイヤーの backgroundImage が同じ写真を指す(配線ミス検知)', () => {
    const tree = buildListingPhotoCard(uri) as any;
    const bg = tree.props.children[0];
    expect(bg.props.style.backgroundImage).toContain(uri);
  });

  it('img の objectFit は contain(切らずに収める)', () => {
    const tree = buildListingPhotoCard(uri) as any;
    const img = tree.props.children[2];
    expect(img.type).toBe('img');
    expect(img.props.style.objectFit).toBe('contain');
  });

  it('タイトル/住所/ブランド印は含まない(「LoPo」文字が無い)', () => {
    expect(findByText(buildListingPhotoCard(uri), 'LoPo')).toBe(false);
  });

  it('SQUARE ENIX 著作権表記を必ず含む', () => {
    expect(findByText(buildListingPhotoCard(uri), '© SQUARE ENIX CO., LTD. All Rights Reserved.')).toBe(true);
  });

  it('全面レイヤーは inset:0 省略記法を使わず 4 辺個別指定(satori バグ回避)', () => {
    const tree = buildListingPhotoCard(uri) as any;
    const bg = tree.props.children[0].props.style;
    expect(bg.top).toBe(0);
    expect(bg.right).toBe(0);
    expect(bg.bottom).toBe(0);
    expect(bg.left).toBe(0);
    expect(bg.inset).toBeUndefined();
  });
});

describe('buildListingBrandFallbackCard', () => {
  it('「LoPo Housing」テキストを含む', () => {
    expect(findByText(buildListingBrandFallbackCard(), 'LoPo Housing')).toBe(true);
  });
  it('SQUARE ENIX 著作権表記を含む', () => {
    expect(findByText(buildListingBrandFallbackCard(), '© SQUARE ENIX CO., LTD. All Rights Reserved.')).toBe(true);
  });
  it('img ノードを含まない', () => {
    expect(countImgNodes(buildListingBrandFallbackCard())).toBe(0);
  });
});
