import { getPhaseName, type LocalizedString } from '../types';

/**
 * イベント名を表示用文字列に整形する。
 * altName があり、現言語(en→ja フォールバック後)が空でなければ「name {orConnector} altName」を返す。
 * altName が無い/空のときは name のみ。連結語(or)はハードコードせず呼び出し側が i18n 解決して渡す。
 */
export function formatEventName(
  ev: { name: LocalizedString; altName?: LocalizedString },
  lang: string | undefined,
  orConnector: string,
): string {
  const main = getPhaseName(ev.name, lang);
  if (!ev.altName) return main;
  const alt = getPhaseName(ev.altName, lang);
  if (!alt) return main;
  return `${main} ${orConnector} ${alt}`;
}
