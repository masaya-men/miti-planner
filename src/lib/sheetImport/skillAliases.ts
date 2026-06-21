/** スプシのジョブ表記 → LoPo jobId */
export const JOB_JA_TO_ID: Record<string, string> = {
  'ナイト': 'pld', '戦士': 'war', '暗黒騎士': 'drk', 'ガンブレイカー': 'gnb',
  '白魔道士': 'whm', '占星術師': 'ast', '学者': 'sch', '賢者': 'sge',
  'モンク': 'mnk', '竜騎士': 'drg', '忍者': 'nin', '侍': 'sam', 'リーパー': 'rpr', 'ヴァイパー': 'vpr',
  '吟遊詩人': 'brd', '機工士': 'mch', '踊り子': 'dnc',
  '黒魔道士': 'blm', '召喚士': 'smn', '赤魔道士': 'rdm', 'ピクトマンサー': 'pct',
};

/** スプシのスキル表記 → LoPo の name.ja（表記ゆれ吸収・spec §6-3） */
export const SKILL_ALIASES: Record<string, string> = {
  'インプロビゼーションフィニッシュ': 'インプロビゼーション',
  'コンジャクション・ヘリオス': 'コンジャンクション・ヘリオス',
  '意気軒昂の策': '意気軒高の策',
  '深謀遠慮の策': '深謀遠慮',
};
