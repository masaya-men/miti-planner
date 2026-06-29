# スマホ grid のパーティ枠割当 + 小画面スクロール 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** スマホ(iPhone)で grid 形式スプシを取り込む際、(A) 各メンバー列(プレイヤー)に枠(MT/ST/H1/H2/D1〜D4)を割り当てる縦リストを出して「作成」できるようにし、(B) 小画面でフッターの注意書き/ボタンが切れずスクロールで全て見えるようにする。

**Architecture:** すべて `SpreadsheetGridImportModal.tsx` の `isMobile` 分岐の中だけで実装。PC の GridView(列ヘッダ枠割当)・フッター文言は一切変更しない。割当データモデル(member 列の `slot`)・`partyComplete`・取込ロジックは既存共通を流用。

**Tech Stack:** React + TS, react-i18next, Tailwind(既存トークン), Vitest + @testing-library/react(happy-dom)。

## Global Constraints
- **PC は一切変更しない。変更はすべて `isMobile===true` の分岐内のみ。**(ユーザー厳命・[[feedback_scope_discipline]])
- 会話/コメントは日本語。UIテキストは i18n キー経由・4言語(ja/en/ko/zh) parity・該当ブロックのみ textual 編集([[feedback_locale_json_textual_edit]])。
- 色は白黒+機能色のみ・既存 `app-*` クラス。
- TS strict(`tsc -b`)+ `erasableSyntaxOnly`。
- push 前 `npm run build` + `npx vitest run`(直接実行・パイプ禁止)。新規 failure ゼロ(既知5件=TopBar4+HousingWorkspace1 除外)。

---

### Task 1: スマホ grid のパーティ枠割当リスト + 小画面スクロール(フッター移設)

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`
- Modify: `src/locales/{ja,en,ko,zh}.json`(`gridImport.mobile_grid_needs_pc` を撤去、`gridImport.mobile_assign_party` を追加)
- Test: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`

**Interfaces (既存・流用):**
- `SLOTS_BY_ROLE: Record<SlotRole, PartySlot[]>`(モジュール定数・tank→[MT,ST]/healer→[H1,H2]/dps→[D1,D2,D3,D4])。ファイル内で既に使用(列ヘッダの枠 select)。
- `roleOf(jobId: string): SlotRole | undefined`(既存 useCallback)。
- `table.columns[ci]`: `{ field, header, jobId, slot }`(member 列)。
- `isMobile`, `source`, `jobs`, `gridLang`, `blockMsg`, `preview`, `skipped`, `canConfirm`(既存)。

- [ ] **Step 1: i18n キーを差し替え(4言語・textual 編集)**

各ロケールの `gridImport` ブロックで、`mobile_grid_needs_pc` の行を**削除**し、`mobile_assign_party` を追加:
- ja: `"mobile_assign_party": "パーティの枠を割り当て"`
- en: `"mobile_assign_party": "Assign party slots"`
- ko: `"mobile_assign_party": "파티 슬롯 배정"`
- zh: `"mobile_assign_party": "分配小队位置"`

確認: `git grep -n "mobile_grid_needs_pc" src/` → 後で実装からも消すのでこの時点では test/コードに残る。最終的に src 全体でゼロにする。

- [ ] **Step 2: 失敗するテストを書く(JA マップ更新 + grid 割当テスト)**

`SpreadsheetGridImportModal.test.tsx` の JA マップ: `'gridImport.mobile_grid_needs_pc'` 行を削除し、`'gridImport.mobile_assign_party': 'パーティの枠を割り当て',` を追加。`'gridImport.slot_empty'` は既存(`'未割当'`)を流用。

既存の grid モバイルテスト(`mobile_grid_needs_pc` を期待していたもの)を、割当リストを検証する内容に置換:
```ts
it('スマホ grid: メンバー列ごとに枠割当リストを出し、割当で作成可能になる', () => {
  render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
  goToGridStep();
  // 2 タンク列(同ジョブ)= 自動割当されず未割当
  fireEvent.change(screen.getByLabelText('スプレッドシートを貼り付け'), {
    target: { value: '時間\tナイト\tナイト\n0:16\tランパート\tランパート\n' },
  });
  // 割当リストの見出しが出る
  expect(screen.getByText('パーティの枠を割り当て')).toBeInTheDocument();
  // 枠 select が 2 つ(メンバー列 2)
  const selects = screen.getAllByLabelText('枠は？');
  expect(selects.length).toBe(2);
  // 作成ボタンは未割当で無効
  const createBtn = screen.getByText('この内容で作成').closest('button')!;
  expect(createBtn).toBeDisabled();
  // 2 列に MT/ST を割り当て
  fireEvent.change(selects[0], { target: { value: 'MT' } });
  fireEvent.change(selects[1], { target: { value: 'ST' } });
  // 作成可能に
  expect(createBtn).not.toBeDisabled();
});
```
(注: `'gridImport.assign_slot'`=`'枠は？'` は JA マップに既存。`'gridImport.create'`=`'この内容で作成'` も既存。`ナイト` は `detectField` で tank の member 列になる前提=既存 grid テストと同様。もし `getAllByLabelText('枠は？')` が PC 列ヘッダの select と衝突する場合は、モバイル割当 select の `aria-label` を新キー `gridImport.mobile_slot_for`(「{{job}} の枠」)にして区別する — その場合キーを4言語追加し、テストも合わせる。実装者判断で衝突を回避すること。)

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 新テスト FAIL(割当リスト未実装)。

- [ ] **Step 4: 列スロット更新ハンドラ + memberColumns を追加**

`SpreadsheetGridImportModal.tsx` のフック部(`roleOf` 定義より後ろ)に追加:
```ts
// スマホ用: member 列の枠(slot)を更新(PC の GridView 内 setColSlot と同等・PC は不変)
const setMobileColumnSlot = useCallback((ci: number, slot: PartySlot | null) => {
  setTable((prev) => ({
    ...prev,
    columns: prev.columns.map((c, i) => (i === ci ? { ...c, slot } : c)),
  }));
}, []);

// スマホ grid 割当リスト対象: jobId 付き member 列(プレイヤー)
const mobileMemberColumns = useMemo(
  () =>
    source !== 'grid'
      ? []
      : table.columns
          .map((col, ci) => ({ col, ci, role: col.jobId ? roleOf(col.jobId) : undefined }))
          .filter((x) => x.col.field === 'member' && !!x.col.jobId),
  [source, table.columns, roleOf],
);
```

- [ ] **Step 5: モバイル本体に割当リストを実装(`mobile_grid_needs_pc` バナーを置換)**

[L661-700 付近](../../../src/components/SpreadsheetGridImportModal.tsx#L661) のモバイル分岐(`isMobile ? (...)`)内、確認サマリーの下にある `{source === 'grid' && hasUnassignedMemberCols && (...PC案内バナー...)}` ブロックを**削除**し、代わりに割当リストを追加:
```tsx
{source === 'grid' && mobileMemberColumns.length > 0 && (
  <div className="flex flex-col gap-2">
    <p className="text-app-2xl font-bold text-app-text">{t('gridImport.mobile_assign_party')}</p>
    {mobileMemberColumns.map(({ col, ci, role }) => {
      const job = jobs.find((j) => j.id === col.jobId);
      const jobLabel = job ? (job.name[gridLang as keyof typeof job.name] ?? job.name.ja) : (col.jobId ?? col.header);
      return (
        <div key={ci} className="flex items-center gap-3">
          <span className="flex-1 truncate text-app-2xl text-app-text">{jobLabel}</span>
          <select
            value={col.slot ?? ''}
            aria-label={t('gridImport.assign_slot')}
            onChange={(e) => setMobileColumnSlot(ci, (e.target.value as PartySlot) || null)}
            className="appearance-none bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:outline-none"
          >
            <option value="">{t('gridImport.slot_empty')}</option>
            {role && SLOTS_BY_ROLE[role].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      );
    })}
  </div>
)}
```
(`hasUnassignedMemberCols` の useMemo 自体は他で使うため残してよいが、PC案内バナーの参照箇所は削除。`mobile_grid_needs_pc` キーは未使用になるので i18n からも撤去済=Step1。)

- [ ] **Step 6: 小画面スクロール — フッターの冗長ステータスをスマホ本体へ移設(PC 不変)**

[L816-843 付近](../../../src/components/SpreadsheetGridImportModal.tsx#L816) のフッター「作成ブロック」(`else` 分岐)で、サマリー/警告/skipped のテキストを **`!isMobile` のときだけ**表示し、ボタンは常時表示にする:
```tsx
<div className="flex items-center gap-3 flex-wrap justify-end">
  {!isMobile && (blockMsg ? (
    <span className={clsx('flex items-center gap-1.5 text-app-2xl', blockMsg.tone === 'red' ? 'text-app-red' : 'text-app-amber')}>
      <AlertCircle size={14} className="shrink-0" /> {blockMsg.text}
    </span>
  ) : (
    <span className="text-app-2xl text-app-text-muted">
      {preview && t('gridImport.summary', { labels: preview.labels.length, events: preview.timelineEvents.length, mits: preview.timelineMitigations.length })}
    </span>
  ))}
  {!isMobile && skipped.length > 0 && (
    <span className="text-app-2xl text-app-amber">{t('gridImport.skipped_count', { count: skipped.length })}</span>
  )}
  <button onClick={handleConfirm} disabled={!canConfirm} className={clsx('flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold', canConfirm ? 'bg-app-toggle text-app-toggle-text' : 'bg-app-surface2 text-app-text-muted cursor-not-allowed')}>
    <CheckCircle2 size={16} /> {t('gridImport.create')}
  </button>
</div>
```
[L845-付近](../../../src/components/SpreadsheetGridImportModal.tsx#L845) の `{showCreateBlock && (<div>...unresolved_note + rights_notice...</div>)}` 補足行を **`{!isMobile && showCreateBlock && (...)}`** に変更(スマホのフッターから外す)。

スマホ本体(Step5 の割当リストの直後)に、作成ブロック相当のステータスを**スクロール領域内**で表示:
```tsx
{source === 'grid' && (
  <div className="flex flex-col gap-1.5">
    {blockMsg && (
      <span className={clsx('flex items-start gap-1.5 text-app-2xl', blockMsg.tone === 'red' ? 'text-app-red' : 'text-app-amber')}>
        <AlertCircle size={14} className="shrink-0 mt-0.5" /> {blockMsg.text}
      </span>
    )}
    {skipped.length > 0 && (
      <span className="text-app-2xl text-app-amber">{t('gridImport.skipped_count', { count: skipped.length })}</span>
    )}
    <p className="text-app-sm text-app-text-muted/60">{t('gridImport.rights_notice')}</p>
  </div>
)}
```
これでスマホはフッターが「戻る/やり直す + 作成」の最小高さに収まり、注意書きはスクロール本体で全て見える。

- [ ] **Step 7: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 全 PASS(置換した grid 割当テスト含む)。

- [ ] **Step 8: ビルド + 全テスト**

Run: `npm run build`(成功)
Run: `npx vitest run`(直接・パイプ禁止。新規 failure ゼロ・既知5件のみ)
Run: `git grep -n "mobile_grid_needs_pc" src/`(ゼロを確認)

- [ ] **Step 9: コミット**

```bash
git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(import): スマホ grid のパーティ枠割当リスト + 小画面スクロール(PC不変)

- スマホ grid: 各メンバー列に枠(MT/ST/H1/H2/D1-D4)を割り当てる縦リストを追加し作成可能に
- 小画面: フッターの冗長ステータスをスクロール本体へ移し、注意書き/ボタンの切れを解消
- すべて isMobile 分岐内のみ。PC の GridView/フッターは不変

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review
- **Spec coverage**: 追加A(枠割当リスト)=Step4-5 ✓ / 追加B(小画面スクロール)=Step6 ✓ / `mobile_grid_needs_pc` 撤去=Step1,5,8 ✓ / PC不変=全 Step が `isMobile`/`!isMobile` 分岐内 ✓。
- **Placeholder**: 各 Step に実コード記載。テストの aria-label 衝突回避策も明記。
- **型/名称整合**: `setMobileColumnSlot`/`mobileMemberColumns`(Step4)= Step5 参照一致。`SLOTS_BY_ROLE`/`roleOf`/`PartySlot`/`SlotRole` は既存。i18n `mobile_assign_party`(Step1)= Step5/Step2 参照一致。`mobile_grid_needs_pc` は Step1 で削除・Step5 で参照削除。
