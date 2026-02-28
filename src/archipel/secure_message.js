const crypto = require("crypto");
const {
  encryptAes256Gcm,
  decryptAes256Gcm,
  signHmacSha256,
  verifyHmacSha256,
} = require("./crypto_utils");

function buildSecurePacket({ sessionKey, from, to, type = "MSG", payload }) {
  const envelope = {
    from,
    to,
    type,
    ts: Math.floor(Date.now() / 1000),
    nonce: crypto.randomBytes(16).toString("hex"),
    payload,
  };

  const enc = encryptAes256Gcm(sessionKey, envelope);
  const signTarget = {
    from,
    to,
    type,
    ts: envelope.ts,
    nonce: envelope.nonce,
    iv: enc.iv,
    ct: enc.ct,
    tag: enc.tag,
  };

  return {
    ...enc,
    from,
    to,
    type,
    ts: envelope.ts,
    nonce: envelope.nonce,
    sig: signHmacSha256(sessionKey, signTarget),
  };
}

function readSecurePacket({ sessionKey, packet, seenNonces, maxSkewSeconds = 90 }) {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - packet.ts) > maxSkewSeconds) {
    throw new Error("Packet timestamp outside allowed skew");
  }

  if (seenNonces.has(packet.nonce)) {
    throw new Error("Replay detected");
  }

  const signTarget = {
    from: packet.from,
    to: packet.to,
    type: packet.type,
    ts: packet.ts,
    nonce: packet.nonce,
    iv: packet.iv,
    ct: packet.ct,
    tag: packet.tag,
  };

  if (!verifyHmacSha256(sessionKey, signTarget, packet.sig)) {
    throw new Error("Invalid packet signature");
  }

  const decrypted = decryptAes256Gcm(sessionKey, packet);
  seenNonces.add(packet.nonce);
  return decrypted;
}

module.exports = {
  buildSecurePacket,
  readSecurePacket,
};
