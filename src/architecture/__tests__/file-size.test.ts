import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * ファイルの大きさの見張り(全プロジェクト共通の雛形: ~/.claude/skills/project-hygiene)。
 * 1ファイルが大きくなるほど1つに色々な仕事が混ざり、直すたびに別の所が壊れやすい。
 * 対象 = リポジトリの中の文字のファイル全部(コード・CSS・テスト・JSON ほか・フォルダも拡張子も問わない)。
 * 自動で外すのは 文字でないファイル(画像・動画・フォント等)・lock ファイル・md(md は SessionStart の md の見張りが担当)だけ。
 *   - 新しいファイル: maxLines 行まで。
 *   - frozen: 見張りを入れた(広げた)時点で超えていたファイル。今の行数が上限で、増やせない。
 *     減ったら上限の数字も同じだけ下げる(戻せないように)。maxLines 以下になったら一覧から外す。
 *   - exceptions: どうしても大きくなるファイル。{ maxLines, reason } で理由を必ず書く。
 *   - ignore: 対象外にするパス。{ pattern(正規表現), reason } で理由を必ず書く(翻訳データ・自動生成など)。
 * 設定 = このファイルの隣の file-size-limits.json。
 * 根拠: code.claude.com/docs/en/best-practices(例外の無い決まりは指示書ではなく仕組みに置く)。
 */

type Exception = { maxLines: number; reason: string }
type Ignore = { pattern: string; reason: string }
type Limits = {
  maxLines: number
  ignore: Ignore[]
  frozen: Record<string, number>
  exceptions: Record<string, Exception>
}

const HERE = dirname(fileURLToPath(import.meta.url))
const CONFIG = JSON.parse(readFileSync(join(HERE, 'file-size-limits.json'), 'utf8')) as Limits
const IGNORE = CONFIG.ignore.map((i) => new RegExp(i.pattern))

// 文字でないファイル・lock ファイル・md は数えない(md は md の見張りが担当)。
const NOT_TEXT = /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|mp4|webm|mov|mp3|wav|ogg|m4a|flac|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|7z|wasm|psd|ai|fig|xlsx?|docx?|pptx?)$/i
const LOCKFILES = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock)$/
const MARKDOWN = /\.(md|mdx)$/i

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

// git が知っているファイル(追跡中+まだ add していない新しいファイル。.gitignore の物は除く)。
function listFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return out
    .split('\0')
    .filter((f) => f !== '' && !NOT_TEXT.test(f) && !LOCKFILES.test(f) && !MARKDOWN.test(f) && !IGNORE.some((r) => r.test(f)))
    .filter((f) => existsSync(join(ROOT, f)))
}

/** 行数。NUL を含む(=文字でない)ファイルは null。 */
function countLines(rel: string): number | null {
  const buf = readFileSync(join(ROOT, rel))
  if (buf.subarray(0, 8000).includes(0)) return null
  const src = buf.toString('utf8')
  if (src === '') return 0
  const lines = src.split('\n').length
  return src.endsWith('\n') ? lines - 1 : lines
}

const SIZES = new Map<string, number>()
for (const f of listFiles()) {
  const n = countLines(f)
  if (n !== null) SIZES.set(f, n)
}

describe('file size guard', () => {
  it('no file grows past its limit', () => {
    const problems: string[] = []
    for (const [file, lines] of SIZES) {
      const exception = CONFIG.exceptions[file]
      const frozen = CONFIG.frozen[file]
      if (exception) {
        if (lines > exception.maxLines) problems.push(`${file}: ${lines} lines > exception limit ${exception.maxLines}`)
      } else if (frozen !== undefined) {
        if (lines > frozen) {
          problems.push(`${file}: ${lines} lines > frozen limit ${frozen}. It may only shrink — split it instead of growing it`)
        }
      } else if (lines > CONFIG.maxLines) {
        problems.push(`${file}: ${lines} lines > ${CONFIG.maxLines}. Split it into files that each do one job (or add an exception with a reason)`)
      }
    }
    expect(problems).toEqual([])
  })

  it('frozen limits follow the file down (a shrink is locked in)', () => {
    const problems: string[] = []
    for (const [file, limit] of Object.entries(CONFIG.frozen)) {
      const lines = SIZES.get(file)
      if (lines === undefined) problems.push(`${file}: no longer exists (or is ignored) — remove it from frozen`)
      else if (lines <= CONFIG.maxLines) problems.push(`${file}: now ${lines} lines (<= ${CONFIG.maxLines}) — remove it from frozen`)
      else if (lines < limit) problems.push(`${file}: now ${lines} lines — lower its frozen limit from ${limit} to ${lines}`)
    }
    expect(problems).toEqual([])
  })

  it('every exception and ignore says why and is still needed', () => {
    const problems: string[] = []
    for (const [file, ex] of Object.entries(CONFIG.exceptions)) {
      const lines = SIZES.get(file)
      if (ex.reason.trim() === '') problems.push(`${file}: exception has no reason`)
      if (lines === undefined) problems.push(`${file}: no longer exists — remove the exception`)
      else if (lines <= CONFIG.maxLines) problems.push(`${file}: now ${lines} lines — the exception is no longer needed`)
      if (file in CONFIG.frozen) problems.push(`${file}: listed in both frozen and exceptions`)
    }
    for (const ig of CONFIG.ignore) if (ig.reason.trim() === '') problems.push(`ignore ${ig.pattern}: no reason`)
    expect(problems).toEqual([])
  })
})
