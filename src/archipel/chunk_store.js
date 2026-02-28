const fs = require("fs");
const path = require("path");

class ChunkStore {
  constructor({ rootDir = null } = {}) {
    this.rootDir = rootDir;
    this.files = new Map();
  }

  _fileMap(fileId) {
    if (!this.files.has(fileId)) {
      this.files.set(fileId, new Map());
    }
    return this.files.get(fileId);
  }

  putChunk(fileId, index, dataBuffer) {
    this._fileMap(fileId).set(index, Buffer.from(dataBuffer));
  }

  hasChunk(fileId, index) {
    return this.files.has(fileId) && this.files.get(fileId).has(index);
  }

  getChunk(fileId, index) {
    return this.files.get(fileId)?.get(index) || null;
  }

  missingIndexes(fileId, totalChunks) {
    const missing = [];
    for (let i = 0; i < totalChunks; i += 1) {
      if (!this.hasChunk(fileId, i)) missing.push(i);
    }
    return missing;
  }

  buildFile(fileId, totalChunks) {
    const parts = [];
    for (let i = 0; i < totalChunks; i += 1) {
      const part = this.getChunk(fileId, i);
      if (!part) {
        throw new Error(`Missing chunk ${i}`);
      }
      parts.push(part);
    }
    return Buffer.concat(parts);
  }

  saveIndex(fileId, manifest) {
    if (!this.rootDir) return;
    fs.mkdirSync(this.rootDir, { recursive: true });
    const indexPath = path.join(this.rootDir, `${fileId}.json`);
    const present = Array.from(this._fileMap(fileId).keys()).sort((a, b) => a - b);
    fs.writeFileSync(indexPath, JSON.stringify({ file_id: fileId, manifest, present }, null, 2), "utf8");
  }
}

module.exports = { ChunkStore };
