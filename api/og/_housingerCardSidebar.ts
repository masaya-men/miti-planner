/**
 * ハウジンガー OGP カードの sidebar パターン(左端に縦書きブランド文字+アバター、右に写真10枚)。
 */
import { BG_COLOR, CARD_HEIGHT } from './_housingerCardTokens.js';
import { buildAvatarNode, buildBackdropLayer, buildBrandLine, buildCopyrightLine, buildFrameLayer, buildPhotoTile } from './_housingerCardParts.js';

/** sidebar パターン: 縦書きブロックの位置・サイズ(Artifact確定値)。 */
export const SIDEBAR_TEXT_TOP = 572;
export const SIDEBAR_TEXT_LEFT = 79;
export const SIDEBAR_FONT_SIZE = 43;
export const SIDEBAR_ROW_GAP = 0;
export const SIDEBAR_AVATAR_SIZE = 70;
/** row1(アバター+名前)内の間隔。2,3行目をこの分だけ右にmarginLeftして名前の頭に揃える。 */
export const SIDEBAR_ROW1_GAP = 12;
export const SIDEBAR_NAME_MAX_WIDTH = 500;
/** 縦書きテキストの背後の黒帯(手本SVG実測: 平塗りrgba(0,0,0,0.5)で正しい、写真重ねではない)。 */
export const SIDEBAR_BAND_LEFT = 67;
export const SIDEBAR_BAND_WIDTH = 222;

// =========================================================================
// パターン sidebar: 左端に縦書きブランド文字+アバター、右側に写真10枚
// (上下2枚組×2列+中央大判+下段5枚)。座標は NoraSieHousing.svg の clipPath 実測値。
// =========================================================================
export function buildSidebarPattern(displayName: string, avatarSrc: string | null, heroSrc: string, photos: string[]) {
  const [topLeft, belowTopLeft, topRight, belowTopRight, centerBig, b1, b2, b3, b4, b5] = photos;

  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif' },
      children: [
        buildBackdropLayer(heroSrc),
        // 縦書きテキストの背後の黒帯(2026-08-04 手本SVG実測: 平塗りrgba(0,0,0,0.5)で正しい。
        // grid側の中央パッチと違いこちらは写真重ねではない)。
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: 0, left: SIDEBAR_BAND_LEFT, width: SIDEBAR_BAND_WIDTH, height: CARD_HEIGHT, display: 'flex', backgroundColor: 'rgba(0,0,0,0.5)' },
          },
        },
        buildFrameLayer(),
        // 左: 縦書きテキスト(名前/Shared via/LoPoの3行、flex-columnをrotate(-90deg)で回転)。
        // アバターはこのブロックに含めない(satoriの実バグ: 回転した祖先の中に画像を2階層以上
        // ネストすると空描画になる。transformOrigin:'left top'指定時に特に顕著・2026-08-04実機確認)。
        // 名前は文字を縮小せず、SIDEBAR_NAME_MAX_WIDTHを超えたら自然に2行目へ折り返す
        // (Shared via/LoPoは1行のまま・アバター分の空きスペースだけ確保して頭を揃える)。
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: SIDEBAR_TEXT_TOP, left: SIDEBAR_TEXT_LEFT,
              transform: 'rotate(-90deg)', transformOrigin: 'left top',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: SIDEBAR_ROW_GAP,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: SIDEBAR_ROW1_GAP, minHeight: SIDEBAR_AVATAR_SIZE },
                  children: [
                    { type: 'div', props: { style: { width: SIDEBAR_AVATAR_SIZE, height: 1, display: 'flex' } } },
                    buildBrandLine(displayName, SIDEBAR_FONT_SIZE, { maxWidth: SIDEBAR_NAME_MAX_WIDTH }),
                  ],
                },
              },
              buildBrandLine('Shared via', SIDEBAR_FONT_SIZE, { marginLeft: SIDEBAR_AVATAR_SIZE + SIDEBAR_ROW1_GAP, lineHeight: 1.25 }),
              buildBrandLine('LoPo', SIDEBAR_FONT_SIZE, { marginLeft: SIDEBAR_AVATAR_SIZE + SIDEBAR_ROW1_GAP, lineHeight: 1.25 }),
            ],
          },
        },
        // アバター: テキストブロックとは別要素で独立回転(transformOrigin省略=中心基準)。
        // 正方形を自身の中心で回転しても見た目のbboxは変わらないため、テキストブロックの
        // row1(アバター分の空きスペース)と同じ位置になるよう算出したtop/leftをそのまま使う。
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: SIDEBAR_TEXT_TOP - SIDEBAR_AVATAR_SIZE, left: SIDEBAR_TEXT_LEFT, display: 'flex', transform: 'rotate(-90deg)' },
            children: buildAvatarNode(avatarSrc, displayName, SIDEBAR_AVATAR_SIZE),
          },
        },
        // 右: 写真コラージュ(絶対配置・実測座標)
        buildPhotoTile(36, 331, 219, 204, topLeft),
        buildPhotoTile(248, 331, 219, 205, belowTopLeft),
        buildPhotoTile(36, 940, 219, 204, topRight),
        buildPhotoTile(252, 940, 219, 203, belowTopRight),
        buildPhotoTile(78, 571, 347, 324, centerBig),
        buildPhotoTile(465, 331, 145, 135, b1),
        buildPhotoTile(465, 503, 145, 135, b2),
        buildPhotoTile(465, 673, 145, 135, b3),
        buildPhotoTile(465, 844, 145, 135, b4),
        buildPhotoTile(465, 1014, 145, 135, b5),
        buildCopyrightLine(),
      ],
    },
  };
}

