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

describe.each([['grid'], ['sidebar']] as const)('buildHousingerCard(pattern=%s)', (pattern) => {
  it('画像0枚(物件0件/全滅)でもフォールバック背景付きで破綻しない', () => {
    const tree = buildHousingerCard({ pattern, name: 'ソロ活動家', bio: null, avatarSrc: null, imageSrcs: [] });
    expect(countImgNodes(tree)).toBe(0);
    expect(findByText(tree, 'ソロ活動家')).toBe(true);
  });

  it('画像1枚でも写真スロット10個全てに巡回コピーされて埋まる(常に10枚グリッド)', () => {
    const tree = buildHousingerCard({ pattern, name: 'テスト', bio: null, avatarSrc: null, imageSrcs: ['data:image/png;base64,AAA'] });
    expect(countImgNodes(tree)).toBe(10);
    // 背景兼ヒーロー使用の核心: 背景レイヤー(children[0])のbackgroundImageが
    // 巡回コピー元の画像と同じdata URIを指していること(配線ミスで背景に渡し忘れる事故を検知する)
    const backgroundLayer = tree.props.children[0] as { props: { style: { backgroundImage: string } } };
    expect(backgroundLayer.props.style.backgroundImage).toContain('data:image/png;base64,AAA');
  });

  it('画像3枚は10枚になるまで先頭から巡回コピーされる(3,3,3,1で10)', () => {
    const imageSrcs = ['data:image/png;base64,A', 'data:image/png;base64,B', 'data:image/png;base64,C'];
    const tree = buildHousingerCard({ pattern, name: 'テスト', bio: null, avatarSrc: null, imageSrcs });
    expect(countImgNodes(tree)).toBe(10);
  });

  it('画像10枚全てがグリッドに描画される(背景兼ヒーロー1 + 写真10枚)', () => {
    const imageSrcs = Array.from({ length: 10 }, (_, i) => `data:image/png;base64,IMG${i}`);
    const tree = buildHousingerCard({ pattern, name: 'テスト', bio: 'よろしく', avatarSrc: null, imageSrcs });
    expect(countImgNodes(tree)).toBe(10);
  });

  it('11枚以上渡されても先頭10枚のみ使われる', () => {
    const imageSrcs = Array.from({ length: 15 }, (_, i) => `data:image/png;base64,IMG${i}`);
    const tree = buildHousingerCard({ pattern, name: 'テスト', bio: null, avatarSrc: null, imageSrcs });
    expect(countImgNodes(tree)).toBe(10);
  });

  it('紹介文が無ければbio行を出さない', () => {
    const tree = buildHousingerCard({ pattern, name: 'テスト', bio: '', avatarSrc: null, imageSrcs: [] });
    expect(findByText(tree, '')).toBe(false);
  });

  it('ブランド文字("Shared via"/"LoPo")を必ず含む', () => {
    const tree = buildHousingerCard({ pattern, name: 'テスト', bio: null, avatarSrc: null, imageSrcs: [] });
    expect(findByText(tree, 'Shared via')).toBe(true);
    expect(findByText(tree, 'LoPo')).toBe(true);
  });

  it('アバターURLがあればimgノードとして描画される(写真0枚でも)', () => {
    const tree = buildHousingerCard({ pattern, name: 'テスト', bio: null, avatarSrc: 'data:image/png;base64,AVATAR', imageSrcs: [] });
    expect(countImgNodes(tree)).toBe(1);
  });
});

describe('buildHousingerCard 紹介文の表示(写真ありグリッド/サイドバー、どちらもコラージュには出さない)', () => {
  const imageSrcs = ['data:image/png;base64,A'];

  it('gridパターンは紹介文を表示しない(2026-08-04ユーザー指摘でコラージュから撤去)', () => {
    const tree = buildHousingerCard({ pattern: 'grid', name: 'テスト', bio: 'よろしく', avatarSrc: null, imageSrcs });
    expect(findByText(tree, 'よろしく')).toBe(false);
  });

  it('sidebarパターンは紹介文を表示しない(縦書き帯に紹介文を置く余白が無い設計)', () => {
    const tree = buildHousingerCard({ pattern: 'sidebar', name: 'テスト', bio: 'よろしく', avatarSrc: null, imageSrcs });
    expect(findByText(tree, 'よろしく')).toBe(false);
  });
});

describe('buildHousingerFallbackCard', () => {
  it('従来どおり名前とLoPo Housing表記のみで構成される', () => {
    const tree = buildHousingerFallbackCard('テスト');
    expect(findByText(tree, 'テスト')).toBe(true);
    expect(findByText(tree, 'LoPo Housing')).toBe(true);
  });
});
