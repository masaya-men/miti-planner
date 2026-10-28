// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';
import { JA, interpolate, DEFAULT_SEL, gridPasteSurface, goToGridStep, goToPartyStep, matrixTSV } from './gridImportModalTestSetup';

// templateLoader をモック: デフォルトは null(テンプレなし)。テスト内で上書き可。
vi.mock('../../data/templateLoader', () => ({
  getTemplate: vi.fn().mockResolvedValue(null),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => interpolate(JA[k] ?? k, vars),
    i18n: { language: 'ja' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: vi.fn().mockReturnValue(false) }));

// マトリクス/メンバー順テスト用にタンク+ヒーラー+DPS のジョブを用意。
// パラディン=ナイト(tank)・白魔=ヒーラー・忍者=DPS。
vi.mock('../../hooks/useSkillsData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useSkillsData')>();
  return {
    ...actual,
    getJobsFromStore: () => [
      { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' },
      { id: 'whm', name: { ja: '白魔道士', en: 'White Mage' }, role: 'healer', icon: '' },
      { id: 'nin', name: { ja: '忍者', en: 'Ninja' }, role: 'dps', icon: '' },
    ],
    getMitigationsFromStore: () => [
      { id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 20, type: 'all', value: 0 },
      { id: 'asylum_whm', jobId: 'whm', name: { ja: 'アサイラム', en: 'Asylum' }, recast: 0, duration: 24, type: 'all', value: 0 },
    ],
  };
});

describe('SpreadsheetGridImportModal', () => {
  // ── §9.7 C#8/#9/#10: 読めない技セル内黄色+自作在席編集+取り込めません明記(Task 8) ──

  it('Task8: matrix未解決技セル(かげぬい)が text-app-amber クラスを持つ(C#8)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // matrix を貼り付け → 未解決セルが amber で表示されるのはドラフト表示中
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // かげぬい が amber クラスを持つ span として描画されていること(フェーズ追加前のドラフト表示)
    const amberSpans = document.querySelectorAll('.text-app-amber');
    const texts = Array.from(amberSpans).map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('かげぬい'))).toBe(true);
  });

  it('Task8: matrix同時刻2技(両解決:ランパート/アサイラム)は amber を持たない(C#9)', () => {
    // 同一行に両方解決の技が並ぶ matrix
    const T = (cells: string[]) => cells.join('\t');
    const twoSkilledTSV = [
      T(['Phase', 'Total Time', 'Action', 'Type', 'Hit', 'Mit', 'Mit']),
      T(['', '', '', '', '', 'ナイト', '白魔道士']),
      T(['', '', 'Skill', '', '', 'ランパート', 'アサイラム']),
      T(['開幕', '0:16', 'ビッグブラスト', 'Magic', '100,000', 'TRUE', 'TRUE']),
    ].join('\n');
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => twoSkilledTSV } });
    // セル内にランパート / アサイラム が表示されるが amber は付かない
    const amberSpans = document.querySelectorAll('.text-app-amber');
    const texts = Array.from(amberSpans).map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('ランパート'))).toBe(false);
    expect(texts.some((t) => t.includes('アサイラム'))).toBe(false);
  });

  it('Task8: grid未解決 member セルが <input> を持つ(C#10 在席編集)', () => {
    // 自作 TSV: member 列に「かげぬい」(未解決)
    // parseGridPaste が "ナイト" 列ヘッダーを member 列として検出するよう列名をジョブ名に合わせる
    const gridTSV = '時間\t敵の攻撃\tナイト\n0:16\tビッグブラスト\tかげぬい\n';
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => gridTSV } });
    // member 列の未解決セルが input になっていること
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const memberInput = inputs.find((el) => el.value === 'かげぬい');
    expect(memberInput).toBeDefined();
  });

  it('Task8: grid未解決 input をblurで正式名称に直すとセル更新(白になる)', () => {
    const gridTSV = '時間\t敵の攻撃\tナイト\n0:16\tビッグブラスト\tかげぬい\n';
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => gridTSV } });
    // 未解決 input を特定
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const memberInput = inputs.find((el) => el.value === 'かげぬい');
    expect(memberInput).toBeDefined();
    // 正式名称「ランパート」に変更して blur → setTable → 再描画 → input が消えて通常テキストに
    fireEvent.change(memberInput!, { target: { value: 'ランパート' } });
    fireEvent.blur(memberInput!);
    // blur 後: input は消え、ランパートは通常テキスト(text-app-text クラス)で表示される
    const inputsAfter = (screen.queryAllByRole('textbox') as HTMLInputElement[]).filter(
      (el) => el.value === 'ランパート',
    );
    expect(inputsAfter.length).toBe(0); // input ではなく通常テキストになった
    // ランパート が amber を持たないこと(解決済み)
    const amberSpans = document.querySelectorAll('.text-app-amber');
    const texts = Array.from(amberSpans).map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('ランパート'))).toBe(false);
    // Fix I1: 解決名「ランパート」が実際に描画されていることを肯定的に検証
    expect(screen.getByText('ランパート')).toBeInTheDocument();
  });

  it('Task8: unresolved_note がフッターに表示される(skipped あり、step3)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // フェーズ追加→ skipped が確定
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));
    // step3 へ進む → showCreateBlock=true → unresolved_note が出る
    goToPartyStep();
    expect(screen.getByText('LoPo に無いため取り込まれません。自作シートは正式名称に直すと取り込めます。')).toBeInTheDocument();
  });

  it('Task8: grid見出し形式でメンバー列に未解決スキルを貼ると unresolved_note がフェーズ追加なしで表示される(Fix I2)', () => {
    // grid 形式(見出し形式)で member 列に未解決スキルを含む TSV を貼る
    // grid は現在のテーブルから buildPlanFromGrid で即座にプレビューを構築→skipped が確定→unresolved_note が表示される
    const gridTSV = '時間\t敵の攻撃\tナイト\n0:16\tビッグブラスト\tかげぬい\n';
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => gridTSV } });
    // フェーズ追加(このフェーズを追加)を押さずに unresolved_note が表示されていることを確認
    // (grid は表示中テーブルから即座にプレビューを構築するため、フェーズ追加を待たずに skipped が確定)
    expect(screen.getByText('LoPo に無いため取り込まれません。自作シートは正式名称に直すと取り込めます。')).toBeInTheDocument();
  });

  // ── §9.7 E#14/#15/#16: ジョブ列手動救済+時間欠落表示+入口案内文(Task 9) ──

  it('Task9: 空状態(未貼り付け)に format_hint が表示される(E#16)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 未貼り付け状態 → 空状態プロンプト + format_hint が出る
    expect(screen.getByText('ジョブ・スキルは正式名称で、時間(M:SS)の列を入れてください。')).toBeInTheDocument();
  });

  it('Task9: grid で time 列が無いと no_time_warning が amber で出る(E#15)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 時間列を含まない自作TSV
    const tsvNoTime = '敵の攻撃\tナイト\nビッグブラスト\tランパート\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsvNoTime } });
    expect(screen.getByText('時間(M:SS)の列が必要です。見出しを「時間」にするか「この列は？→時間」で指定してください。')).toBeInTheDocument();
  });

  it('Task9: grid で time 列があれば no_time_warning は出ない(E#15 否定)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    const tsvWithTime = '時間\t敵の攻撃\n0:16\tビッグブラスト\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsvWithTime } });
    expect(screen.queryByText('時間(M:SS)の列が必要です。見出しを「時間」にするか「この列は？→時間」で指定してください。')).toBeNull();
  });

  it('Task9: matrix 貼付では no_time_warning が出ない(matrix は対象外)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    expect(screen.queryByText('時間(M:SS)の列が必要です。見出しを「時間」にするか「この列は？→時間」で指定してください。')).toBeNull();
  });

  it('Task9: unknown 列セレクタに「メンバー（ジョブを選ぶ）」が含まれる(E#14)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 不明列を含む自作TSV
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '不明列A\t時間\n値1\t0:10\n' } });
    const selector = screen.getByDisplayValue('この列は？') as HTMLSelectElement;
    const optionTexts = Array.from(selector.options).map((o) => o.text);
    expect(optionTexts).toContain('メンバー（ジョブを選ぶ）');
  });

  it('Task9: unknown 列で「メンバー（ジョブを選ぶ）」を選ぶとジョブ select が出る(E#14 第1段)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '不明列A\t時間\n値1\t0:10\n' } });
    const selector = screen.getByDisplayValue('この列は？') as HTMLSelectElement;
    // __member__ を選択
    fireEvent.change(selector, { target: { value: '__member__' } });
    // aria-label='メンバー（ジョブを選ぶ）' の select が出る
    const jobSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const jobSelect = jobSelects.find((s) => s.getAttribute('aria-label') === 'メンバー（ジョブを選ぶ）');
    expect(jobSelect).toBeDefined();
    // ジョブの選択肢が出る(ナイト/白魔道士/忍者)
    const jobOptions = Array.from(jobSelect!.options).map((o) => o.text);
    expect(jobOptions).toContain('ナイト');
  });

  it('Task9: ジョブ select でジョブを選ぶと列が member 化し枠セレクタが出る(E#14 第2段)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '不明列A\t時間\nランパート\t0:10\n' } });
    const selector = screen.getByDisplayValue('この列は？') as HTMLSelectElement;
    // 第1段: メンバー(ジョブを選ぶ)を選択
    fireEvent.change(selector, { target: { value: '__member__' } });
    // 第2段: ジョブ select でナイト(pld)を選択
    const jobSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const jobSelect = jobSelects.find((s) => s.getAttribute('aria-label') === 'メンバー（ジョブを選ぶ）');
    expect(jobSelect).toBeDefined();
    fireEvent.change(jobSelect!, { target: { value: 'pld' } });
    // 列が member 化 → 枠セレクタ(「枠は？」)が出る
    const slotSelects = (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
      Array.from(s.options).some((o) => o.text === '枠は？'),
    );
    expect(slotSelects.length).toBeGreaterThan(0);
    // ジョブ select(2段目)は消えている
    const jobSelectsAfter = screen.queryAllByRole('combobox') as HTMLSelectElement[];
    const pendingSelect = jobSelectsAfter.find((s) => s.getAttribute('aria-label') === 'メンバー（ジョブを選ぶ）');
    expect(pendingSelect).toBeUndefined();
  });
});
