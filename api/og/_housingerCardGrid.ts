/**
 * ハウジンガー OGP カードの grid パターン(上下2段+中央左右の大判写真、中央にアバター+横書き文字)。
 */
import { BG_COLOR } from './_housingerCardTokens.js';
import { buildAvatarNode, buildBackdropLayer, buildBrandLine, buildCopyrightLine, buildFrameLayer, buildPhotoTile } from './_housingerCardParts.js';

/** grid パターン中央パッチ(2026-08-04 手本SVG実測): 黒塗りではなく、背景と同じ写真を
 * このbox位置に重ね、写真の不透明度+黒の重ねの2層で暗くする(Artifact確定値)。 */
export const GRID_PATCH_TOP = 125;
export const GRID_PATCH_LEFT = 248;
export const GRID_PATCH_WIDTH = 706;
export const GRID_PATCH_HEIGHT = 378;
export const GRID_PATCH_PHOTO_OPACITY = 0.72;
export const GRID_PATCH_TINT_OPACITY = 0.5;
/** grid パターン: アバター+ブランド文字ブロックの位置・サイズ(Artifact確定値)。 */
export const GRID_TEXT_TOP = 213;
export const GRID_TEXT_LEFT = 322;
export const GRID_FONT_SIZE = 48;
export const GRID_AVATAR_SIZE = 70;
export const GRID_NAME_MAX_WIDTH = 500;

// =========================================================================
// パターン grid: 上下2段(各4枚)+中央左右2枚の大判写真、中央の隙間にアバター+横書きテキスト。
// 座標は 3.svg の clipPath 実測値(960x540 viewBox → 1200x630へ scaleX1.25/scaleY1.1667)。
// =========================================================================
export function buildGridPattern(displayName: string, _bio: string | null, avatarSrc: string | null, heroSrc: string, photos: string[]) {
  const [top1, top2, top3, top4, midL, midR, bot1, bot2, bot3, bot4] = photos;
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif' },
      children: [
        buildBackdropLayer(heroSrc),
        buildFrameLayer(),
        buildPhotoTile(31, 33, 267, 141, top1),
        buildPhotoTile(31, 322, 268, 141, top2),
        buildPhotoTile(31, 611, 267, 141, top3),
        buildPhotoTile(31, 900, 267, 141, top4),
        buildPhotoTile(199, 33, 342, 183, midL),
        buildPhotoTile(199, 819, 349, 183, midR),
        buildPhotoTile(427, 33, 267, 160, bot1),
        buildPhotoTile(427, 322, 268, 160, bot2),
        buildPhotoTile(427, 611, 268, 160, bot3),
        buildPhotoTile(427, 900, 268, 160, bot4),
        // 中央パッチ(2026-08-04 手本SVG実測): 黒塗りではなく、背景と同じ写真をこのbox位置に
        // 重ね、①写真自体の不透明度 ②黒の重ね の2層で暗くする(Artifact確定値そのまま)。
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: GRID_PATCH_TOP, left: GRID_PATCH_LEFT, width: GRID_PATCH_WIDTH, height: GRID_PATCH_HEIGHT,
              display: 'flex', backgroundImage: `url(${heroSrc})`, backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: GRID_PATCH_PHOTO_OPACITY,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: GRID_PATCH_TOP, left: GRID_PATCH_LEFT, width: GRID_PATCH_WIDTH, height: GRID_PATCH_HEIGHT,
              display: 'flex', backgroundColor: '#000', opacity: GRID_PATCH_TINT_OPACITY,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: GRID_TEXT_TOP, left: GRID_TEXT_LEFT, display: 'flex', alignItems: 'flex-start', gap: 14 },
            children: [
              buildAvatarNode(avatarSrc, displayName, GRID_AVATAR_SIZE),
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
                  children: [
                    buildBrandLine(displayName, GRID_FONT_SIZE, { maxWidth: GRID_NAME_MAX_WIDTH, lineHeight: 1.15 }),
                    buildBrandLine('Shared via', GRID_FONT_SIZE, { lineHeight: 1.25 }),
                    buildBrandLine('LoPo', GRID_FONT_SIZE, { lineHeight: 1.25 }),
                  ],
                },
              },
            ],
          },
        },
        buildCopyrightLine(),
      ],
    },
  };
}
