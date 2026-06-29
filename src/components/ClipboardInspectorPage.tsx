// src/components/ClipboardInspectorPage.tsx
// 【診断用・一時ページ】スマホ実機でスプレッドシートをコピーしたときの
// 生のクリップボード形式 (text/plain / text/html / その他 types) を採取するための
// 使い捨てインスペクタ。スプシ取込のスマホ本格対応のため、実フォーマットを
// 確定させる目的で作成。フォーマット確定後はルートごと削除してよい。
//
// 本体のパーサ・トンマナには一切依存しない自己完結ページ。
import { useEffect, useRef, useState } from 'react';

/** タブ・改行・先頭末尾空白を目に見える記号に置換した可視化文字列。 */
function visualize(s: string): string {
  return s
    .replace(/\t/g, '→\t')
    .replace(/\r\n/g, '↵\n')
    .replace(/\r/g, '↵\n')
    .replace(/\n/g, '↵\n');
}

interface Captured {
  source: string; // 'paste' | 'clipboard.read'
  types: string[];
  plain: string;
  html: string;
}

export default function ClipboardInspectorPage() {
  const [cap, setCap] = useState<Captured | null>(null);
  const [note, setNote] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // スマホで「普通のアプリ」のように縦スクロール + 明るい背景にする
  // (本体 body は overflow:hidden / 暗い背景のため)。アンマウントで戻す。
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      bodyOverflow: body.style.overflow,
    };
    html.style.background = '#f2f2f7';
    body.style.background = '#f2f2f7';
    body.style.overflow = 'auto';
    return () => {
      html.style.background = prev.htmlBg;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
    };
  }, []);

  // textarea への貼り付けを捕捉して、plain / html / 全 types を読む。
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const dt = e.clipboardData;
    if (!dt) return;
    const types = Array.from(dt.types || []);
    const plain = dt.getData('text/plain');
    const html = dt.getData('text/html');
    setCap({ source: 'paste (textarea)', types, plain, html });
    setNote('貼り付けを捕捉しました。下に結果が出ます。');
    // 既定の貼り付け(textarea へ plain 挿入)はそのまま許可してよいので preventDefault しない。
  };

  // 非同期 Clipboard API でも試す (一部ブラウザは複数フォーマットを返す)。
  const readViaApi = async () => {
    setNote('クリップボードAPIで読み取り中…');
    try {
      // navigator.clipboard.read() があれば複数フォーマットを取得
      const anyNav = navigator as unknown as {
        clipboard?: {
          read?: () => Promise<Array<{ types: string[]; getType: (t: string) => Promise<Blob> }>>;
          readText?: () => Promise<string>;
        };
      };
      if (anyNav.clipboard?.read) {
        const items = await anyNav.clipboard.read();
        const allTypes: string[] = [];
        let plain = '';
        let html = '';
        for (const item of items) {
          for (const ty of item.types) {
            allTypes.push(ty);
            if (ty === 'text/plain') plain = await (await item.getType(ty)).text();
            if (ty === 'text/html') html = await (await item.getType(ty)).text();
          }
        }
        setCap({ source: 'navigator.clipboard.read()', types: allTypes, plain, html });
        setNote('クリップボードAPIで読み取りました。');
        return;
      }
      if (anyNav.clipboard?.readText) {
        const plain = await anyNav.clipboard.readText();
        setCap({ source: 'navigator.clipboard.readText()', types: ['text/plain'], plain, html: '' });
        setNote('readText のみ取得 (HTML 非対応ブラウザ)。');
        return;
      }
      setNote('このブラウザはクリップボードAPIに対応していません。上のボックスに貼り付けてください。');
    } catch (err) {
      setNote('読み取り失敗: ' + String(err) + ' / 上のボックスに手動で貼り付けてください。');
    }
  };

  // 採取結果をテキスト化 (私=Claude に貼り返してもらう用)。
  const resultText = cap
    ? [
        '=== CLIPBOARD INSPECTOR RESULT ===',
        'source: ' + cap.source,
        'types: ' + JSON.stringify(cap.types),
        '--- text/plain (length=' + cap.plain.length + ') ---',
        cap.plain,
        '--- text/html (length=' + cap.html.length + ') ---',
        cap.html,
        '=== END ===',
      ].join('\n')
    : '';

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setNote('結果をコピーしました。チャットに貼り付けてください。');
    } catch {
      setNote('コピー失敗。下のテキストを長押しで全選択してコピーしてください。');
    }
  };

  const box: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #d1d1d6',
    borderRadius: 12,
    padding: 12,
    margin: '10px 0',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    color: '#1c1c1e',
  };
  const label: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 13,
    color: '#3c3c43',
    margin: '14px 0 4px',
  };
  const btn: React.CSSProperties = {
    appearance: 'none',
    border: 'none',
    background: '#007aff',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    padding: '12px 16px',
    borderRadius: 12,
    width: '100%',
    margin: '6px 0',
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#f2f2f7',
        color: '#1c1c1e',
        padding: '16px',
        boxSizing: 'border-box',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
        maxWidth: 680,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 6px' }}>
        クリップボード採取（診断用）
      </h1>
      <p style={{ fontSize: 14, color: '#3c3c43', lineHeight: 1.6, margin: '0 0 10px' }}>
        スプレッドシートアプリでセル範囲をコピーしてから、下のボックスを長押し →「ペースト」してください。
        貼り付けた瞬間の生フォーマットを表示します。
      </p>

      <textarea
        ref={taRef}
        onPaste={onPaste}
        placeholder="ここを長押し →「ペースト」"
        rows={3}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 16,
          padding: 12,
          borderRadius: 12,
          border: '1px solid #d1d1d6',
          background: '#fff',
          color: '#1c1c1e',
        }}
      />

      <button type="button" style={btn} onClick={readViaApi}>
        クリップボードAPIでも読み取る（任意）
      </button>

      {note && (
        <p style={{ fontSize: 13, color: '#007aff', margin: '6px 0' }}>{note}</p>
      )}

      {cap && (
        <>
          <div style={label}>source</div>
          <div style={box}>{cap.source}</div>

          <div style={label}>クリップボードに入っていた形式 (types)</div>
          <div style={box}>{cap.types.length ? cap.types.join('\n') : '(なし)'}</div>

          <div style={label}>text/plain（→=タブ ↵=改行）</div>
          <div style={box}>
            {cap.plain ? visualize(cap.plain) : '(空)'}
          </div>

          <div style={label}>text/html（生HTML）</div>
          <div style={box}>{cap.html || '(空)'}</div>

          <button type="button" style={btn} onClick={copyResult}>
            この結果をまとめてコピー
          </button>
          <div style={label}>コピー内容（手動コピー用）</div>
          <textarea
            readOnly
            value={resultText}
            rows={10}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontSize: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              padding: 10,
              borderRadius: 12,
              border: '1px solid #d1d1d6',
              background: '#fff',
              color: '#1c1c1e',
            }}
          />
        </>
      )}
    </div>
  );
}
