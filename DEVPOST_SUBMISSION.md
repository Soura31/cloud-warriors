# Devpost Submission Draft - Archipel H24

## Project Title
Archipel H24 - Secure Multi-Node P2P Transfer

## One-line Pitch
A secure peer-to-peer LAN network that discovers nodes automatically and transfers files with encrypted, verified chunks.

## Public Description (about 300 words)
Archipel H24 is a multi-node peer-to-peer system designed for reliable and secure file sharing on local networks. The project started with a simple objective: allow nodes to find each other without manual configuration, then evolved into an end-to-end protected protocol with integrity checks and resilient chunked transfer.

In Sprint 1, we implemented node discovery using UDP multicast and routing over TCP with keepalive. Each node maintains a peer table with last-seen information and can automatically connect to other active nodes.

In Sprint 2, we added security by design. Nodes establish a session key through an ephemeral ECDH handshake, derive symmetric keys with HKDF-SHA256, encrypt messages using AES-256-GCM, and authenticate packets with HMAC-SHA256. We also introduced anti-replay controls (timestamp + nonce) and a minimal local trust model (trusted/revoked peers).

In Sprint 3, we implemented the file transfer layer: files are split into chunks, published through a signed manifest, downloaded in parallel from multiple peers, and verified chunk-by-chunk via SHA-256 before reconstruction. The downloader includes a rarest-first strategy and automatic retry when a node disconnects or returns corrupted data.

The result is a practical prototype that combines distributed networking and applied cryptography in a modular Node.js codebase. Our tests validate key scenarios: secure handshake success, tamper rejection, anti-replay behavior, large chunked transfer, continuity under peer failure, and recovery from corruption.

Archipel H24 demonstrates how a lightweight P2P architecture can deliver both performance and security for collaborative local file exchange.

## Built With
- Node.js
- net / dgram
- crypto (ECDH, HKDF, AES-256-GCM, HMAC-SHA256)
- PowerShell

## Demo Steps
1. Run Sprint 2 tests: `npm.cmd run test:sprint2`
2. Run Sprint 3 tests: `npm.cmd run test:sprint3`
3. Optional discovery demo: `powershell -ExecutionPolicy Bypass -File .\\scripts\\demo_sprint1.ps1`
