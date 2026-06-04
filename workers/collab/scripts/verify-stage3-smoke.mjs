// 段取り③ 本番スモークテスト。
// 実在の軽減表は絶対に触らない方針のため、存在しない plan ID の部屋で
// 「③Worker 稼働 / onLoad がクラッシュしない / 破壊保存ガードで phantom 保存しない」を確認する。
// 実行: COLLAB_SECRET=<secret> node scripts/verify-stage3-smoke.mjs
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";

const HOST = "lopo-collab.masaya-maeno0106.workers.dev";
const ROOM = "probe-stage3-" + Date.now(); // 妥当だが存在しない plan ID(予約パターン __..__ は避ける)
const SECRET = process.env.COLLAB_SECRET ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dump = (doc) => doc.getArray("timelineMitigations").toArray().map((m) => Object.fromEntries(m.entries()));

const doc = new Y.Doc();
const p = new YProvider(HOST, ROOM, doc, { party: "room", connect: true });
let synced = false;
p.on("sync", (s) => { if (s) synced = true; });

await sleep(9000);
console.log(`[1] ③Worker でYjsのDO sync成立 = ${synced || p.synced} (event=${synced}/prop=${p.synced})`);
console.log(`[2] onLoad(nonexistent plan→空seed・クラッシュ無し) = ${dump(doc).length === 0 ? "OK(空)" : "NG(非空)"}`);

// 編集して保存をトリガ(debounce 5s 超で onSave、切断で onClose flush)
doc.transact(() => {
  const m = new Y.Map();
  m.set("id", "smoke1"); m.set("mitigationId", "rampart"); m.set("time", 30); m.set("duration", 20); m.set("ownerId", "MT");
  doc.getArray("timelineMitigations").push([m]);
});
console.log("[*] 軽減1件add → 7s待機(onSave debounce)");
await sleep(7000);
p.destroy(); // onClose flush
await sleep(2500);

// 破壊保存ガード検証: 存在しない plan は保存されていないはず(decideSave not-found / #saveEnabled=false)
const res = await fetch(`https://lopoly.app/api/collab/load?planId=${ROOM}`, { headers: { "x-collab-secret": SECRET } });
const body = await res.json();
console.log(`[3] 破壊保存ガード(nonexistent planは保存されない) = ${body.deleted === true ? "OK(プラン未作成のまま)" : "NG(" + JSON.stringify(body) + ")"}`);
console.log("DONE");
process.exit(0);
