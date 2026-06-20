import { describe, it, expect } from 'vitest';
import { parseFflogsUrl } from '../parseFflogsUrl';

describe('parseFflogsUrl', () => {
  it('reports コード + ?fight=数値 を抽出する', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234?fight=5'))
      .toEqual({ reportId: 'aBcd1234', fightId: '5' });
  });
  it('#fight=数値 も抽出する', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234#fight=12'))
      .toEqual({ reportId: 'aBcd1234', fightId: '12' });
  });
  it('fight 指定なしは fightId=null', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234'))
      .toEqual({ reportId: 'aBcd1234', fightId: null });
  });
  it('fight=last など非数値も現ユーザー側どおり許容する', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234?fight=last'))
      .toEqual({ reportId: 'aBcd1234', fightId: 'last' });
  });
  it('クエリが続く場合 fightId のみ抽出（& で打ち切り）', () => {
    expect(parseFflogsUrl('https://www.fflogs.com/reports/aBcd1234?fight=3&type=damage'))
      .toEqual({ reportId: 'aBcd1234', fightId: '3' });
  });
  it('reports セグメントが無ければ null', () => {
    expect(parseFflogsUrl('https://example.com/foo')).toBeNull();
  });
  it('空文字は null', () => {
    expect(parseFflogsUrl('')).toBeNull();
  });
});
