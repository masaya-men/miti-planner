/** 漏れ光の経路(見本 js:962: 区画の幅いっぱい = 操作列 + ジョブ欄の右端まで) */
export const leakTrace = (w: number) => [{ name: 'lk:tb', d: `M 0 -2 H ${w}`, pc: 'leak' }];
