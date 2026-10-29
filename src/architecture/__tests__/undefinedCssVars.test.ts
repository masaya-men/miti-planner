import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 「定義の無い CSS 変数を使わない」見張り。
 * var(--x) と第 2 引数(代わりの値)なしで書いたのに、どこにも --x の定義が無いと、その指定は黙って効かない。
 *   使用 = src/**\/*.css の var(--x)(第 2 引数なし。var(--x, …) は対象外。入れ子の中も同じ規則)
 *   定義 = CSS の `--x:` / ts・tsx(テスト除く)の文字列リテラルに出る '--x' / @theme が作る変数 / index.html・public の CSS
 *   許可 = undefined-css-vars.json(JS が実行時に書く変数など。理由つき)。使われなくなった・定義済みになった名前は消させる。
 * 既存の違反は、定義すると今効いていない指定が効き始めて見た目が変わるので、直さず許可一覧に載せてある。
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const ALLOW = JSON.parse(readFileSync(join(HERE, '..', 'undefined-css-vars.json'), 'utf8')) as Record<string, string>

function findRoot(dir: string): string {
  let d = dir
  while (!existsSync(join(d, 'package.json'))) {
    const up = dirname(d)
    if (up === d) throw new Error('package.json not found above ' + dir)
    d = up
  }
  return d
}
const ROOT = findRoot(HERE)

const FILES = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\0')
  .filter((f) => f !== '' && existsSync(join(ROOT, f)))

const isTest = (f: string) => /(^|\/)__tests__\//.test(f) || /\.test\.tsx?$/.test(f)
const srcCss = FILES.filter((f) => /^src\/.*\.css$/.test(f))
const srcTs = FILES.filter((f) => /^src\/.*\.tsx?$/.test(f) && !isTest(f))
// public/ の CSS と index.html(起動時スクリプト・style)も定義の置き場
const otherDefs = FILES.filter((f) => /^public\/.*\.(css|html|js)$/.test(f) || f === 'index.html')

const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')
/** コメントを同じ長さの空白に置き換える(行番号を保つ)。 */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

// Tailwind v4 が内部で作る --tw-* は接頭辞ごと許可(ユーティリティが実行時に @property で定義する)。
const TW_PREFIX = '--tw-'

const defined = new Set<string>()
/** 文字列リテラル内で `--foo-${i}` のように後半が動的な名前の接頭辞。 */
const dynamicPrefixes: string[] = []
for (const f of [...srcCss, ...otherDefs]) {
  for (const m of stripComments(read(f)).matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) defined.add(m[1])
}
for (const f of srcTs) {
  for (const m of read(f).matchAll(/['"`](--[A-Za-z0-9_-]+)(\$\{)?/g)) {
    if (m[2]) dynamicPrefixes.push(m[1])
    else defined.add(m[1])
  }
}
// otherDefs(html/js)の文字列リテラルも
for (const f of otherDefs) for (const m of read(f).matchAll(/['"`](--[A-Za-z0-9_-]+)/g)) defined.add(m[1])

const isDefined = (n: string) =>
  defined.has(n) || n.startsWith(TW_PREFIX) || dynamicPrefixes.some((p) => n.startsWith(p))

/** 第 2 引数なしの var(--x) を全部拾う: 名前 → 場所の一覧。 */
const used = new Map<string, string[]>()
for (const f of srcCss) {
  const text = stripComments(read(f))
  for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g)) {
    if (m[2] === ',') continue
    const line = text.slice(0, m.index).split('\n').length
    const list = used.get(m[1]) ?? []
    list.push(`${f}:${line}`)
    used.set(m[1], list)
  }
}

describe('undefined css vars guard', () => {
  it('定義の無い変数を第 2 引数なしで使っていない', () => {
    const bad = [...used].filter(([n]) => !isDefined(n) && !(n in ALLOW))
    const msg = bad.map(([n, locs]) => `  ${n}  ← ${locs.slice(0, 5).join(', ')}`).join('\n')
    expect(
      bad.length,
      `定義の無い CSS 変数を使っています。tokens に定義するか、JS が書く変数なら src/architecture/undefined-css-vars.json に理由つきで載せてください。\n${msg}`,
    ).toBe(0)
  })

  it('許可一覧に載っているのに使われていない/定義済みになった名前が無い', () => {
    const stale = Object.keys(ALLOW).filter((n) => !used.has(n) || isDefined(n))
    expect(
      stale,
      `undefined-css-vars.json から消してください(もう使われていない、または定義済みになった名前):\n  ${stale.join('\n  ')}`,
    ).toEqual([])
  })
})
