const crypto = require("crypto");

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function computeFileId(filename, fileBuffer) {
  return sha256Hex(Buffer.concat([Buffer.from(filename, "utf8"), fileBuffer]));
}

function chunkBuffer(fileBuffer, chunkSize) {
  const chunks = [];
  for (let i = 0; i < fileBuffer.length; i += chunkSize) {
    chunks.push(fileBuffer.subarray(i, Math.min(i + chunkSize, fileBuffer.length)));
  }
  return chunks;
}

function signManifest(manifestCore, secret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(manifestCore)).digest("base64");
}

function buildManifest({ senderId, filename, fileBuffer, chunkSize = 1024 * 1024, signingSecret = "archipel-manifest" }) {
  const chunks = chunkBuffer(fileBuffer, chunkSize);
  const fileId = computeFileId(filename, fileBuffer);
  const chunkList = chunks.map((data, index) => ({
    index,
    size: data.length,
    hash: sha256Hex(data),
  }));

  const manifestCore = {
    type: "MANIFEST",
    file_id: fileId,
    filename,
    file_size: fileBuffer.length,
    chunk_size: chunkSize,
    nb_chunks: chunkList.length,
    chunks: chunkList,
    sender_id: senderId,
    ts: Math.floor(Date.now() / 1000),
  };

  return {
    ...manifestCore,
    signature: signManifest(manifestCore, signingSecret),
  };
}

function verifyManifest(manifest, signingSecret = "archipel-manifest") {
  const manifestCore = {
    type: manifest.type,
    file_id: manifest.file_id,
    filename: manifest.filename,
    file_size: manifest.file_size,
    chunk_size: manifest.chunk_size,
    nb_chunks: manifest.nb_chunks,
    chunks: manifest.chunks,
    sender_id: manifest.sender_id,
    ts: manifest.ts,
  };
  const expected = signManifest(manifestCore, signingSecret);
  return expected === manifest.signature;
}

module.exports = {
  sha256Hex,
  chunkBuffer,
  buildManifest,
  verifyManifest,
};
