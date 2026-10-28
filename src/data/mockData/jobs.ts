import type { Job } from '../../types/index.js';

export const JOBS: Job[] = [
    // Tanks
    { id: 'pld', name: { ja: 'ナイト', en: 'Paladin', zh: '骑士', ko: '나이트' }, role: 'tank', icon: '/icons/Paladin.png' },
    { id: 'war', name: { ja: '戦士', en: 'Warrior', zh: '战士', ko: '전사' }, role: 'tank', icon: '/icons/Warrior.png' },
    { id: 'drk', name: { ja: '暗黒騎士', en: 'Dark Knight', zh: '暗黑骑士', ko: '암흑기사' }, role: 'tank', icon: '/icons/DarkKnight.png' },
    { id: 'gnb', name: { ja: 'ガンブレイカー', en: 'Gunbreaker', zh: '绝枪战士', ko: '건브레이커' }, role: 'tank', icon: '/icons/Gunbreaker.png' },
    // Healers
    { id: 'whm', name: { ja: '白魔道士', en: 'White Mage', zh: '白魔法师', ko: '백마도사' }, role: 'healer', icon: '/icons/WhiteMage.png' },
    { id: 'sch', name: { ja: '学者', en: 'Scholar', zh: '学者', ko: '학자' }, role: 'healer', icon: '/icons/Scholar.png' },
    { id: 'ast', name: { ja: '占星術師', en: 'Astrologian', zh: '占星术士', ko: '점성술사' }, role: 'healer', icon: '/icons/Astrologian.png' },
    { id: 'sge', name: { ja: '賢者', en: 'Sage', zh: '贤者', ko: '현자' }, role: 'healer', icon: '/icons/Sage.png' },
    // Melee DPS
    { id: 'mnk', name: { ja: 'モンク', en: 'Monk', zh: '武僧', ko: '몽크' }, role: 'dps', icon: '/icons/Monk.png' },
    { id: 'drg', name: { ja: '竜騎士', en: 'Dragoon', zh: '龙骑士', ko: '용기사' }, role: 'dps', icon: '/icons/Dragoon.png' },
    { id: 'nin', name: { ja: '忍者', en: 'Ninja', zh: '忍者', ko: '닌자' }, role: 'dps', icon: '/icons/Ninja.png' },
    { id: 'sam', name: { ja: '侍', en: 'Samurai', zh: '武士', ko: '사무라이' }, role: 'dps', icon: '/icons/Samurai.png' },
    { id: 'rpr', name: { ja: 'リーパー', en: 'Reaper', zh: '钐镰客', ko: '리퍼' }, role: 'dps', icon: '/icons/Reaper.png' },
    { id: 'vpr', name: { ja: 'ヴァイパー', en: 'Viper', zh: '蝰蛇剑士', ko: '바이퍼' }, role: 'dps', icon: '/icons/Viper.png' },
    // Physical Ranged DPS
    { id: 'brd', name: { ja: '吟遊詩人', en: 'Bard', zh: '吟游诗人', ko: '음유시인' }, role: 'dps', icon: '/icons/Bard.png' },
    { id: 'mch', name: { ja: '機工士', en: 'Machinist', zh: '机工士', ko: '기공사' }, role: 'dps', icon: '/icons/Machinist.png' },
    { id: 'dnc', name: { ja: '踊り子', en: 'Dancer', zh: '舞者', ko: '무도가' }, role: 'dps', icon: '/icons/Dancer.png' },
    // Magical Ranged DPS
    { id: 'blm', name: { ja: '黒魔道士', en: 'Black Mage', zh: '黑魔法师', ko: '흑마도사' }, role: 'dps', icon: '/icons/BlackMage.png' },
    { id: 'smn', name: { ja: '召喚士', en: 'Summoner', zh: '召唤师', ko: '소환사' }, role: 'dps', icon: '/icons/Summoner.png' },
    { id: 'rdm', name: { ja: '赤魔道士', en: 'Red Mage', zh: '赤魔法师', ko: '적마도사' }, role: 'dps', icon: '/icons/RedMage.png' },
    { id: 'pct', name: { ja: 'ピクトマンサー', en: 'Pictomancer', zh: '绘灵法师', ko: '픽토맨서' }, role: 'dps', icon: '/icons/Pictomancer.png' },
];
