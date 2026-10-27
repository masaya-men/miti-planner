export type SupportedLang = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';

export function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang === 'zh-Hant' || lang.toLowerCase().startsWith('zh-hant')) return 'zh-Hant';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}
