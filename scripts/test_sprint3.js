const assert = require("assert");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { buildManifest, verifyManifest, chunkBuffer, sha256Hex } = require("../src/archipel/manifest");
const { ChunkStore } = require("../src/archipel/chunk_store");
const { MockPeer, downloadManifestFile } = require("../src/archipel/chunk_transfer");

function buildChunkMap(chunks, indexes) {
  const map = new Map();
  for (const i of indexes) {
    map.set(i, chunks[i]);
  }
  return map;
}

async function testLargeTransferAndReplicationStyle() {
  const size50mb = 50 * 1024 * 1024;
  const file = crypto.randomBytes(size50mb);
  const manifest = buildManifest({
    senderId: "node-source",
    filename: "video.bin",
    fileBuffer: file,
    chunkSize: 1024 * 1024,
    signingSecret: "manifest-secret",
  });

  assert.strictEqual(verifyManifest(manifest, "manifest-secret"), true);

  const chunks = chunkBuffer(file, manifest.chunk_size);
  const even = [];
  const odd = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (i % 2 === 0) even.push(i);
    else odd.push(i);
  }

  const peerA = new MockPeer({
    peerId: "node-a",
    chunkMap: buildChunkMap(chunks, even),
    signingSecret: "sec-a",
  });

  const peerB = new MockPeer({
    peerId: "node-b",
    chunkMap: buildChunkMap(chunks, odd),
    signingSecret: "sec-b",
  });

  const store = new ChunkStore({ rootDir: path.join(os.tmpdir(), "archipel-sprint3-index") });
  const out = await downloadManifestFile({
    manifest,
    peers: [peerA, peerB],
    signerSecrets: { "node-a": "sec-a", "node-b": "sec-b" },
    store,
    requesterId: "node-r",
    maxParallel: 6,
  });

  assert.strictEqual(sha256Hex(out), sha256Hex(file));
  store.saveIndex(manifest.file_id, manifest);
}

async function testNodeDisconnectButTransferContinues() {
  const file = crypto.randomBytes(8 * 1024 * 1024);
  const manifest = buildManifest({ senderId: "node-source", filename: "doc.bin", fileBuffer: file, chunkSize: 512 * 1024 });
  const chunks = chunkBuffer(file, manifest.chunk_size);

  const allIdx = Array.from({ length: chunks.length }, (_, i) => i);

  const fragile = new MockPeer({
    peerId: "node-fragile",
    chunkMap: buildChunkMap(chunks, allIdx),
    signingSecret: "fragile-secret",
    disconnectAfter: 3,
  });

  const stable = new MockPeer({
    peerId: "node-stable",
    chunkMap: buildChunkMap(chunks, allIdx),
    signingSecret: "stable-secret",
  });

  const store = new ChunkStore();
  const out = await downloadManifestFile({
    manifest,
    peers: [fragile, stable],
    signerSecrets: { "node-fragile": "fragile-secret", "node-stable": "stable-secret" },
    store,
    requesterId: "node-r",
    maxParallel: 4,
  });

  assert.strictEqual(sha256Hex(out), sha256Hex(file));
}

async function testCorruptedChunkRejectedAndRecovered() {
  const file = crypto.randomBytes(4 * 1024 * 1024);
  const manifest = buildManifest({ senderId: "node-source", filename: "img.bin", fileBuffer: file, chunkSize: 256 * 1024 });
  const chunks = chunkBuffer(file, manifest.chunk_size);
  const idx = Array.from({ length: chunks.length }, (_, i) => i);

  const bad = new MockPeer({
    peerId: "node-bad",
    chunkMap: buildChunkMap(chunks, idx),
    signingSecret: "bad-secret",
    corruptIndexes: [2, 3],
  });

  const good = new MockPeer({
    peerId: "node-good",
    chunkMap: buildChunkMap(chunks, idx),
    signingSecret: "good-secret",
  });

  const store = new ChunkStore();
  const out = await downloadManifestFile({
    manifest,
    peers: [bad, good],
    signerSecrets: { "node-bad": "bad-secret", "node-good": "good-secret" },
    store,
    requesterId: "node-r",
    maxParallel: 4,
  });

  assert.strictEqual(sha256Hex(out), sha256Hex(file));
}

async function run() {
  await testLargeTransferAndReplicationStyle();
  await testNodeDisconnectButTransferContinues();
  await testCorruptedChunkRejectedAndRecovered();
  console.log("[OK] Sprint 3 tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
