import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 共通の見た目の見張り(全プロジェクト共通の雛形: ~/.claude/skills/project-hygiene)。
 * 同じ見た目(浮かぶパネルの面・ボタンの形など)は共通の部品だけが書く。部品ごとに書くと、新しい画面の
 * たびに似た物が1つ増え、少しずつずれていく。Claude は今のコードを読んでまねるので、放っておくと増え続ける。
 *   - rules: 見張る書き方。{ id, pattern(正規表現), files(対象のファイルの正規表現), sharedHome(書いてよい所の正規表現), why }
 *   - frozen: 見張りを入れた時点でその書き方をしていたファイル。rule ごとに「ファイル → 今の数」。増やせない・減らすだけ。
 *     共通の部品に乗せ替えて減ったら数も下げる(戻せないように)。0 になったら外す。
 * 設定 = このファイルの隣の shared-look.json。新しい部品はここに足さず、共通の部品を使う。
 * 根拠: code.claude.com/docs/en/best-practices(例外の無い決まりは仕組みに置く・あちこちにある古いやり方を新しいコードにまねさせない)。
 */

type Rule = { id: string; pattern: string; files: string; sharedHome: string; why: string }
type Config = { rules: Rule[]; frozen: Record<string, Record<string, number>> }

const HERE = dirname(fileURLToPath(import.meta.url))
const CONFIG = JSON.parse(readFileSync(join(HERE, 'shared-look.json'), 'utf8')) as Config

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

/** rule ごとに「ファイル → その書き方の数」(書いてよい所は数えない)。 */
function count(rule: Rule): Map<string, number> {
  const files = new RegExp(rule.files)
  const home = new RegExp(rule.sharedHome)
  const pattern = new RegExp(rule.pattern, 'g')
  const out = new Map<string, number>()
  for (const f of FILES) {
    if (!files.test(f) || home.test(f)) continue
    const n = (readFileSync(join(ROOT, f), 'utf8').match(pattern) ?? []).length
    if (n > 0) out.set(f, n)
  }
  return out
}

describe('shared look guard', () => {
  for (const rule of CONFIG.rules) {
    const now = count(rule)
    const frozen = CONFIG.frozen[rule.id] ?? {}

    it(`${rule.id}: no new copies (${rule.why})`, () => {
      const problems: string[] = []
      for (const [file, n] of now) {
        const limit = frozen[file]
        if (limit === undefined) problems.push(`${file}: ${rule.id} ${n}x. Use the shared part (${rule.sharedHome}) instead of writing it again`)
        else if (n > limit) problems.push(`${file}: ${rule.id} ${n}x > frozen ${limit}. It may only go down (move it onto the shared part)`)
      }
      expect(problems).toEqual([])
    })

    it(`${rule.id}: frozen counts follow the file down`, () => {
      const problems: string[] = []
      for (const [file, limit] of Object.entries(frozen)) {
        const n = now.get(file) ?? 0
        if (n === 0) problems.push(`${file}: no longer has ${rule.id} — remove it from frozen`)
        else if (n < limit) problems.push(`${file}: now ${n} — lower its frozen count for ${rule.id} from ${limit} to ${n}`)
      }
      expect(problems).toEqual([])
    })
  }
})
