const crypto = require("crypto");
const { sha256Hex } = require("./manifest");

function signChunkData(payload, secret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("base64");
}

function verifyChunkDataSignature(payload, signature, secret) {
  const expected = signChunkData(payload, secret);
  return expected === signature;
}

class MockPeer {
  constructor({ peerId, chunkMap, signingSecret, online = true, disconnectAfter = null, corruptIndexes = [] }) {
    this.peerId = peerId;
    this.chunkMap = chunkMap;
    this.signingSecret = signingSecret;
    this.online = online;
    this.disconnectAfter = disconnectAfter;
    this.corrupt = new Set(corruptIndexes);
    this.requests = 0;
  }

  hasChunk(index) {
    return this.chunkMap.has(index);
  }

  async fetchChunk({ fileId, chunkIndex, requester }) {
    if (!this.online) {
      throw new Error(`peer ${this.peerId} offline`);
    }
    this.requests += 1;
    if (this.disconnectAfter !== null && this.requests > this.disconnectAfter) {
      this.online = false;
      throw new Error(`peer ${this.peerId} disconnected`);
    }

    const data = this.chunkMap.get(chunkIndex);
    if (!data) {
      throw new Error(`chunk ${chunkIndex} not found on ${this.peerId}`);
    }

    await new Promise((r) => setTimeout(r, 2));

    const served = Buffer.from(data);
    if (this.corrupt.has(chunkIndex) && served.length > 0) {
      served[0] ^= 0x01;
    }

    const payload = {
      type: "CHUNK_DATA",
      file_id: fileId,
      chunk_idx: chunkIndex,
      requester,
      hash: sha256Hex(served),
      data_b64: served.toString("base64"),
      from: this.peerId,
    };

    return {
      ...payload,
      signature: signChunkData(payload, this.signingSecret),
    };
  }
}

function pickRarestChunk(missing, peers) {
  let best = null;
  let bestCount = Number.MAX_SAFE_INTEGER;
  for (const idx of missing) {
    let count = 0;
    for (const p of peers) {
      if (p.hasChunk(idx) && p.online) count += 1;
    }
    if (count > 0 && count < bestCount) {
      best = idx;
      bestCount = count;
    }
  }
  return best;
}

function pickPeerForChunk(chunkIndex, peers, blockedPeerIds = new Set()) {
  for (const p of peers) {
    if (blockedPeerIds.has(p.peerId)) continue;
    if (p.online && p.hasChunk(chunkIndex)) return p;
  }
  return null;
}

async function downloadManifestFile({ manifest, peers, signerSecrets, store, requesterId = "node-local", maxParallel = 3 }) {
  const pending = new Set(Array.from({ length: manifest.nb_chunks }, (_, i) => i));
  const inflight = new Set();
  const failedSourcesByChunk = new Map();

  const tryOne = async () => {
    const missing = Array.from(pending.values());
    const chunkIndex = pickRarestChunk(missing, peers);
    if (chunkIndex === null || chunkIndex === undefined) return;

    const blocked = failedSourcesByChunk.get(chunkIndex) || new Set();
    const peer = pickPeerForChunk(chunkIndex, peers, blocked);
    if (!peer) {
      failedSourcesByChunk.set(chunkIndex, new Set());
      const fallbackPeer = pickPeerForChunk(chunkIndex, peers);
      if (!fallbackPeer) {
        throw new Error(`No peer available for chunk ${chunkIndex}`);
      }
      pending.delete(chunkIndex);
      const fallbackTask = (async () => {
        try {
          const packet = await fallbackPeer.fetchChunk({
            fileId: manifest.file_id,
            chunkIndex,
            requester: requesterId,
          });

          const payload = {
            type: packet.type,
            file_id: packet.file_id,
            chunk_idx: packet.chunk_idx,
            requester: packet.requester,
            hash: packet.hash,
            data_b64: packet.data_b64,
            from: packet.from,
          };

          const signerSecret = signerSecrets[packet.from];
          if (!signerSecret || !verifyChunkDataSignature(payload, packet.signature, signerSecret)) {
            throw new Error(`Signature invalid for chunk ${chunkIndex}`);
          }

          const data = Buffer.from(packet.data_b64, "base64");
          const expectedHash = manifest.chunks[chunkIndex].hash;
          const actualHash = sha256Hex(data);
          if (actualHash !== expectedHash) {
            throw new Error(`Hash mismatch for chunk ${chunkIndex}`);
          }

          store.putChunk(manifest.file_id, chunkIndex, data);
          failedSourcesByChunk.delete(chunkIndex);
        } catch (_) {
          if (!failedSourcesByChunk.has(chunkIndex)) failedSourcesByChunk.set(chunkIndex, new Set());
          failedSourcesByChunk.get(chunkIndex).add(fallbackPeer.peerId);
          pending.add(chunkIndex);
        } finally {
          inflight.delete(fallbackTask);
        }
      })();
      inflight.add(fallbackTask);
      return;
    }

    pending.delete(chunkIndex);

    const task = (async () => {
      try {
        const packet = await peer.fetchChunk({
          fileId: manifest.file_id,
          chunkIndex,
          requester: requesterId,
        });

        const payload = {
          type: packet.type,
          file_id: packet.file_id,
          chunk_idx: packet.chunk_idx,
          requester: packet.requester,
          hash: packet.hash,
          data_b64: packet.data_b64,
          from: packet.from,
        };

        const signerSecret = signerSecrets[packet.from];
        if (!signerSecret || !verifyChunkDataSignature(payload, packet.signature, signerSecret)) {
          throw new Error(`Signature invalid for chunk ${chunkIndex}`);
        }

        const data = Buffer.from(packet.data_b64, "base64");
        const expectedHash = manifest.chunks[chunkIndex].hash;
        const actualHash = sha256Hex(data);
        if (actualHash !== expectedHash) {
          throw new Error(`Hash mismatch for chunk ${chunkIndex}`);
        }

        store.putChunk(manifest.file_id, chunkIndex, data);
        failedSourcesByChunk.delete(chunkIndex);
      } catch (_) {
        if (!failedSourcesByChunk.has(chunkIndex)) failedSourcesByChunk.set(chunkIndex, new Set());
        failedSourcesByChunk.get(chunkIndex).add(peer.peerId);
        pending.add(chunkIndex);
      } finally {
        inflight.delete(task);
      }
    })();

    inflight.add(task);
  };

  while (pending.size > 0 || inflight.size > 0) {
    while (pending.size > 0 && inflight.size < maxParallel) {
      await tryOne();
      if (inflight.size === 0 && pending.size > 0) {
        throw new Error("Transfer stuck: no valid sources available");
      }
    }

    if (inflight.size > 0) {
      await Promise.race(Array.from(inflight));
    }
  }

  return store.buildFile(manifest.file_id, manifest.nb_chunks);
}

module.exports = {
  MockPeer,
  signChunkData,
  verifyChunkDataSignature,
  downloadManifestFile,
};
