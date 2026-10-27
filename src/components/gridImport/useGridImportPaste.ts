import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getMitigationsFromStore } from '../../hooks/useSkillsData';
import type { Job } from '../../types';
import { buildPlanFromSheets } from '../../lib/sheetImport/buildPlanFromSheets';
import type { ParsedSheet, ImportSheet } from '../../lib/sheetImport/types';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
import { gridRowsFromResult } from '../../lib/sheetImport/gridRowsFromResult';
import { parseGridPaste, isMatrixSheetFormat } from '../../lib/sheetImport/parseGridPaste';
import { parseMitigationSheet } from '../../lib/sheetImport/parseMitigationSheet';
import { emptyAssignment, type PartyAssignment } from '../../lib/sheetImport/partyAssignment';
import type { CarryTarget } from '../../lib/sheetImport/carryOverTargets';
import { type ImportSource, type WizardStep, type Lang4, emptyHeaderTable, setColumnValues, autoAssignSingleSlots, sortResultPartyBySlots } from './gridImportModel';
import type { TFunction } from 'i18next';

export function useGridImportPaste(args: {
  t: TFunction;
  isOpen: boolean;
  step: WizardStep;
  setStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  jobs: Job[];
  mitigations: ReturnType<typeof getMitigationsFromStore>;
  gridLang: Lang4;
  setTargetOverrides: React.Dispatch<React.SetStateAction<Record<string, CarryTarget | 'none'>>>;
}) {
  const { t, isOpen, step, setStep, jobs, mitigations, gridLang, setTargetOverrides } = args;

  // ── 現在の(未追加)貼り付け ──────────────────────────────────────────────
  // グリッドテーブル状態(自作=編集可テーブル / matrix=result から導いた表示用テーブル)
  const [table, setTable] = useState<GridTable>(() => emptyHeaderTable(t));
  // 取込ソース。none=未貼付 / grid=自作編集テーブル / matrix=行列形式 result
  const [source, setSource] = useState<ImportSource>('none');
  // matrix 経路: 現在の貼り付けの parsed(フェーズ追加時に entries へ積む)
  const [matrixParsed, setMatrixParsed] = useState<ParsedSheet | null>(null);
  // 形式は読めたが内容を解釈できなかった時の汎用エラー(特定スプシ名を出さない中立文言)
  const [parseFailed, setParseFailed] = useState(false);
  // 列ごとに貼り付けモード(自作テーブルのみ有効)
  const [byColumnMode, setByColumnMode] = useState(false);
  // フェーズ名(任意)。matrix の「このフェーズを追加」で使う。
  const [phaseName, setPhaseName] = useState('');
  // スマホ貼付ボックスの内容(PC は GridView 直接貼付なので未使用)
  const [pasteBuffer, setPasteBuffer] = useState('');
  // スマホ: コピー手順の折りたたみ開閉
  const [mobileCopyHintOpen, setMobileCopyHintOpen] = useState(false);

  // ── 蓄積した複数フェーズ(matrix のみ。自作は単一 grid ブロック) ──────────
  const [entries, setEntries] = useState<ImportSheet[]>([]);
  // 全フェーズ横断のパーティ枠割当。slot は jobId 単位で全フェーズ一貫。
  const [assignment, setAssignment] = useState<PartyAssignment>(emptyAssignment());

  // グリッド貼り付けサーフェス(Ctrl+V を捕捉する focusable コンテナ)
  const pasteSurfaceRef = useRef<HTMLDivElement>(null);

  // データ初期化(open 時リセット・クリアボタンで共用)。step は触らない。
  const resetAll = useCallback(() => {
    setTable(emptyHeaderTable(t));
    setSource('none');
    setMatrixParsed(null);
    setParseFailed(false);
    setByColumnMode(false);
    setPhaseName('');
    setPasteBuffer('');
    setMobileCopyHintOpen(false);
    setEntries([]);
    setAssignment(emptyAssignment());
    setTargetOverrides({});
  }, [t]);

  // モーダルを開くたびに step1 へリセット
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 取り込み本処理: 貼り付けテキストを形式判定して現在の貼り付けに配置する。
  const ingestText = useCallback((text: string) => {
    setParseFailed(false);
    // 空 → 見出しだけの空グリッドへ戻す
    if (!text.trim()) {
      setTable(emptyHeaderTable(t));
      setSource('none');
      setMatrixParsed(null);
      return;
    }

    // TRUE/FALSE 行列形式 → 実証パーサ→実証ビルダーで読み、結果を表示用テーブルへ変換(読み取り専用)
    if (isMatrixSheetFormat(text)) {
      const parsed = parseMitigationSheet(text);
      if (!parsed) {
        // 行列形式だが内容が解釈不能 → 汎用エラー(別経路への誘導はしない)
        setParseFailed(true);
        setSource('none');
        setMatrixParsed(null);
        setTable(emptyHeaderTable(t));
        return;
      }
      // 現在の貼り付け単体のプレビュー(phaseName を仮に当てて表示)
      const result = buildPlanFromSheets(
        [{ parsed, phaseName: phaseName || '' }],
        { mitigations, jobs },
        { includeMitigations: true },
      );
      setMatrixParsed(parsed);
      setSource('matrix');
      // メンバー列は MT→ST→H1→H2→D1〜D4 順で表示(検出順の party を整列)
      setTable(gridRowsFromResult(sortResultPartyBySlots(result), { mitigations, jobs }, gridLang));
      return;
    }

    // 見出し形式(自作) → 編集可グリッド
    const grid = parseGridPaste(text, jobs);
    setTable(autoAssignSingleSlots(grid, jobs));
    setSource('grid');
    setMatrixParsed(null);
  }, [t, mitigations, jobs, gridLang, phaseName]);

  // グリッド本体への貼り付けハンドラ。clipboardData からテキストを読み、規定動作は止める。
  const handleGridPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    e.preventDefault();
    ingestText(text);
  }, [ingestText]);

  // スマホ向け: div の onPaste は iOS で貼り付け UI が出ないため、ボタン経由で
  // navigator.clipboard.readText() を呼んで取り込む(クリックが user gesture になる)。
  const [pasteError, setPasteError] = useState(false);
  const handlePasteFromClipboard = useCallback(async () => {
    setPasteError(false);
    try {
      const text = await navigator.clipboard?.readText?.();
      if (text) ingestText(text);
      else setPasteError(true);
    } catch {
      setPasteError(true);
    }
  }, [ingestText]);

  const isMobile = useIsMobile();
  // スマホ貼付: textarea の onChange で全文を受け、そのまま ingestText に渡す。
  // (iOS は readText() がブロックされ、contentEditable の onPaste も不安定なため、
  //  本物の textarea + onChange を採用。長押し「ペースト」で確実に値が入る。)
  const handleMobilePasteChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPasteBuffer(text);
    ingestText(text);
  }, [ingestText]);

  // スマホ確認サマリーの「検出イベント数」。grid=表示テーブル, matrix=現在の貼付ドラフトの events。
  // (displayedPreviewEvents は後で定義されるため、使用箇所の直前で参照する)

  // ── ①(a) フェーズ名のミラー: matrix ドラフト中に phaseName を打つと「フェーズ」列へ即時反映 ──
  // matrix の表示テーブルは ingestText(貼付時)でしか作られないため、後から phaseName を打っても
  // 「フェーズ」列(= result.phases[].name 由来)が古いまま。phaseName 変化で同じビルドを通して作り直す。
  // 依存は phaseName / matrixParsed / source のみ(table 非依存)なので自分の setTable では再発火せずループしない。
  // ビルドは ingestText の matrix 分岐と同一(sortResultPartyBySlots + gridRowsFromResult)。これにより
  // Task7 displayedPreviewEvents / Task8 黄色判定 / インライン枠と time/name.ja が一致し続ける。grid は対象外。
  useEffect(() => {
    if (source !== 'matrix' || !matrixParsed) return;
    const result = buildPlanFromSheets(
      [{ parsed: matrixParsed, phaseName: phaseName || '' }],
      { mitigations, jobs },
      { includeMitigations: true },
    );
    setTable(gridRowsFromResult(sortResultPartyBySlots(result), { mitigations, jobs }, gridLang));
  }, [phaseName, matrixParsed, source, mitigations, jobs, gridLang]);

  // step2 へ入ったら貼り付けサーフェスへフォーカスし Ctrl+V を確実に捕捉する
  useEffect(() => {
    if (step !== 2) return;
    // レイアウト確定後にフォーカス(happy-dom でも focus() は no-op で安全)
    pasteSurfaceRef.current?.focus?.();
  }, [step]);

  // 列ごと貼り付けハンドラ: 指定列に改行区切りのテキストを流し込む(自作テーブルのみ)
  const onColumnPaste = useCallback((colIndex: number, text: string) => {
    const rawLines = text.split(/\r?\n/);
    // 末尾の空行を除去
    let end = rawLines.length;
    while (end > 0 && rawLines[end - 1].trim() === '') end--;
    const values = rawLines.slice(0, end);
    setSource('grid');
    setTable((prev) => setColumnValues(prev, colIndex, values));
  }, []);

  // 未追加の matrix 貼り付けを entries へ積み、現在の貼り付けをクリアする(次のタブを貼れるように)。
  const commitPendingDraft = useCallback(() => {
    if (source !== 'matrix' || !matrixParsed) return;
    setEntries((prev) => [...prev, { parsed: matrixParsed, phaseName }]);
    setTable(emptyHeaderTable(t));
    setSource('none');
    setMatrixParsed(null);
    setPhaseName('');
    setPasteBuffer('');
  }, [source, matrixParsed, phaseName, t]);

  // ステップ2 → 3(パーティ割当)。未追加ドラフトがあれば取り込んでから遷移。
  const goToParty = useCallback(() => {
    commitPendingDraft();
    setStep(3);
  }, [commitPendingDraft]);

  return { table, setTable, source, matrixParsed, parseFailed, byColumnMode, setByColumnMode, phaseName, setPhaseName, pasteBuffer, mobileCopyHintOpen, setMobileCopyHintOpen, entries, assignment, setAssignment, pasteSurfaceRef, resetAll, handleGridPaste, pasteError, handlePasteFromClipboard, isMobile, handleMobilePasteChange, onColumnPaste, commitPendingDraft, goToParty };
}
