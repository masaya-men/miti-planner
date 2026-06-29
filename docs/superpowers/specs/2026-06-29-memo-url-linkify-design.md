# メモ内URLのリンク化（軽量版）設計書

- 日付: 2026-06-29
- ステータス: 設計確定（ユーザー承認済み）→ 実装計画(writing-plans)へ
- 関連: docs/TODO.md「次の作業順」#1 / アイデア「メモのURLをクリック/Ctrl+クリックで開けるように」

## 目的

メモ本文に書かれた URL を、**通常表示（メモモードOFF）のとき**クリックできるリンクにし、新しいタブで開けるようにする。URLとふつうの文章が混在していても、URL部分だけが正しくクリックできる。

例: `https://example.com ここで軽減を使用してね`
→ `https://example.com`（リンク・クリックで新タブ）＋ ` ここで軽減を使用してね`（ふつうの文字）

## スコープ

### やること
- メモモード**OFF（readonly 表示）**で `memo.text` 内の `http(s)://` URL をリンク化。
- クリックで **新しいタブ**を開く（`target="_blank"`）。
- URL＋文章の混在、1メモ内に複数URL、文中の URL、すべて対応。
- 危険URL防御（後述）。

### やらないこと（今回スコープ外）
- YouTube 等の**その場 iframe 再生／サムネ表示**（価値は大きいが別物の中規模機能。別ステップで設計）。
- `www.example.com` のような **scheme 無し URL**（誤爆防止のため対象外）。
- **メモモード ON（編集中）でのリンク化**（クリック＝編集モーダル/ドラッグの既存挙動を維持。ON では開けなくてよい、で合意）。
- **PiP（カンペ）画面のメモ**（まず通常タイムラインのみ。必要なら後追い）。
- 「外部サイトに移動します」の確認ワンクッション（入れない、で合意）。

## 振る舞いの詳細

### リンク化の対象判定
- `https?://` で始まる連続文字列を URL 候補として検出する。
- 候補末尾に付いた区切り記号は URL から除外する（リンクが余計な記号まで飲み込んで切れないように）。除外対象（末尾のみ・連続して剥がす）:
  `） ) 】 」 』 。 、 ， , . ! ！ ? ？ ； ; ： : ＞ >`
  - 例: `（https://example.com）` → URL は `https://example.com`、`）` は文字側。
- 念のため `new URL(candidate)` で再検証し、`protocol` が `http:` または `https:` のときだけリンクにする。例外時・それ以外の protocol（`javascript:` `data:` 等）は**ただの文字**として描画する（二重ガード）。
- `www.〜`（scheme 無し）はリンクにしない。

### 表示・操作
- リンク部分: `<a href={url} target="_blank" rel="noopener noreferrer">{url}</a>`。リンク文字＝URLそのまま（短縮して隠さない＝行き先が見える）。
- `<a>` の `onClick` は `stopPropagation`（メモ枠への伝播を止める安全策。readonly では枠側ハンドラは元々 early-return だが念のため）。
- 文字部分: そのままテキスト描画（React が自動エスケープ）。
- スマホ: 通常表示でタップ＝開く（OS が新タブ/外部ブラウザ処理）。編集中はタップ＝編集（既存）。

### スタイル
- リンク色＝機能色の「青」（DESIGN 準拠＝OK/進む系）。トークン経由（ハードコード禁止）。
- 下線等の装飾は既存トンマナに合わせて控えめに。色トークンは実装時に DESIGN.md で確認。

## 設計（分離方針）

### 1. 純関数 `parseMemoLinks(text: string)`（新規）
- 配置: `src/components/Memo/parseMemoLinks.ts`（React 非依存・単体テスト可能）。
- 返り値: セグメント配列。例:
  ```ts
  type MemoSegment =
    | { type: 'text'; value: string }
    | { type: 'url'; value: string };  // value は検証・トリム済みの安全な http(s) URL
  function parseMemoLinks(text: string): MemoSegment[];
  ```
- 責務: URL 検出 → 末尾記号トリム → `new URL` で protocol 再検証 → text/url セグメントに分解。
- 単体テスト（vitest）で網羅:
  - URL のみ / 文章のみ / URL＋文章混在 / 1メモ内に複数URL / 文中の URL。
  - 末尾記号トリム（`（https://x.com）`、`https://x.com。`）。
  - `javascript:`/`data:` を弾く（text 扱い）。
  - `www.x.com`（scheme 無し）は text 扱い。
  - 空文字・改行を含むテキスト。

### 2. 表示ヘルパー `MemoText`
- `MemoOverlay.tsx` 内のローカルコンポーネント（または同ディレクトリの小コンポーネント）。
- props: `{ text: string }`。`parseMemoLinks(text)` の結果を map し、`url` は `<a>`、`text` は素のテキストで描画。

### 3. `MemoOverlay.tsx` 改修
- **readonly（`!interactive`）の枝のみ** `memo.text` → `<MemoText text={memo.text} />` に差し替え。
- **interactive（メモモード ON）の枝は変更しない**（Tooltip + `<span>{memo.text}</span>` のまま。ドラッグ/編集/削除の既存挙動を完全維持）。

## セキュリティ（危険URL防御）

| 脅威 | 防御 |
|------|------|
| `javascript:` `data:` 等のスキームでスクリプト実行（XSS） | **http(s):// のみリンク化**（scheme 許可リスト）＋ `new URL` で protocol 再検証の二重ガード |
| タブナビング（開いた先が元タブを書き換え） | `rel="noopener noreferrer"` |
| HTML 混入 | React 自動エスケープ（`<a>{url}` / 文字はテキストノード） |
| リンク先が詐欺/マルウェア | 判定不可（どんなリンクも同じ）。URL を隠さず全表示で行き先を見せる＋自動プレビュー/自動 fetch をしない（A案）＋ブラウザ SafeBrowsing が backstop |

## テスト方針
- `parseMemoLinks` の vitest 単体テスト（上記網羅ケース）。
- `MemoOverlay` の readonly レンダーで `<a>` が出ること・interactive では従来どおり（リンク化されない）ことの確認（happy-dom）。
- 実機: 通常表示で混在メモのURLクリック→新タブ / 編集中はリンク化されず編集モーダルが開く。

## 受け入れ条件
1. 通常表示で `http(s)://` URL が青リンクになり、クリックで新タブが開く。
2. URL＋文章の混在で URL 部分だけがクリックでき、文章はそのまま。
3. 1メモ内の複数 URL がすべてクリックできる。
4. `javascript:`/`data:`/`www.`（scheme 無し）はリンクにならない。
5. メモモード ON では従来どおり（リンク化されず、クリック＝編集・ドラッグ・右クリック削除）。
6. `npm run build`（tsc strict）と vitest が緑。
