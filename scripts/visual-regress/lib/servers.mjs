// @ts-check
/**
 * base 側の worktree と dev サーバーの管理。
 * base worktree は必ず .claude/worktrees の外(os.tmpdir())に置く(Vite が親フォルダの設定を拾わないように)。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';

const PREFIX = 'lopo-vr-base-';

/** Windows 形式のパスへ(cmd の mklink/rmdir 用) */
const win = (p) => p.split('/').join(String.fromCharCode(92));

/** @param {string[]} args @param {string} cwd */
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * @param {string} rev コミットのハッシュ(短くても長くても可)
 * @param {string} tmpRoot
 * @returns {{ dir: string, name: string }}
 */
export function planBaseWorktree(rev, tmpRoot) {
  const name = `${PREFIX}${rev.slice(0, 7)}`;
  return { dir: path.join(tmpRoot, name).replace(/\\/g, '/'), name };
}

/**
 * 前回の残骸(lopo-vr-base- で始まるフォルダ)
 * @param {string} tmpRoot
 * @returns {string[]}
 */
export function staleBaseDirs(tmpRoot) {
  if (!fs.existsSync(tmpRoot)) return [];
  return fs.readdirSync(tmpRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(PREFIX))
    .map((d) => path.join(tmpRoot, d.name));
}

/** rev 時点と作業ツリーで package.json が違うか(違うと node_modules を共有できない) */
export function packageJsonDiffers(repoRoot, rev) {
  const atRev = git(['show', `${rev}:package.json`], repoRoot);
  const now = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8').trim();
  return atRev.replace(/\r\n/g, '\n') !== now.replace(/\r\n/g, '\n');
}

function repoRootOf(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd);
}

/**
 * @param {string} rev
 * @param {string} [repoRoot] 作業ツリー(.env.local と node_modules の取得元)
 * @returns {string} 作った worktree のフォルダ
 */
export function createBaseWorktree(rev, repoRoot = repoRootOf()) {
  const full = git(['rev-parse', '--verify', `${rev}^{commit}`], repoRoot);
  const { dir } = planBaseWorktree(full, os.tmpdir());
  git(['worktree', 'add', '--detach', dir, full], repoRoot);
  try {
    const env = path.join(repoRoot, '.env.local');
    if (fs.existsSync(env)) fs.copyFileSync(env, path.join(dir, '.env.local'));
    const nm = path.join(repoRoot, 'node_modules');
    execFileSync('cmd', ['/c', 'mklink', '/J', win(path.join(dir, 'node_modules')), win(nm)], { stdio: 'ignore' });
  } catch (e) {
    removeBaseWorktree(dir, repoRoot);
    throw e;
  }
  return dir;
}

/** junction を先に外し(中身を消さないため)、worktree を外してフォルダも消す */
export function removeBaseWorktree(dir, repoRoot = repoRootOf()) {
  const nm = path.join(dir, 'node_modules');
  try {
    if (fs.existsSync(nm) && fs.lstatSync(nm).isSymbolicLink()) {
      execFileSync('cmd', ['/c', 'rmdir', win(nm)], { stdio: 'ignore' });
    }
  } catch { /* 続行 */ }
  try { git(['worktree', 'remove', '--force', dir], repoRoot); } catch { /* 登録が無くても続行 */ }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 続行 */ }
  try { git(['worktree', 'prune'], repoRoot); } catch { /* 続行 */ }
}

/** プロセスツリーごと止める(vite の子が残らないように) */
function killTree(pid) {
  try { execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 既に終了 */ }
}

/**
 * @param {string} dir
 * @param {number} port
 * @returns {Promise<{ url: string, stop: () => void }>}
 */
export async function startDevServer(dir, port) {
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: dir, shell: true, stdio: 'ignore', windowsHide: true });
  let exited = false;
  child.on('exit', () => { exited = true; });
  const stop = () => { if (child.pid) killTree(child.pid); };
  const url = `http://localhost:${port}/`;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (exited) { stop(); throw new Error(`dev サーバー(${dir}, :${port})が起動中に終了しました`); }
    try {
      const res = await fetch(url);
      if (res.status === 200) return { url, stop };
    } catch { /* まだ */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  throw new Error(`dev サーバー(${dir}, :${port})が 90 秒以内に起動しませんでした`);
}
