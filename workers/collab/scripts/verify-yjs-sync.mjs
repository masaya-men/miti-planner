// 本番 YServer (lopo-collab) に YProvider を2つ繋ぎ、Yjs 同期が成立することを実証。
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";

const HOST = "lopo-collab.masaya-maeno0106.workers.dev";
const ROOM = "verify-" + process.pid;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dump = (doc) =>
  doc.getArray("timelineMitigations").toArray().map((m) => Object.fromEntries(m.entries()));

function client(label, doc) {
  const p = new YProvider(HOST, ROOM, doc, { party: "room", connect: true });
  p.on("sync", (s) => console.log(`[${label}] synced=${s}`));
  return p;
}

const docA = new Y.Doc(), docB = new Y.Doc();
const pA = client("A", docA), pB = client("B", docB);
await sleep(3000);
console.log(`A.synced=${pA.synced} B.synced=${pB.synced}`); // 期待: true/true

docA.transact(() => {
  const m = new Y.Map();
  m.set("id", "v1"); m.set("mitigationId", "rampart_pld");
  m.set("time", 30); m.set("duration", 20); m.set("ownerId", "MT");
  docA.getArray("timelineMitigations").push([m]);
});
await sleep(2000);
console.log(`[1] B 受信 = ${dump(docB).length === 1}`, JSON.stringify(dump(docB)));

const docC = new Y.Doc(); const pC = client("C", docC);
await sleep(3000);
console.log(`[2] C late-join 受信 = ${dump(docC).length === 1}`, JSON.stringify(dump(docC)));

docA.transact(() => { const m=new Y.Map(); m.set("id","vA2"); m.set("mitigationId","tetragrammaton"); m.set("time",60); m.set("duration",1); m.set("ownerId","H1"); docA.getArray("timelineMitigations").push([m]); });
docB.transact(() => { const m=new Y.Map(); m.set("id","vB2"); m.set("mitigationId","sacred_soil"); m.set("time",62); m.set("duration",15); m.set("ownerId","H2"); docB.getArray("timelineMitigations").push([m]); });
await sleep(2500);
console.log(`[3] 同時add両方残る = ${dump(docA).length === 3 && dump(docB).length === 3}`, dump(docA).map(m=>m.id), dump(docB).map(m=>m.id));

pA.destroy(); pB.destroy(); pC.destroy();
await sleep(500); process.exit(0);
