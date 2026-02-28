const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildHello,
  handleHelloAndBuildReply,
  finalizeInitiator,
  verifyFinished,
} = require("../src/archipel/handshake");
const { buildSecurePacket, readSecurePacket } = require("../src/archipel/secure_message");
const {
  loadTrustStore,
  saveTrustStore,
  setPeerTrust,
  revokePeer,
  isPeerTrusted,
} = require("../src/archipel/trust_store");

function testHandshake() {
  const a = buildHello({ nodeId: "node-a" });
  const b = handleHelloAndBuildReply({ myNodeId: "node-b", helloMessage: a.message });
  const aFinal = finalizeInitiator({
    myNodeId: "node-a",
    helloState: a.state,
    myHello: a.message,
    reply: b.reply,
  });

  const bOk = verifyFinished({ sessionKey: b.sessionKey, finished: aFinal.finished });
  assert.strictEqual(bOk, true, "FINISHED should verify");
  assert.deepStrictEqual(Buffer.from(aFinal.sessionKey), Buffer.from(b.sessionKey), "session keys should match");
}

function testEncryptDecryptAndAntiReplay() {
  const a = buildHello({ nodeId: "node-a" });
  const b = handleHelloAndBuildReply({ myNodeId: "node-b", helloMessage: a.message });
  const aFinal = finalizeInitiator({
    myNodeId: "node-a",
    helloState: a.state,
    myHello: a.message,
    reply: b.reply,
  });

  const seen = new Set();
  const packet = buildSecurePacket({
    sessionKey: aFinal.sessionKey,
    from: "node-a",
    to: "node-b",
    payload: { text: "hello sprint2" },
  });

  const msg = readSecurePacket({ sessionKey: b.sessionKey, packet, seenNonces: seen });
  assert.strictEqual(msg.payload.text, "hello sprint2");

  let replayError = null;
  try {
    readSecurePacket({ sessionKey: b.sessionKey, packet, seenNonces: seen });
  } catch (err) {
    replayError = err;
  }
  assert.ok(replayError, "replayed packet must fail");
}

function testInvalidSignatureRejected() {
  const a = buildHello({ nodeId: "node-a" });
  const b = handleHelloAndBuildReply({ myNodeId: "node-b", helloMessage: a.message });
  const aFinal = finalizeInitiator({
    myNodeId: "node-a",
    helloState: a.state,
    myHello: a.message,
    reply: b.reply,
  });

  const packet = buildSecurePacket({
    sessionKey: aFinal.sessionKey,
    from: "node-a",
    to: "node-b",
    payload: { n: 1 },
  });

  const ct = Buffer.from(packet.ct, "base64");
  ct[0] ^= 0x01;
  packet.ct = ct.toString("base64");

  let err = null;
  try {
    readSecurePacket({ sessionKey: b.sessionKey, packet, seenNonces: new Set() });
  } catch (e) {
    err = e;
  }
  assert.ok(err, "tampered signature must be rejected");
}

function testTrustRevocation() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "archipel-trust-"));
  const storePath = path.join(tmp, "trust_store.json");

  const store = loadTrustStore(storePath);
  setPeerTrust(store, { nodeId: "node-b", publicKeyB64: "pubkey-b64", status: "trusted" });
  assert.strictEqual(isPeerTrusted(store, "node-b"), true);

  revokePeer(store, "node-b");
  assert.strictEqual(isPeerTrusted(store, "node-b"), false);

  saveTrustStore(storePath, store);
  const reloaded = loadTrustStore(storePath);
  assert.strictEqual(reloaded.peers["node-b"].status, "revoked");
}

function run() {
  testHandshake();
  testEncryptDecryptAndAntiReplay();
  testInvalidSignatureRejected();
  testTrustRevocation();
  console.log("[OK] Sprint 2 tests passed");
}

run();
