const fs = require("fs");

function defaultStore() {
  return {
    version: 1,
    peers: {},
  };
}

function loadTrustStore(path) {
  if (!fs.existsSync(path)) {
    return defaultStore();
  }
  const parsed = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!parsed.peers || typeof parsed.peers !== "object") {
    throw new Error("Invalid trust store format");
  }
  return parsed;
}

function saveTrustStore(path, store) {
  fs.writeFileSync(path, JSON.stringify(store, null, 2), "utf8");
}

function setPeerTrust(store, { nodeId, publicKeyB64, status = "trusted" }) {
  const now = Math.floor(Date.now() / 1000);
  store.peers[nodeId] = {
    node_id: nodeId,
    public_key: publicKeyB64,
    status,
    updated_at: now,
  };
}

function revokePeer(store, nodeId) {
  if (!store.peers[nodeId]) return;
  store.peers[nodeId].status = "revoked";
  store.peers[nodeId].updated_at = Math.floor(Date.now() / 1000);
}

function isPeerTrusted(store, nodeId) {
  const entry = store.peers[nodeId];
  return Boolean(entry && entry.status === "trusted");
}

module.exports = {
  loadTrustStore,
  saveTrustStore,
  setPeerTrust,
  revokePeer,
  isPeerTrusted,
};
