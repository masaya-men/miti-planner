import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 「部品のファイルにテーマの分かれ道を書かない」見張り(設計書 docs/superpowers/specs/2026-10-29-theme-out-of-parts-design.md)。
 *   テーマで変わる値 → テーマの値を置くファイル(下の THEME_FILES)に変数で置き、部品は var() を読むだけ。
 *   MIL-SPEC が標準の部品を描き変える規則 → src/styles/military/ に置く。
 *   TS/TSX で <html> のテーマのクラスを読まない → store(useThemeStore の isDarkTheme 等)から読む。
 */

const HERE = dirname(fileURLToPath(import.meta.url))

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

/** テーマそのもののファイル(ここだけテーマの指定を書いてよい)。 */
const THEME_FILES: { re: RegExp; why: string }[] = [
  { re: /^src\/styles\/military\//, why: 'MIL-SPEC テーマの土台と、標準の部品の描き変え' },
  { re: /^src\/components\/military\//, why: 'MIL-SPEC の時だけ出る部品(.theme-military は名札)' },
  { re: /^src\/styles\/base\/tokens-[a-z]+\.css$/, why: 'テーマごとの値(--color-* と部品ごとの値)' },
  { re: /^src\/styles\/base\/global\.css$/, why: ':root, .theme-dark, .theme-light の土台' },
  { re: /^src\/styles\/housing\/tokens-daynight\.css$/, why: 'ハウジングの昼/夜の値' },
  { re: /^src\/styles\/housing\/theme-reveal\.css$/, why: 'テーマ切替の演出そのもの(html[data-theme-anim])' },
]

const THEME_SELECTOR = /\.theme-(light|dark|military)\b|\[data-theme\b|\.milspec-app\b/

/** 規則の頭(セレクタ)だけを見る。コメントと値の中の文字は数えない。 */
function selectorsOf(css: string): string[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...noComments.matchAll(/([^{};]+)\{/g)].map((m) => m[1].trim())
}

const isTest = (f: string) => /(^|\/)__tests__\//.test(f) || /\.test\.tsx?$/.test(f)

describe('部品のファイルにテーマの分かれ道を書かない', () => {
  it('CSS: テーマの指定はテーマのファイルだけ', () => {
    const bad: string[] = []
    for (const f of FILES.filter((x) => /^src\/.*\.css$/.test(x))) {
      if (THEME_FILES.some((t) => t.re.test(f))) continue
      for (const sel of selectorsOf(readFileSync(join(ROOT, f), 'utf8'))) {
        if (THEME_SELECTOR.test(sel)) bad.push(`${f}: ${sel.replace(/\s+/g, ' ')}`)
      }
    }
    expect(bad, 'テーマで変わる値は src/styles/base/tokens-parts.css(ハウジングは housing/tokens-daynight.css)に変数で置き、部品は var() を読むだけにする。MIL-SPEC の描き変えは src/styles/military/ へ').toEqual([])
  })

  it('TS/TSX: <html> のテーマのクラスを直接読まない', () => {
    const allow = new Set(['src/store/useThemeStore.ts'])
    const bad = FILES.filter((f) => /^src\/.*\.tsx?$/.test(f) && !isTest(f) && !allow.has(f)).filter((f) =>
      /classList\.contains\(\s*['"`]theme-/.test(readFileSync(join(ROOT, f), 'utf8')),
    )
    expect(bad, '明るさは useThemeStore(isDarkTheme 等)から読む').toEqual([])
  })
})
