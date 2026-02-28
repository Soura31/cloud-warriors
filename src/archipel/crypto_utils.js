const crypto = require("crypto");

const AES_GCM_IV_BYTES = 12;

function createEphemeralEcdh(curve = "prime256v1") {
  const ecdh = crypto.createECDH(curve);
  ecdh.generateKeys();
  return {
    curve,
    publicKeyB64: ecdh.getPublicKey().toString("base64"),
    privateEcdh: ecdh,
  };
}

function deriveSessionKey({ privateEcdh, peerPublicKeyB64, salt = "archipel-h24-sprint2", info = "archipel-session-v1" }) {
  const peerPublicKey = Buffer.from(peerPublicKeyB64, "base64");
  const sharedSecret = privateEcdh.computeSecret(peerPublicKey);
  return crypto.hkdfSync("sha256", sharedSecret, Buffer.from(salt, "utf8"), Buffer.from(info, "utf8"), 32);
}

function signHmacSha256(sessionKey, payloadObject) {
  const data = Buffer.from(JSON.stringify(payloadObject), "utf8");
  return crypto.createHmac("sha256", sessionKey).update(data).digest("base64");
}

function verifyHmacSha256(sessionKey, payloadObject, expectedSigB64) {
  const actual = signHmacSha256(sessionKey, payloadObject);
  return crypto.timingSafeEqual(Buffer.from(actual, "base64"), Buffer.from(expectedSigB64, "base64"));
}

function encryptAes256Gcm(sessionKey, plaintextObject) {
  const iv = crypto.randomBytes(AES_GCM_IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey, iv);
  const plaintext = Buffer.from(JSON.stringify(plaintextObject), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    ct: ciphertext.toString("base64"),
    tag: authTag.toString("base64"),
  };
}

function decryptAes256Gcm(sessionKey, packet) {
  const iv = Buffer.from(packet.iv, "base64");
  const ciphertext = Buffer.from(packet.ct, "base64");
  const authTag = Buffer.from(packet.tag, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

module.exports = {
  createEphemeralEcdh,
  deriveSessionKey,
  signHmacSha256,
  verifyHmacSha256,
  encryptAes256Gcm,
  decryptAes256Gcm,
};
