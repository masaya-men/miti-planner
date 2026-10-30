import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 画像は「どこから来たか(Referer)」を送らずに読む、の見張り。
 * 2026-10-30 から X の画像サーバー(pbs.twimg.com)は Referer 付きの読み込みを 351 で断る
 * (ブラウザは ERR_BLOCKED_BY_ORB で止め、画像が壊れる)。Referer を送らなければ今まで通り返る。
 * ハウジングは X の画像をそのまま表示するので、次を全部守る:
 *   - JSX の <img> には referrerPolicy="no-referrer" を付ける。
 *   - new Image() の直後に img.referrerPolicy = 'no-referrer' を付ける。
 *   - <video poster> は Referer を止められないので、固定の自前画像("/..." の文字列)以外を渡さない。
 *     外の画像を表紙にしたい時は <img referrerPolicy="no-referrer"> を後ろに重ねる。
 * ページ全体の設定(meta referrer・Referrer-Policy ヘッダー)にはしない(YouTube 埋め込みが Error 153 で止まる)。
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : listFiles(p)
    return /\.(tsx|ts)$/.test(name) ? [p] : []
  })
}

const files = listFiles(SRC).map((p) => ({ path: relative(SRC, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }))

/** `<img` から対応する `>` までを取り出す(属性の中の {...} は深さで飛ばす)。 */
function jsxImgTags(text: string): string[] {
  const tags: string[] = []
  const re = /<img[\s/>]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    // コメントの中で <img> に触れているだけの所は対象外
    const before = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index)
    if (/^\s*(\/\/|\*|\/\*)/.test(before) || before.includes('//') || before.includes('{/*')) continue
    let depth = 0
    let i = m.index
    for (; i < text.length; i++) {
      const c = text[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    tags.push(text.slice(m.index, i + 1))
  }
  return tags
}

describe('画像は Referer を送らずに読む', () => {
  it('JSX の <img> には全部 referrerPolicy="no-referrer" が付いている', () => {
    const missing = files.flatMap(({ path, text }) =>
      path.endsWith('.tsx')
        ? jsxImgTags(text)
            .filter((tag) => !/referrerPolicy="no-referrer"/.test(tag))
            .map((tag) => `${path}: ${tag.slice(0, 80).replace(/\s+/g, ' ')}`)
        : [],
    )
    expect(missing).toEqual([])
  })

  it('new Image() の直後に referrerPolicy を付けている', () => {
    const missing = files.flatMap(({ path, text }) => {
      const out: string[] = []
      const re = /const (\w+) = new Image\(\)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(text))) {
        const after = text.slice(m.index, m.index + 300)
        if (!new RegExp(`${m[1]}\\.referrerPolicy = 'no-referrer'`).test(after)) out.push(`${path}: ${m[0]}`)
      }
      if (/new Image\(/.test(text.replace(/const \w+ = new Image\(\)/g, ''))) out.push(`${path}: 変数に入れない new Image()`)
      return out
    })
    expect(missing).toEqual([])
  })

  it('<video poster> には固定の自前画像の文字列しか渡さない', () => {
    const bad = files.flatMap(({ path, text }) =>
      [...text.matchAll(/(?<![\w-])poster=(\{[^}]*\}|"[^"]*")/g)]
        // wallPoster = MIL-SPEC の背景の表紙(リポジトリ内の画像を import した物)
        .filter(([, v]) => !/^"\//.test(v) && !/^\{wallPoster\}$/.test(v))
        .map(([all]) => `${path}: ${all}`),
    )
    expect(bad).toEqual([])
  })
})
