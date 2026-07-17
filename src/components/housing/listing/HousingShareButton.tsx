/**
 * Phase 3: 物件詳細のシェアボタン
 *
 * - スマホ/対応ブラウザ: Web Share API (`navigator.share`) を直接呼ぶ
 * - 非対応環境: リンクコピー / X (Twitter intent) を含むドロップダウンを開く
 * - スタイルは housing.css の token 経由
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TwitterXIcon, type TwitterXIconHandle } from './TwitterXIcon';
import { canonicalPostUrl } from '../../../lib/housing/canonicalPostUrl';

export interface HousingShareButtonProps {
  url: string;
  title: string;
  /**
   * FB第6弾#4#5: 投稿元 SNS ポストの URL (imageMode==='sns' のときのみ値あり)。
   * X へ流す URL はこれがあれば優先する (他人の投稿の手柄を取らない趣旨)。
   * リンクコピー / navigator.share は従来どおり LoPo ページ URL (`url`) を使う。
   */
  sourceUrl?: string | null;
  /**
   * follow-up改良2(ユーザーFB): X intent の本文テキスト。
   * 未指定 (undefined) なら従来どおり `title` を使う (ハウジンガーページは無変更)。
   * `null` を渡すと intent URL に `text=` パラメータ自体を付けない (物件詳細向け:
   * タイトルやコメント等の本文を一切含めない要望)。
   */
  tweetText?: string | null;
}

export const HousingShareButton: React.FC<HousingShareButtonProps> = ({ url, title, sourceUrl, tweetText }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const xIconRef = useRef<TwitterXIconHandle>(null);
  // X (Twitter) へ渡す URL: 投稿元があればそちらを優先、なければ LoPo ページ URL。
  const xTargetUrl = sourceUrl ?? url;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const onTriggerClick = async () => {
    // Web Share API がある環境ではネイティブシートを優先
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const shareFn = nav && (nav as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> }).share;
    if (typeof shareFn === 'function') {
      try {
        await shareFn.call(nav, { title, url });
        return;
      } catch {
        // ユーザーキャンセル等 — ドロップダウン表示にフォールバックしない (UX 上ノイズになる)
        return;
      }
    }
    setOpen((v) => !v);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable - silently no-op
    }
  };

  const tweet = () => {
    // FB第6弾follow-up改良3: X 投稿元 URL は長大な追跡クエリを剥がしてから intent へ渡す。
    const canonicalUrl = canonicalPostUrl(xTargetUrl);
    // follow-up改良2: tweetText が未指定なら title を使う (従来どおり)。
    // null を明示的に渡された場合は text= パラメータ自体を省略する (空文字で付けない)。
    const textForTweet = tweetText === undefined ? title : tweetText;
    const textParam = textForTweet !== null ? `text=${encodeURIComponent(textForTweet)}&` : '';
    const tweetUrl = `https://twitter.com/intent/tweet?${textParam}url=${encodeURIComponent(canonicalUrl)}&hashtags=LoPo`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <div className="housing-share" ref={ref}>
      <button
        type="button"
        className="housing-action-btn"
        onClick={onTriggerClick}
        aria-label={t('housing.detail.share')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('housing.detail.share')}
      </button>
      {/* FB第6弾#4: 常時見えるXシェアボタン。ドロップダウンを開かず直接 intent へ飛ぶ。
          follow-up改良1: アイコンのみボタンにアニメ付き X アイコンを採用。
          follow-up改良1追加(ユーザーFB): アニメの発火はボタン全体の hover/focus に合わせる
          (SVG 16px 自身の hover ではなくボタン領域全体で反応させたい要望)。 */}
      <button
        type="button"
        className="housing-action-btn is-icon"
        onClick={tweet}
        onMouseEnter={() => xIconRef.current?.startAnimation()}
        onMouseLeave={() => xIconRef.current?.stopAnimation()}
        onFocus={() => xIconRef.current?.startAnimation()}
        onBlur={() => xIconRef.current?.stopAnimation()}
        aria-label={t('housing.detail.share_x')}
        title={t('housing.detail.share_x')}
      >
        <TwitterXIcon ref={xIconRef} size={16} />
      </button>
      {open && (
        <div role="menu" className="housing-share-menu">
          <button type="button" role="menuitem" onClick={copyLink}>
            {copied ? t('housing.detail.share_copied') : t('housing.detail.share_copy_link')}
          </button>
          <button type="button" role="menuitem" onClick={tweet}>
            {t('housing.detail.share_twitter')}
          </button>
        </div>
      )}
    </div>
  );
};
