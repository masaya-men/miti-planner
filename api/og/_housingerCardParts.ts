/**
 * ハウジンガー OGP カードの共通部品(背景・枠・アバター・ブランド文字・写真タイル・著作権表記)。
 * grid / sidebar / 写真無しカードが共通で使う。
 */
import { TOUR_INVITE_BG_DATA_URI } from './_tourInviteBg.generated.js';
import { ACCENT_HONEY, BORDER_MARGIN, BRAND_FONT_FAMILY, BRAND_FONT_WEIGHT, BRAND_TEXT_COLOR, COPYRIGHT_TEXT, GLOW_TEXT_SHADOW, TEXT_MUTED } from './_housingerCardTokens.js';


/** position:absolute の全面フィット指定。satoriは `inset: 0` 省略記法を描画できず
 * (2026-07-31実機+ローカルsatori直呼び出しで再現・特定: 完全に空描画になる)、
 * 4辺を個別指定すれば正しく描画されるため、絶対配置の全面レイヤーは必ずこちらを使う。 */
export const FULL_BLEED_ABSOLUTE = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

/** 背景兼ヒーロー画像を拡大+ぼかしてカード全面に敷く。画像が無ければツアー招待カードと共通の固定背景。 */
export function buildBackdropLayer(heroSrc: string | null) {
  return {
    type: 'div',
    props: {
      style: {
        ...FULL_BLEED_ABSOLUTE, display: 'flex',
        backgroundImage: `url(${heroSrc ?? TOUR_INVITE_BG_DATA_URI})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        ...(heroSrc ? { filter: 'blur(2px)', transform: 'scale(1.1)' } : {}),
      },
    },
  };
}

/** 可読性のための暗幕。 */
export function buildScrimLayer(opacity: number) {
  return { type: 'div', props: { style: { ...FULL_BLEED_ABSOLUTE, display: 'flex', backgroundColor: `rgba(10,14,24,${opacity})` } } };
}

/** 金枠(honey border frame)。ユーザー提供SVGの実測値(stroke="#ffeb99" width8→px換算約10、余白約16px)。 */
export function buildFrameLayer() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', top: BORDER_MARGIN, right: BORDER_MARGIN, bottom: BORDER_MARGIN, left: BORDER_MARGIN,
        borderRadius: 14, border: `2px solid ${ACCENT_HONEY}`,
        boxShadow: '0 0 20px rgba(255,235,153,0.3)', display: 'flex',
      },
    },
  };
}

export function buildAvatarNode(avatarSrc: string | null, displayName: string, size: number) {
  if (avatarSrc) {
    return {
      type: 'div',
      props: {
        style: { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', display: 'flex', border: `3px solid ${ACCENT_HONEY}`, flex: '0 0 auto' },
        children: { type: 'img', props: { src: avatarSrc, width: size, height: size, style: { objectFit: 'cover', width: size, height: size } } },
      },
    };
  }
  return {
    type: 'div',
    props: {
      style: {
        width: size, height: size, borderRadius: size / 2, display: 'flex', flex: '0 0 auto',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,235,153,0.14)', border: `3px solid ${ACCENT_HONEY}`,
      },
      children: { type: 'div', props: { style: { fontSize: size * 0.42, fontWeight: 900, color: ACCENT_HONEY }, children: displayName.slice(0, 1) } },
    },
  };
}

/** 名前+"Shared via"+"LoPo" の発光3行ブロック。名前が長い場合は自動縮小する。 */
export function buildBrandTextBlock(displayName: string, baseFontSize: number, align: 'flex-start' | 'center') {
  const nameLen = displayName.length;
  const fontSize = nameLen > 20 ? baseFontSize * 0.7 : nameLen > 12 ? baseFontSize * 0.85 : baseFontSize;
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', alignItems: align, gap: 2, minWidth: 0 },
      children: [
        { type: 'div', props: { style: { fontSize, fontWeight: 900, color: '#fff6e6', textShadow: GLOW_TEXT_SHADOW, lineHeight: 1.15, display: 'flex' }, children: displayName } },
        { type: 'div', props: { style: { fontSize: fontSize * 0.5, fontWeight: 700, color: ACCENT_HONEY, textShadow: GLOW_TEXT_SHADOW, lineHeight: 1.25, display: 'flex' }, children: 'Shared via' } },
        { type: 'div', props: { style: { fontSize: fontSize * 0.5, fontWeight: 700, color: ACCENT_HONEY, textShadow: GLOW_TEXT_SHADOW, lineHeight: 1.25, display: 'flex' }, children: 'LoPo' } },
      ],
    },
  };
}

/** grid/sidebarパターン専用のブランド文字1行(Inter/太さ800/#fff3c3で統一、縮小はせず
 * extraStyleのmaxWidthで自然に折り返す)。buildBrandTextBlock(旧2パターン用)とは別物。 */
export function buildBrandLine(text: string, fontSize: number, extraStyle: Record<string, unknown> = {}) {
  return {
    type: 'div',
    props: {
      style: {
        fontSize, fontWeight: BRAND_FONT_WEIGHT, color: BRAND_TEXT_COLOR,
        fontFamily: BRAND_FONT_FAMILY, textShadow: GLOW_TEXT_SHADOW, display: 'flex',
        ...extraStyle,
      },
      children: text,
    },
  };
}

export function buildPhotoTile(top: number, left: number, width: number, height: number, src: string, radius = 6) {
  return {
    type: 'div',
    props: {
      style: { position: 'absolute', top, left, width, height, borderRadius: radius, overflow: 'hidden', display: 'flex' },
      children: { type: 'img', props: { src, width, height, style: { objectFit: 'cover', width, height } } },
    },
  };
}

/** 著作権表記(全パターン共通・カード下端中央)。写真の上に乗っても読めるよう強めのシャドウで縁取る。 */
export function buildCopyrightLine() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: BORDER_MARGIN + 4, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.9)',
            fontFamily: BRAND_FONT_FAMILY, letterSpacing: 0.2,
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)',
            display: 'flex',
          },
          children: COPYRIGHT_TEXT,
        },
      },
    },
  };
}

export function buildBioLine(bio: string | null) {
  if (!bio) return null;
  return { type: 'div', props: { style: { fontSize: 18, color: TEXT_MUTED, lineHeight: 1.4, display: 'flex', maxWidth: 380 }, children: bio } };
}
