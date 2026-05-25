import type { LocalizedText } from '../types/systemNotification';

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh';

/**
 * 多言語テキストから指定 lang の文字列を取り出す。 順序: lang → en → ja。
 * en が空文字列 ('') の場合は ja にフォールバック。
 */
export function resolveLocalized(text: LocalizedText, lang: SupportedLang): string {
  const candidate = text[lang];
  if (candidate) return candidate;
  if (text.en) return text.en;
  return text.ja;
}
